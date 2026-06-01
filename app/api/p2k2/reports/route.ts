import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureP2k2ReportTables, getPendampingProfileForUser } from "@/lib/data";
import { pool, query } from "@/lib/db";

const maxPhotoSize = 500 * 1024;
const maxPdfSize = 1024 * 1024;

export async function GET(request: Request) {
  const user = await getSession();
  await ensureP2k2ReportTables();
  const url = new URL(request.url);
  const groupId = Number(url.searchParams.get("groupId"));
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  if (!groupId || !year || !month) return NextResponse.json({ message: "Parameter laporan tidak lengkap" }, { status: 400 });

  const access = await canAccessGroup(user.id, user.role, groupId);
  if (!access.allowed) return NextResponse.json({ message: "Kelompok tidak ditemukan atau bukan akses Anda" }, { status: 404 });

  const reports = await query<any>(
    `SELECT id, group_id AS groupId, year, month, DATE_FORMAT(meeting_date, '%Y-%m-%d') AS meetingDate,
            module_name AS moduleName, session_name AS sessionName, material_title AS materialTitle,
            status, photo_path AS photoPath, pdf_path AS pdfPath
     FROM p2k2_reports
     WHERE group_id = ? AND year = ? AND month = ?
     LIMIT 1`,
    [groupId, year, month]
  );
  const report = reports[0] ?? null;
  const attendance = report
    ? await query<any>("SELECT kpm_id AS kpmId, attendance_status AS status, COALESCE(note, '') AS note FROM p2k2_report_attendance WHERE report_id = ?", [report.id])
    : [];

  return NextResponse.json({ report, attendance });
}

