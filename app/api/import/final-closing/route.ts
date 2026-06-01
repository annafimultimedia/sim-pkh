import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { pool, query } from "@/lib/db";

const requiredHeaders = [
  "NAMA PENERIMA",
  "NIK",
  "NO KK",
  "TGL LAHIR",
  "UMUR",
  "ART",
  "HAMIL",
  "AUD",
  "SD",
  "SMP",
  "SMA",
  "DISABIL",
  "LANSIA",
  "HAM",
  "JML KOMPONEN",
  "NOMINAL",
  "STATUS",
  "ALAMAT FC",
  "ALAMAT",
  "RT",
  "RW",
  "KELURAHAN",
  "KECAMATAN",
  "KABUPATEN",
  "PROVINSI"
];

function cell(row: Record<string, unknown>, key: string) {
  const found = Object.entries(row).find(([name]) => name.trim().toUpperCase() === key);
  return String(found?.[1] ?? "").trim();
}

function num(value: string) {
  const cleaned = value.replace(/[^\d.-]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

function dateValue(value: string) {
  if (!value) return null;
  const normalized = value.replace(/\//g, "-");
  const parts = normalized.split("-");
  if (parts[0]?.length === 4) return normalized.slice(0, 10);
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  return null;
}

export async function POST(request: Request) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  const year = Number(form.get("year"));
  const stage = Number(form.get("stage"));
  const districtId = String(form.get("districtId") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ message: "File Final Closing wajib dipilih" }, { status: 400 });
  if (!districtId) return NextResponse.json({ message: "Kecamatan wajib dipilih sebelum import" }, { status: 400 });
  if (!year || !stage) return NextResponse.json({ message: "Tahun dan tahap wajib dipilih" }, { status: 400 });

  const districts = await query<{ id: string; name: string; regency_id: string }>("SELECT id, name, regency_id FROM reg_districts WHERE id = ? AND regency_id = '3509' LIMIT 1", [districtId]);
  const district = districts[0];
  if (!district) return NextResponse.json({ message: "Kecamatan tidak valid untuk KAB. JEMBER" }, { status: 400 });

  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  if (!rows.length) return NextResponse.json({ message: "File kosong atau tidak terbaca" }, { status: 400 });

  const headers = Object.keys(rows[0]).map((item) => item.trim().toUpperCase());
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length) return NextResponse.json({ message: `Header tidak lengkap: ${missing.join(", ")}` }, { status: 400 });

  const values = rows
    .filter((row) => cell(row, "NIK") && cell(row, "NO KK") && cell(row, "NAMA PENERIMA"))
    .map((row) => ({
      year,
      stage,
      nama_penerima: cell(row, "NAMA PENERIMA"),
      nik: cell(row, "NIK"),
      no_kk: cell(row, "NO KK"),
      tgl_lahir: dateValue(cell(row, "TGL LAHIR")),
      umur: num(cell(row, "UMUR")),
      art: num(cell(row, "ART")),
      hamil: num(cell(row, "HAMIL")),
      aud: num(cell(row, "AUD")),
      sd: num(cell(row, "SD")),
      smp: num(cell(row, "SMP")),
      sma: num(cell(row, "SMA")),
      disabil: num(cell(row, "DISABIL")),
      lansia: num(cell(row, "LANSIA")),
      ham: num(cell(row, "HAM")),
      jml_komponen: num(cell(row, "JML KOMPONEN")),
      nominal: num(cell(row, "NOMINAL")),
      status: cell(row, "STATUS"),
      alamat_fc: cell(row, "ALAMAT FC"),
      alamat: cell(row, "ALAMAT"),
      rt: cell(row, "RT"),
      rw: cell(row, "RW"),
      kelurahan: cell(row, "KELURAHAN"),
      kecamatan: cell(row, "KECAMATAN") || district.name,
      kabupaten: cell(row, "KABUPATEN") || "KAB. JEMBER",
      provinsi: cell(row, "PROVINSI") || "JAWA TIMUR"
    }));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [batchResult] = await connection.execute(
      "INSERT INTO import_batches (type, year, stage, district_id, file_name, uploaded_by) VALUES ('FINAL_CLOSING', ?, ?, ?, ?, ?)",
      [year, stage, districtId, file.name, user.id]
    );
    const batchId = Number((batchResult as any).insertId);
    const uniqueNiks = [...new Set(values.map((row) => row.nik))];
    const existingMap = new Map<string, number>();
    const carryPendampingMap = new Map<string, number>();
    const lookupChunkSize = 1000;
    for (let i = 0; i < uniqueNiks.length; i += lookupChunkSize) {
      const chunk = uniqueNiks.slice(i, i + lookupChunkSize);
      const placeholders = chunk.map(() => "?").join(",");
      const [existingRows] = await connection.query(
        `SELECT id, nik FROM kpm_final_closing WHERE year = ? AND stage = ? AND nik IN (${placeholders})`,
        [year, stage, ...chunk]
      );
      for (const row of existingRows as { id: number; nik: string }[]) {
        existingMap.set(row.nik, row.id);
      }

      const [previousRows] = await connection.query(
        `SELECT nik, pendamping_id
         FROM kpm_final_closing
         WHERE pendamping_id IS NOT NULL
           AND nik IN (${placeholders})
           AND (year < ? OR (year = ? AND stage < ?))
         ORDER BY year DESC, stage DESC, id DESC`,
        [...chunk, year, year, stage]
      );
      for (const row of previousRows as { nik: string; pendamping_id: number }[]) {
        if (!carryPendampingMap.has(row.nik)) carryPendampingMap.set(row.nik, row.pendamping_id);
      }
    }

    const insertRows = values.filter((row) => !existingMap.has(row.nik));
    const updateRows = values.filter((row) => existingMap.has(row.nik));
    const insertColumns = `(import_batch_id, year, stage, nama_penerima, nik, no_kk, tgl_lahir, umur, art, hamil, aud, sd, smp, sma, disabil, lansia, ham, jml_komponen, nominal, status, alamat_fc, alamat, rt, rw, kelurahan, kecamatan, kabupaten, provinsi, pendamping_id, mapped_at)`;
    const insertSql = `INSERT INTO kpm_final_closing ${insertColumns} VALUES ?`;
    const chunkSize = 500;
    for (let i = 0; i < insertRows.length; i += chunkSize) {
      const chunk = insertRows.slice(i, i + chunkSize).map((row) => [
        batchId,
        row.year,
        row.stage,
        row.nama_penerima,
        row.nik,
        row.no_kk,
        row.tgl_lahir,
        row.umur,
        row.art,
        row.hamil,
        row.aud,
        row.sd,
        row.smp,
        row.sma,
        row.disabil,
        row.lansia,
        row.ham,
        row.jml_komponen,
        row.nominal,
        row.status,
        row.alamat_fc,
        row.alamat,
        row.rt,
        row.rw,
        row.kelurahan,
        row.kecamatan,
        row.kabupaten,
        row.provinsi,
        carryPendampingMap.get(row.nik) ?? null,
        carryPendampingMap.has(row.nik) ? new Date() : null
      ]);
      await connection.query(insertSql, [chunk]);
    }
    const updateSql = `UPDATE kpm_final_closing
      SET import_batch_id = ?, no_kk = ?, nama_penerima = ?, tgl_lahir = ?, umur = ?, art = ?, hamil = ?, aud = ?, sd = ?, smp = ?, sma = ?,
          disabil = ?, lansia = ?, ham = ?, jml_komponen = ?, nominal = ?, status = ?, alamat_fc = ?, alamat = ?,
          rt = ?, rw = ?, kelurahan = ?, kecamatan = ?, kabupaten = ?, provinsi = ?,
          mapped_at = IF(pendamping_id IS NULL AND ? IS NOT NULL, CURRENT_TIMESTAMP, mapped_at),
          pendamping_id = COALESCE(pendamping_id, ?)
      WHERE id = ?`;
    for (const row of updateRows) {
      const existingId = existingMap.get(row.nik);
      if (!existingId) continue;
      const carriedPendampingId = carryPendampingMap.get(row.nik) ?? null;
      await connection.execute(updateSql, [
        batchId,
        row.no_kk,
        row.nama_penerima,
        row.tgl_lahir,
        row.umur,
        row.art,
        row.hamil,
        row.aud,
        row.sd,
        row.smp,
        row.sma,
        row.disabil,
        row.lansia,
        row.ham,
        row.jml_komponen,
        row.nominal,
        row.status,
        row.alamat_fc,
        row.alamat,
        row.rt,
        row.rw,
        row.kelurahan,
        row.kecamatan,
        row.kabupaten,
        row.provinsi,
        carriedPendampingId,
        carriedPendampingId,
        existingId
      ]);
    }
    await connection.execute("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'IMPORT', 'kpm_final_closing', ?, ?)", [
      user.id,
      String(batchId),
      `Import Final Closing ${file.name}: ${insertRows.length} insert, ${updateRows.length} update, ${carryPendampingMap.size} NIK membawa pendamping tahap sebelumnya, ${district.name}, tahun ${year} tahap ${stage}`
    ]);
    await connection.commit();
    return NextResponse.json({ imported: insertRows.length, updated: updateRows.length, carriedPendamping: carryPendampingMap.size, total: values.length, batchId, district: district.name, file: file.name });
  } catch (error: any) {
    await connection.rollback();
    return NextResponse.json({ message: error?.sqlMessage ?? error?.message ?? "Import gagal" }, { status: 500 });
  } finally {
    connection.release();
  }
}
