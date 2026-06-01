import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { ensureArtMembersExtraColumns, getActivePeriod } from "@/lib/data";
import { pool, query } from "@/lib/db";

const headerAliases = {
  noKk: ["NO KK", "NO. KK", "NOKK", "NOMOR KK", "NO KARTU KELUARGA", "NOMOR KARTU KELUARGA"],
  nik: ["NIK", "NO NIK", "NO. NIK", "NOMOR NIK", "NIK PENGURUS", "NIK ART", "NIK PENGURUS / ART"],
  nama: ["NAMA", "NAMA ART", "NAMA ANGGOTA", "NAMA PENGURUS", "NAMA PENGURUS / ART"],
  komponen: ["KOMPONEN", "KOMPONEN PKH", "JENIS KOMPONEN"],
  dtsenJenjang: ["DTSEN JENJANG", "JENJANG DTSEN"],
  dtsenSekolah: ["DTSEN SEKOLAH", "SEKOLAH DTSEN", "NAMA SEKOLAH DTSEN"],
  dtsenKip: ["DTSEN KIP", "KIP DTSEN", "PENERIMA KIP DTSEN"],
  dtsenMsg: ["DTSEN MSG", "MSG DTSEN", "KETERANGAN DTSEN", "KETERANGAN DAPODIK"],
  dapodikJenjang: ["DAPODIK JENJANG", "JENJANG DAPODIK"],
  dapodikSekolah: ["DAPODIK SEKOLAH", "SEKOLAH DAPODIK", "NAMA SEKOLAH DAPODIK"],
  dapodikKip: ["DAPODIK KIP", "KIP DAPODIK", "PENERIMA KIP DAPODIK"],
  dapodikMsg: ["DAPODIK MSG", "MSG DAPODIK", "KETERANGAN DAPODIK_1", "KETERANGAN DAPODIK 1"],
  alamat: ["ALAMAT", "ALAMAT ART"],
  rt: ["RT"],
  rw: ["RW"],
  desa: ["DESA/KEL", "DESA", "KELURAHAN", "DESA KEL", "DESA/KELURAHAN"],
  kecamatan: ["KECAMATAN"],
  kabupaten: ["KABUPATEN", "KAB/KOTA", "KABUPATEN/KOTA"],
  status: ["STATUS", "NAMA PERIODE", "STATUS BANSOS"],
  periode: ["PERIODE", "PERIODE BANSOS", "PERIODE PKH"]
};

const requiredHeaders = [
  { label: "NO KK", aliases: headerAliases.noKk },
  { label: "NIK", aliases: headerAliases.nik },
  { label: "NAMA", aliases: headerAliases.nama },
  { label: "KOMPONEN", aliases: headerAliases.komponen }
];

function cell(row: Record<string, unknown>, keys: string | string[]) {
  const aliases = Array.isArray(keys) ? keys : [keys];
  const found = Object.entries(row).find(([name]) => aliases.some((key) => sameHeader(name, key)));
  return String(found?.[1] ?? "").trim();
}