export async function POST(request: Request) {
  const user = await getSession();
  await ensureP2k2ReportTables();
  if (!["PENDAMPING", "ADMIN"].includes(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  try {
    const form = await request.formData();
    const groupId = Number(form.get("groupId"));
    const year = Number(form.get("year"));
    const month = Number(form.get("month"));
    const meetingDate = String(form.get("meetingDate") ?? "");
    const moduleName = String(form.get("moduleName") ?? "").trim();
    const sessionName = String(form.get("sessionName") ?? "").trim();
    const materialTitle = `${moduleName} - ${sessionName}`.trim();
    const status = String(form.get("status") ?? "DRAFT") === "TERKIRIM" ? "TERKIRIM" : "DRAFT";
    const attendance = JSON.parse(String(form.get("attendance") ?? "[]")) as { kpmId: number; nik: string; nama: string; hadir: boolean; note?: string }[];
    const photo = form.get("photo");
    const pdf = form.get("pdf");

    if (!groupId || !year || !month) return NextResponse.json({ message: "Kelompok, tahun, dan bulan wajib diisi" }, { status: 400 });
    if (!meetingDate || !moduleName || !sessionName) return NextResponse.json({ message: "Tanggal, materi, dan sesi wajib diisi" }, { status: 400 });
    if (!attendance.length) return NextResponse.json({ message: "Daftar kehadiran tidak boleh kosong" }, { status: 400 });
    if (isFutureMonth(year, month)) return NextResponse.json({ message: "Bulan laporan belum bisa dipilih" }, { status: 400 });
    if (!isDateInMonth(meetingDate, year, month) || meetingDate > todayInJakarta()) {
      return NextResponse.json({ message: "Tanggal pertemuan tidak boleh di luar bulan laporan atau melewati hari ini" }, { status: 400 });
    }

    const access = await canAccessGroup(user.id, user.role, groupId);
    if (!access.allowed || !access.pendampingId) return NextResponse.json({ message: "Kelompok tidak ditemukan atau bukan akses Anda" }, { status: 404 });

    const existingRows = await query<{ id: number; photo_path: string | null; pdf_path: string | null; photo_size: number | null; pdf_size: number | null }>(
      "SELECT id, photo_path, pdf_path, photo_size, pdf_size FROM p2k2_reports WHERE group_id = ? AND year = ? AND month = ? LIMIT 1",
      [groupId, year, month]
    );
    const existing = existingRows[0];
    let photoPath = existing?.photo_path ?? null;
    let pdfPath = existing?.pdf_path ?? null;
    let photoSize = existing?.photo_size ?? null;
    let pdfSize = existing?.pdf_size ?? null;

    if (photo instanceof File && photo.size > 0) {
      if (!photo.type.startsWith("image/")) return NextResponse.json({ message: "File foto harus berupa gambar" }, { status: 400 });
      if (photo.size > maxPhotoSize) return NextResponse.json({ message: "Foto masih lebih dari 500 KB setelah kompresi" }, { status: 400 });
      const saved = await saveUpload(photo, "photos", year, month, access.pendampingId, groupId, "jpg");
      photoPath = saved.url;
      photoSize = saved.size;
    }

    if (pdf instanceof File && pdf.size > 0) {
      if (pdf.type !== "application/pdf") return NextResponse.json({ message: "File absensi harus PDF" }, { status: 400 });
      if (pdf.size > maxPdfSize) return NextResponse.json({ message: "PDF absensi maksimal 1 MB. Silakan kompres PDF terlebih dahulu." }, { status: 400 });
      const saved = await saveUpload(pdf, "absensi", year, month, access.pendampingId, groupId, "pdf");
      pdfPath = saved.url;
      pdfSize = saved.size;
    }

    if (status === "TERKIRIM" && (!photoPath || !pdfPath)) {
      return NextResponse.json({ message: "Foto kegiatan dan PDF absensi wajib ada sebelum kirim laporan" }, { status: 400 });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      let reportId = existing?.id;
      if (reportId) {
        await connection.execute(
          `UPDATE p2k2_reports
           SET pendamping_id = ?, meeting_date = ?, module_name = ?, session_name = ?, material_title = ?, status = ?,
               photo_path = ?, photo_size = ?, pdf_path = ?, pdf_size = ?, submitted_at = IF(? = 'TERKIRIM', CURRENT_TIMESTAMP, submitted_at)
           WHERE id = ?`,
          [access.pendampingId, meetingDate, moduleName, sessionName, materialTitle, status, photoPath, photoSize, pdfPath, pdfSize, status, reportId]
        );
      } else {
        const [result] = await connection.execute(
          `INSERT INTO p2k2_reports
           (group_id, pendamping_id, year, month, meeting_date, module_name, session_name, material_title, status, photo_path, photo_size, pdf_path, pdf_size, submitted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'TERKIRIM', CURRENT_TIMESTAMP, NULL))`,
          [groupId, access.pendampingId, year, month, meetingDate, moduleName, sessionName, materialTitle, status, photoPath, photoSize, pdfPath, pdfSize, status]
        );
        reportId = Number((result as any).insertId);
      }

      await connection.execute("DELETE FROM p2k2_report_attendance WHERE report_id = ?", [reportId]);
      const values = attendance.map((row) => [reportId, row.kpmId, row.nik, row.nama, row.hadir ? "HADIR" : "TIDAK_HADIR", String(row.note ?? "").trim()]);
      await connection.query("INSERT INTO p2k2_report_attendance (report_id, kpm_id, kpm_nik, kpm_name, attendance_status, note) VALUES ?", [values]);
      await connection.execute("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'UPSERT', 'p2k2_reports', ?, ?)", [user.id, String(reportId), `Simpan laporan P2K2 group ${groupId} ${year}-${month}`]);
      await connection.commit();
      return NextResponse.json({ ok: true, id: reportId, status, photoPath, pdfPath });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Gagal menyimpan laporan P2K2", error);
    return NextResponse.json({ message: error?.sqlMessage ?? error?.message ?? "Gagal menyimpan laporan P2K2" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getSession();
  await ensureP2k2ReportTables();
  if (!["PENDAMPING", "ADMIN"].includes(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const groupId = Number(url.searchParams.get("groupId"));
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  if (!groupId || !year || !month) return NextResponse.json({ message: "Parameter laporan tidak lengkap" }, { status: 400 });

  const access = await canAccessGroup(user.id, user.role, groupId);
  if (!access.allowed) return NextResponse.json({ message: "Kelompok tidak ditemukan atau bukan akses Anda" }, { status: 404 });

  const reports = await query<{ id: number }>(
    "SELECT id FROM p2k2_reports WHERE group_id = ? AND year = ? AND month = ? LIMIT 1",
    [groupId, year, month]
  );
  const report = reports[0];
  if (!report) return NextResponse.json({ message: "Laporan tidak ditemukan" }, { status: 404 });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM p2k2_report_attendance WHERE report_id = ?", [report.id]);
    await connection.execute("DELETE FROM p2k2_reports WHERE id = ?", [report.id]);
    await connection.execute("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'DELETE', 'p2k2_reports', ?, ?)", [
      user.id,
      String(report.id),
      `Hapus laporan P2K2 group ${groupId} ${year}-${month}`
    ]);
    await connection.commit();
    return NextResponse.json({ ok: true, id: report.id });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function canAccessGroup(userId: number, role: string, groupId: number) {
  const profile = role === "PENDAMPING" ? await getPendampingProfileForUser(userId) : null;
  const rows = await query<{ id: number; pendamping_id: number }>(
    `SELECT id, pendamping_id FROM p2k2_groups WHERE id = ? ${profile ? "AND pendamping_id = ?" : ""} LIMIT 1`,
    profile ? [groupId, profile.id] : [groupId]
  );
  const group = rows[0];
  return { allowed: !!group, pendampingId: group?.pendamping_id };
}

function todayInJakarta() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function isFutureMonth(year: number, month: number) {
  const today = todayInJakarta();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  return year > currentYear || (year === currentYear && month > currentMonth);
}

function isDateInMonth(value: string, year: number, month: number) {
  return value.startsWith(`${year}-${String(month).padStart(2, "0")}-`);
}

async function saveUpload(file: File, kind: "photos" | "absensi", year: number, month: number, pendampingId: number, groupId: number, ext: string) {
  const dir = path.join(process.cwd(), "public", "uploads", "p2k2", kind, String(year), String(month).padStart(2, "0"), `pendamping-${pendampingId}`);
  await mkdir(dir, { recursive: true });
  const filename = `kelompok-${groupId}.${ext}`;
  const fullPath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);
  return {
    url: `/uploads/p2k2/${kind}/${year}/${String(month).padStart(2, "0")}/pendamping-${pendampingId}/${filename}`,
    size: buffer.length
  };
}
