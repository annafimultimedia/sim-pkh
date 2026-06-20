import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureHealthVisitVerificationTable, getActivePeriod, getPendampingProfileForUser } from "@/lib/data";
import { query } from "@/lib/db";
import { canAccessMenu } from "@/lib/menu-access";
import { deletePublicUpload } from "@/lib/upload-files";
import { HealthComponentType } from "@/lib/types";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function GET(request: Request) {
  const user = await getSession();
  if (!(await canAccessMenu(user, "verifikasi-kesehatan"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  await ensureHealthVisitVerificationTable();

  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  const kpmId = Number(url.searchParams.get("kpmId"));
  const slotNo = Number(url.searchParams.get("slotNo"));
  const componentType = normalizeComponentType(url.searchParams.get("componentType"));
  if (!year || month < 1 || month > 12) {
    return NextResponse.json({ message: "Tahun dan bulan tidak valid" }, { status: 400 });
  }

  const profile = user.role === "PENDAMPING" ? await getPendampingProfileForUser(user.id) : null;
  if (user.role === "PENDAMPING" && !profile) return NextResponse.json({ rows: [] });
  const ownerWhere = profile ? "AND fc.pendamping_id = ?" : "";
  const recordWhere = kpmId && slotNo && componentType
    ? "AND v.kpm_id = ? AND v.component_type = ? AND v.elder_slot_no = ?"
    : "";
  const rows = await query<any>(
    `SELECT v.id, v.kpm_id AS kpmId, v.elder_slot_no AS slotNo,
            v.component_type AS componentType,
            CASE v.component_type
              WHEN 'HAMIL' THEN 'Ibu Hamil'
              WHEN 'AUD' THEN 'Anak Usia Dini (AUD)'
              WHEN 'DISABILITAS' THEN 'Disabilitas'
              ELSE 'Lansia'
            END AS componentLabel,
            v.year, v.month,
            DATE_FORMAT(v.visit_date, '%Y-%m-%d') AS visitDate,
            v.attendance_status AS status, COALESCE(v.note, '') AS note,
            v.photo_path AS photoPath,
            COALESCE((
              SELECT GROUP_CONCAT(CONCAT(vm.month, '/', vm.year) ORDER BY vm.year, vm.month SEPARATOR ',')
              FROM health_visit_verifications vm
              WHERE vm.photo_path = v.photo_path
                AND vm.photo_path IS NOT NULL
                AND vm.photo_path <> ''
                AND vm.kpm_id = v.kpm_id
                AND vm.component_type = v.component_type
                AND vm.elder_slot_no = v.elder_slot_no
            ), '') AS photoMonths,
            v.elder_nik AS elderNik, v.elder_name AS elderName,
            v.no_kk AS noKk, COALESCE(fc.nama_penerima, '') AS recipientName,
            COALESCE(v.group_name, '') AS groupName,
            COALESCE(u.name, '') AS verifiedBy,
            DATE_FORMAT(v.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
     FROM health_visit_verifications v
     LEFT JOIN kpm_final_closing fc ON fc.id = v.kpm_id
     LEFT JOIN users u ON u.id = v.verified_by
     WHERE v.year = ? AND v.month = ?
       ${recordWhere}
       ${ownerWhere}
     ORDER BY v.updated_at DESC`,
    [year, month, ...(recordWhere ? [kpmId, componentType!, slotNo] : []), ...(profile ? [profile.id] : [])]
  );
  return NextResponse.json({ rows });
}

export async function DELETE(request: Request) {
  const user = await getSession();
  if (!(await canAccessMenu(user, "verifikasi-kesehatan"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  await ensureHealthVisitVerificationTable();

  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ message: "ID verifikasi tidak valid" }, { status: 400 });

    const profile = user.role === "PENDAMPING" ? await getPendampingProfileForUser(user.id) : null;
    if (user.role === "PENDAMPING" && !profile) {
      return NextResponse.json({ message: "Profil pendamping tidak ditemukan" }, { status: 403 });
    }
    const ownerWhere = profile ? "AND fc.pendamping_id = ?" : "";
    const rows = await query<any>(
      `SELECT v.id, v.kpm_id AS kpmId, v.component_type AS componentType,
              v.elder_slot_no AS slotNo, v.elder_name AS elderName,
              v.year, v.month, v.photo_path AS photoPath
       FROM health_visit_verifications v
       JOIN kpm_final_closing fc ON fc.id = v.kpm_id
       WHERE v.id = ? ${ownerWhere}
       LIMIT 1`,
      [id, ...(profile ? [profile.id] : [])]
    );
    if (!rows[0]) return NextResponse.json({ message: "Data verifikasi tidak ditemukan atau bukan KPM dampingan Anda" }, { status: 404 });

    await query("DELETE FROM health_visit_verifications WHERE id = ?", [id]);
    await cleanupUnusedPhotoPaths([rows[0].photoPath], "");
    await query(
      "INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'DELETE', 'health_visit_verifications', ?, ?)",
      [user.id, String(id), `Menghapus verifikasi kesehatan ${rows[0].elderName} periode ${rows[0].month}/${rows[0].year}`]
    );
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Gagal menghapus verifikasi kesehatan", error);
    return NextResponse.json({ message: error?.sqlMessage ?? error?.message ?? "Gagal menghapus verifikasi" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!(await canAccessMenu(user, "verifikasi-kesehatan"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  await ensureHealthVisitVerificationTable();

  try {
    const contentType = request.headers.get("content-type") ?? "";
    const formData = contentType.includes("multipart/form-data") ? await request.formData() : null;
    const body = formData ? Object.fromEntries(formData.entries()) : await request.json();
    const kpmId = Number(body.kpmId);
    const slotNo = Number(body.slotNo);
    const componentType = normalizeComponentType(body.componentType);
    const year = Number(body.year);
    const month = Number(body.month);
    const visitDate = String(body.visitDate ?? "");
    const elderNik = String(body.elderNik ?? "").replace(/\D/g, "");
    const elderName = String(body.elderName ?? "").trim();
    const status = String(body.status);
    const note = String(body.note ?? "").trim();
    const periods = normalizeSavePeriods(formData ? formData.get("periods") : body.periods, year, month, visitDate, status, note);
    const photo = formData?.get("photo") instanceof File ? formData.get("photo") as File : null;

    if (!kpmId || !slotNo || !componentType || !periods.length || !elderNik || !elderName) {
      return NextResponse.json({ message: "Data verifikasi belum lengkap" }, { status: 400 });
    }
    const invalidStatus = periods.find((period) => period.status !== "HADIR" && period.status !== "TIDAK_HADIR");
    if (invalidStatus) {
      return NextResponse.json({ message: "Status kehadiran tidak valid" }, { status: 400 });
    }
    const absentWithoutNote = periods.find((period) => period.status === "TIDAK_HADIR" && !period.note);
    if (absentWithoutNote) {
      return NextResponse.json({ message: "Keterangan wajib diisi jika anggota tidak hadir" }, { status: 400 });
    }
    const activePeriod = await getActivePeriod();
    const allowedPeriods = getAllowedRapelPeriods(activePeriod.year);
    const invalidPeriod = periods.find((period) => !allowedPeriods.has(periodKey(period.year, period.month)));
    if (invalidPeriod) {
      return NextResponse.json({ message: "Rapel verifikasi hanya dapat diisi dari Januari sampai bulan berjalan pada tahun aktif" }, { status: 400 });
    }
    const invalidVisitDate = periods.find((period) => !period.visitDate.startsWith(`${period.year}-${String(period.month).padStart(2, "0")}-`) || period.visitDate > todayInJakarta());
    if (invalidVisitDate) {
      return NextResponse.json({ message: "Tanggal kunjungan harus berada pada bulan verifikasi dan tidak boleh melewati hari ini" }, { status: 400 });
    }

    const profile = user.role === "PENDAMPING" ? await getPendampingProfileForUser(user.id) : null;
    if (user.role === "PENDAMPING" && !profile) {
      return NextResponse.json({ message: "Profil pendamping tidak ditemukan" }, { status: 403 });
    }
    const ownerWhere = profile ? "AND fc.pendamping_id = ?" : "";
    const identity = await query<any>(
      `SELECT fc.id AS kpmId, fc.no_kk AS noKk, fc.hamil, fc.aud, fc.lansia, fc.disabil,
              COALESCE(g.id, 0) AS groupId, COALESCE(g.name, '') AS groupName
       FROM kpm_final_closing fc
       LEFT JOIN p2k2_group_members gm ON gm.kpm_nik = fc.nik
       LEFT JOIN p2k2_groups g ON g.id = gm.group_id AND g.archived_at IS NULL
       WHERE fc.id = ? ${ownerWhere} LIMIT 1`,
      [kpmId, ...(profile ? [profile.id] : [])]
    );
    if (!identity[0] || slotNo > componentCount(identity[0], componentType)) {
      return NextResponse.json({ message: "Data komponen kesehatan tidak ditemukan" }, { status: 404 });
    }

    const art = await query<any>(
      `SELECT nik, nama FROM art_members
       WHERE no_kk = ? AND nik = ?
         AND ${artComponentCondition(componentType)}
       LIMIT 1`,
      [identity[0].noKk, elderNik]
    );
    if (!art[0]) return NextResponse.json({ message: `Identitas ${componentLabel(componentType)} belum lengkap` }, { status: 400 });

    const oldPhotoPaths = photo && photo.size > 0
      ? await getExistingPhotoPaths(kpmId, componentType, slotNo, periods)
      : [];
    const newPhotoPath = photo && photo.size > 0
      ? await saveVerificationPhoto(photo, periods[0].year, periods[0].month, kpmId, componentType, slotNo)
      : null;

    for (const period of periods) {
      await query(
        `INSERT INTO health_visit_verifications
         (kpm_id, elder_slot_no, component_type, elder_nik, elder_name, no_kk, group_id, group_name, year, month, visit_date, attendance_status, note, photo_path, verified_by)
         VALUES (?, ?, ?, ?, ?, ?, NULLIF(?, 0), ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE elder_nik=VALUES(elder_nik), elder_name=VALUES(elder_name),
           no_kk=VALUES(no_kk), group_id=VALUES(group_id), group_name=VALUES(group_name),
           visit_date=VALUES(visit_date), attendance_status=VALUES(attendance_status),
           note=VALUES(note), photo_path=COALESCE(VALUES(photo_path), photo_path), verified_by=VALUES(verified_by)`,
        [kpmId, slotNo, componentType, art[0].nik, art[0].nama, identity[0].noKk, identity[0].groupId, identity[0].groupName, period.year, period.month, period.visitDate, period.status, period.note, newPhotoPath, user.id]
      );
      await query(
        "INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'UPSERT', 'health_visit_verifications', ?, ?)",
        [user.id, `${kpmId}-${componentType}-${slotNo}-${period.year}-${period.month}`, `Verifikasi kesehatan ${componentLabel(componentType)} ${art[0].nama}: ${period.status}`]
      );
    }
    if (newPhotoPath) await cleanupUnusedPhotoPaths(oldPhotoPaths, newPhotoPath);
    return NextResponse.json({ ok: true, saved: periods.length });
  } catch (error: any) {
    console.error("Gagal menyimpan verifikasi kesehatan", error);
    return NextResponse.json({ message: error?.sqlMessage ?? error?.message ?? "Gagal menyimpan verifikasi" }, { status: 500 });
  }
}

function normalizeSavePeriods(bodyPeriods: unknown, year: number, month: number, visitDate: string, status: string, note: string) {
  const parsedPeriods = typeof bodyPeriods === "string"
    ? safeJsonParse(bodyPeriods)
    : bodyPeriods;
  const rawPeriods = Array.isArray(parsedPeriods) && parsedPeriods.length
    ? parsedPeriods
    : [{ year, month, visitDate, status, note }];
  const seen = new Set<string>();
  const periods: { year: number; month: number; visitDate: string; status: "HADIR" | "TIDAK_HADIR"; note: string }[] = [];
  for (const item of rawPeriods) {
    const raw = item as { year?: unknown; month?: unknown; visitDate?: unknown; status?: unknown; note?: unknown };
    const period = {
      year: Number(raw.year),
      month: Number(raw.month),
      visitDate: String(raw.visitDate ?? ""),
      status: String(raw.status ?? "HADIR") === "TIDAK_HADIR" ? "TIDAK_HADIR" as const : "HADIR" as const,
      note: String(raw.note ?? "").trim()
    };
    if (!period.year || period.month < 1 || period.month > 12 || !period.visitDate) continue;
    const key = periodKey(period.year, period.month);
    if (seen.has(key)) continue;
    seen.add(key);
    periods.push(period);
  }
  return periods;
}

function getAllowedRapelPeriods(activeYear: number) {
  const today = todayInJakarta();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const lastMonth = activeYear === currentYear ? currentMonth : 12;
  return new Set(Array.from({ length: lastMonth }, (_, index) => periodKey(activeYear, index + 1)));
}

function periodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function getExistingPhotoPaths(
  kpmId: number,
  componentType: HealthComponentType,
  slotNo: number,
  periods: { year: number; month: number }[]
) {
  const where = periods.map(() => "(year = ? AND month = ?)").join(" OR ");
  if (!where) return [];
  const params = periods.flatMap((period) => [period.year, period.month]);
  const rows = await query<{ photoPath: string | null }>(
    `SELECT DISTINCT photo_path AS photoPath
     FROM health_visit_verifications
     WHERE kpm_id = ? AND component_type = ? AND elder_slot_no = ?
       AND photo_path IS NOT NULL AND photo_path <> ''
       AND (${where})`,
    [kpmId, componentType, slotNo, ...params]
  );
  return rows.map((row) => row.photoPath).filter((value): value is string => Boolean(value));
}

async function cleanupUnusedPhotoPaths(oldPhotoPaths: string[], newPhotoPath: string) {
  const uniquePaths = [...new Set(oldPhotoPaths)].filter((photoPath) => photoPath && photoPath !== newPhotoPath);
  for (const photoPath of uniquePaths) {
    const rows = await query<{ total: number }>(
      "SELECT COUNT(*) AS total FROM health_visit_verifications WHERE photo_path = ?",
      [photoPath]
    );
    if (Number(rows[0]?.total ?? 0) === 0) {
      await deletePublicUpload(photoPath, "uploads/health-verifications/");
    }
  }
}

async function saveVerificationPhoto(file: File, year: number, month: number, kpmId: number, componentType: string, slotNo: number) {
  if (!file.type.startsWith("image/")) throw new Error("Foto harus berupa gambar");
  if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran foto maksimal 5 MB");
  const extension = file.type.includes("png") ? "png" : "jpg";
  const dir = path.join(process.cwd(), "public", "uploads", "health-verifications", String(year), String(month).padStart(2, "0"));
  await mkdir(dir, { recursive: true });
  const filename = `${kpmId}-${componentType}-${slotNo}-${Date.now()}.${extension}`;
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/health-verifications/${year}/${String(month).padStart(2, "0")}/${filename}`;
}

function normalizeComponentType(value: unknown): HealthComponentType | null {
  return ["HAMIL", "AUD", "LANSIA", "DISABILITAS"].includes(String(value))
    ? String(value) as HealthComponentType
    : null;
}

function componentCount(kpm: { hamil: number; aud: number; lansia: number; disabil: number }, type: HealthComponentType) {
  return Number(type === "HAMIL" ? kpm.hamil : type === "AUD" ? kpm.aud : type === "LANSIA" ? kpm.lansia : kpm.disabil);
}

function artComponentCondition(type: HealthComponentType) {
  if (type === "HAMIL") return "UPPER(TRIM(COALESCE(komponen, ''))) LIKE '%HAMIL%'";
  if (type === "AUD") return "UPPER(TRIM(COALESCE(komponen, ''))) IN ('USIA DINI', 'AUD')";
  if (type === "DISABILITAS") return "UPPER(TRIM(COALESCE(komponen, ''))) LIKE '%DISABILITAS%'";
  return "UPPER(TRIM(COALESCE(komponen, ''))) LIKE '%LANSIA%'";
}

function componentLabel(type: HealthComponentType) {
  return type === "HAMIL" ? "Ibu Hamil" : type === "AUD" ? "Anak Usia Dini (AUD)" : type === "LANSIA" ? "Lansia" : "Disabilitas";
}

function todayInJakarta() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