function normalize(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function simplifyHeader(value: string) {
  return normalize(value).replace(/[./-]/g, " ").replace(/\s+/g, " ");
}

function sameHeader(left: string, right: string) {
  return normalize(left) === normalize(right) || simplifyHeader(left) === simplifyHeader(right);
}

function hasHeader(headers: string[], aliases: string[]) {
  return aliases.some((alias) => headers.some((header) => sameHeader(header, alias)));
}

function formatRtRw(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (digits.length <= 3) return digits.padStart(3, "0");
  return digits;
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!["ADMIN", "PENDAMPING"].includes(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  try {
    await ensureArtMembersExtraColumns();
    const activePeriod = await getActivePeriod();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ message: "File ART wajib dipilih" }, { status: 400 });

    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
    if (!rows.length) return NextResponse.json({ message: "File kosong atau tidak terbaca" }, { status: 400 });

    const headers = Object.keys(rows[0]);
    const missing = requiredHeaders.filter((header) => !hasHeader(headers, header.aliases)).map((header) => header.label);
    if (missing.length) {
      return NextResponse.json({
        message: `Header tidak lengkap: ${missing.join(", ")}. Kolom terbaca: ${headers.join(", ")}`
      }, { status: 400 });
    }

    const values = rows
      .filter((row) => cell(row, headerAliases.noKk) && cell(row, headerAliases.nik) && cell(row, headerAliases.nama))
      .map((row) => ({
        no_kk: cell(row, headerAliases.noKk),
        nik: cell(row, headerAliases.nik),
        nama: cell(row, headerAliases.nama),
        komponen: cell(row, headerAliases.komponen),
        dtsen_jenjang: cell(row, headerAliases.dtsenJenjang),
        dtsen_sekolah: cell(row, headerAliases.dtsenSekolah),
        dtsen_kip: cell(row, headerAliases.dtsenKip),
        dtsen_msg: cell(row, headerAliases.dtsenMsg),
        dapodik_jenjang: cell(row, headerAliases.dapodikJenjang),
        dapodik_sekolah: cell(row, headerAliases.dapodikSekolah),
        dapodik_kip: cell(row, headerAliases.dapodikKip),
        dapodik_msg: cell(row, headerAliases.dapodikMsg),
        alamat: cell(row, headerAliases.alamat),
        rt: formatRtRw(cell(row, headerAliases.rt)),
        rw: formatRtRw(cell(row, headerAliases.rw)),
        desa: cell(row, headerAliases.desa),
        kecamatan: cell(row, headerAliases.kecamatan),
        kabupaten: cell(row, headerAliases.kabupaten) || "KAB. JEMBER",
        status: cell(row, headerAliases.status),
        periode: cell(row, headerAliases.periode)
      }));

    if (!values.length) return NextResponse.json({ message: "Tidak ada baris valid. Pastikan NO KK, NIK, dan NAMA terisi." }, { status: 400 });
    if (user.role === "PENDAMPING") {
      const assignedDistrict = String(user.district ?? "").trim();
      if (!assignedDistrict) return NextResponse.json({ message: "Kecamatan tugas pendamping tidak ditemukan pada sesi login." }, { status: 400 });
      const outsideDistricts = [...new Set(values.map((row) => row.kecamatan).filter((item) => item && normalize(item) !== normalize(assignedDistrict)))];
      if (outsideDistricts.length) {
        return NextResponse.json({ message: `File berisi kecamatan di luar tugas Anda: ${outsideDistricts.join(", ")}. Kecamatan tugas Anda adalah ${assignedDistrict}.` }, { status: 403 });
      }
      for (const row of values) {
        if (!row.kecamatan) row.kecamatan = assignedDistrict;
      }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [batchResult] = await connection.execute(
        "INSERT INTO import_batches (type, year, stage, district_id, file_name, uploaded_by) VALUES ('ART', ?, ?, NULL, ?, ?)",
        [activePeriod.year, activePeriod.stage, file.name, user.id]
      );
      const batchId = Number((batchResult as any).insertId);

      const noKks = [...new Set(values.map((row) => row.no_kk))];
      const finalClosingSet = new Set<string>();
      for (let i = 0; i < noKks.length; i += 1000) {
        const chunk = noKks.slice(i, i + 1000);
        const placeholders = chunk.map(() => "?").join(",");
        const [matches] = await connection.query(
          `SELECT DISTINCT no_kk
           FROM kpm_final_closing
           WHERE year = ? AND stage = ? AND no_kk IN (${placeholders})`,
          [activePeriod.year, activePeriod.stage, ...chunk]
        );
        for (const match of matches as { no_kk: string }[]) finalClosingSet.add(match.no_kk);
      }

      for (let i = 0; i < values.length; i += 500) {
        const chunk = values.slice(i, i + 500);
        const pairs = chunk.map(() => "(?, ?)").join(",");
        await connection.query(`DELETE FROM art_members WHERE (no_kk, nik) IN (${pairs})`, chunk.flatMap((row) => [row.no_kk, row.nik]));
      }

      const insertSql = `INSERT INTO art_members
        (import_batch_id, no_kk, nik, nama, komponen, dtsen_jenjang, dtsen_sekolah, dtsen_kip, dtsen_msg,
         dapodik_jenjang, dapodik_sekolah, dapodik_kip, dapodik_msg, alamat, rt, rw, desa, kecamatan, kabupaten, status, periode)
        VALUES ?`;
      for (let i = 0; i < values.length; i += 500) {
        const chunk = values.slice(i, i + 500).map((row) => [
          batchId,
          row.no_kk,
          row.nik,
          row.nama,
          row.komponen,
          row.dtsen_jenjang,
          row.dtsen_sekolah,
          row.dtsen_kip,
          row.dtsen_msg,
          row.dapodik_jenjang,
          row.dapodik_sekolah,
          row.dapodik_kip,
          row.dapodik_msg,
          row.alamat,
          row.rt,
          row.rw,
          row.desa,
          row.kecamatan,
          row.kabupaten,
          row.status,
          row.periode
        ]);
        await connection.query(insertSql, [chunk]);
      }

      const matched = values.filter((row) => finalClosingSet.has(row.no_kk)).length;
      const unmatched = values.length - matched;
      await connection.execute("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'IMPORT', 'art_members', ?, ?)", [
        user.id,
        String(batchId),
        `Import ART ${file.name}: ${values.length} baris, ${matched} cocok Final Closing, ${unmatched} belum cocok`
      ]);
      await connection.commit();
      return NextResponse.json({ total: values.length, matched, unmatched, batchId, file: file.name });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Import ART gagal", error);
    return NextResponse.json({ message: error?.sqlMessage ?? error?.message ?? "Import ART gagal" }, { status: 500 });
  }
}
