import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureArtMembersExtraColumns, getActivePeriod, getPendampingProfileForUser } from "@/lib/data";
import { pool, query } from "@/lib/db";
import { canAccessMenu } from "@/lib/menu-access";
import { HealthComponentType } from "@/lib/types";

export async function POST(request: Request) {
  const user = await getSession();
  if (!(await canAccessMenu(user, "verifikasi-kesehatan"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  try {
    await ensureArtMembersExtraColumns();
    const activePeriod = await getActivePeriod();
    const body = await request.json();
    const kpmId = Number(body.kpmId);
    const slotNo = Number(body.slotNo);
    const componentType = normalizeComponentType(body.componentType);
    const nik = String(body.nik ?? "").replace(/\D/g, "");
    const nama = String(body.nama ?? "").trim();
    const profile = user.role === "PENDAMPING" ? await getPendampingProfileForUser(user.id) : null;
    if (user.role === "PENDAMPING" && !profile) {
      return NextResponse.json({ message: "Profil pendamping tidak ditemukan" }, { status: 403 });
    }

    if (!kpmId || !slotNo || !componentType || !nama || !nik) {
      return NextResponse.json({ message: "Jenis komponen, nama, dan NIK anggota wajib diisi" }, { status: 400 });
    }
    if (nik.length !== 16) {
      return NextResponse.json({ message: "NIK anggota harus terdiri dari 16 angka" }, { status: 400 });
    }

    const kpm = await query<{
      id: number;
      hamil: number;
      aud: number;
      lansia: number;
      disabilitas: number;
      noKk: string;
      alamat: string;
      rt: string;
      rw: string;
      desa: string;
      kecamatan: string;
      kabupaten: string;
    }>(
      `SELECT id, COALESCE(hamil, 0) AS hamil, COALESCE(aud, 0) AS aud,
              COALESCE(lansia, 0) AS lansia, COALESCE(disabil, 0) AS disabilitas,
              no_kk AS noKk,
              COALESCE(alamat, alamat_fc, '') AS alamat, COALESCE(rt, '') AS rt,
              COALESCE(rw, '') AS rw, COALESCE(kelurahan, '') AS desa,
              COALESCE(kecamatan, '') AS kecamatan, COALESCE(kabupaten, '') AS kabupaten
       FROM kpm_final_closing fc
       WHERE fc.id = ?
         ${profile ? "AND fc.pendamping_id = ?" : ""}
       LIMIT 1`,
      [kpmId, ...(profile ? [profile.id] : [])]
    );
    if (!kpm[0] || slotNo > componentCount(kpm[0], componentType)) {
      return NextResponse.json({ message: "Slot komponen kesehatan tidak ditemukan" }, { status: 404 });
    }

    const duplicate = await query<{ id: number; noKk: string }>(
      "SELECT id, no_kk AS noKk FROM art_members WHERE nik = ? AND NOT (entry_source = 'MANUAL' AND health_kpm_id = ? AND health_component_type = ? AND health_slot_no = ?) LIMIT 1",
      [nik, kpmId, componentType, slotNo]
    );
    if (duplicate[0]) {
      return NextResponse.json({
        message: duplicate[0].noKk === kpm[0].noKk
          ? "NIK tersebut sudah terdaftar sebagai anggota pada KK ini"
          : "NIK tersebut sudah digunakan pada nomor KK lain di Data ART"
      }, { status: 400 });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        "DELETE FROM art_members WHERE entry_source = 'MANUAL' AND health_kpm_id = ? AND health_component_type = ? AND health_slot_no = ?",
        [kpmId, componentType, slotNo]
      );
      await connection.execute(
        "DELETE FROM art_members WHERE no_kk = ? AND nik = ?",
        [kpm[0].noKk, nik]
      );
      const [batchResult] = await connection.execute(
        "INSERT INTO import_batches (type, year, stage, district_id, file_name, uploaded_by) VALUES ('ART', ?, ?, NULL, ?, ?)",
        [activePeriod.year, activePeriod.stage, "Input manual Verifikasi Kesehatan", user.id]
      );
      const batchId = Number((batchResult as any).insertId);
      await connection.execute(
        `INSERT INTO art_members
         (import_batch_id, no_kk, nik, nama, komponen, alamat, rt, rw, desa, kecamatan, kabupaten,
          status, periode, entry_source, health_kpm_id, health_slot_no, health_component_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INPUT MANUAL', ?, 'MANUAL', ?, ?, ?)`,
        [batchId, kpm[0].noKk, nik, nama, artComponentLabel(componentType), kpm[0].alamat, kpm[0].rt, kpm[0].rw, kpm[0].desa, kpm[0].kecamatan, kpm[0].kabupaten, `${activePeriod.year} Tahap ${activePeriod.stage}`, kpmId, slotNo, componentType]
      );
      await connection.execute(
        "INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'UPSERT', 'art_members', ?, ?)",
        [user.id, `${kpmId}-${componentType}-${slotNo}`, `Melengkapi identitas ${componentLabel(componentType)} ${nama} ke Data ART dari Verifikasi Kesehatan`]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return NextResponse.json({ ok: true, kpmId, slotNo, componentType, nik, nama, source: "ART_MANUAL" });
  } catch (error: any) {
    console.error("Gagal menyimpan identitas komponen kesehatan", error);
    return NextResponse.json({ message: error?.sqlMessage ?? error?.message ?? "Gagal menyimpan identitas anggota" }, { status: 500 });
  }
}

function normalizeComponentType(value: unknown): HealthComponentType | null {
  return ["HAMIL", "AUD", "LANSIA", "DISABILITAS"].includes(String(value))
    ? String(value) as HealthComponentType
    : null;
}

function componentCount(kpm: { hamil: number; aud: number; lansia: number; disabilitas: number }, type: HealthComponentType) {
  return Number(type === "HAMIL" ? kpm.hamil : type === "AUD" ? kpm.aud : type === "LANSIA" ? kpm.lansia : kpm.disabilitas);
}

function artComponentLabel(type: HealthComponentType) {
  return type === "HAMIL" ? "IBU HAMIL" : type === "AUD" ? "USIA DINI" : type;
}

function componentLabel(type: HealthComponentType) {
  return type === "HAMIL" ? "Ibu Hamil" : type === "AUD" ? "Anak Usia Dini (AUD)" : type === "LANSIA" ? "Lansia" : "Disabilitas";
}
