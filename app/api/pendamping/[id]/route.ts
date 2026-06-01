import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureP2k2GroupAreaColumns, ensurePendampingAssignmentHistoryTable, getActivePeriod } from "@/lib/data";

const defaultPassword = "pkh123";

async function getProfile(id: number) {
  const activePeriod = await getActivePeriod();
  const rows = await query<{ id: number; user_id: number; district_id: string; regency_id: string; kpm_count: number }>(
    `SELECT p.id, p.user_id, p.district_id, p.regency_id,
            SUM(CASE WHEN k.year = ? AND k.stage = ? THEN 1 ELSE 0 END) AS kpm_count
     FROM pendamping_profiles p
     LEFT JOIN kpm_final_closing k ON k.pendamping_id = p.id
     WHERE p.id = ?
     GROUP BY p.id, p.user_id, p.district_id, p.regency_id
     LIMIT 1`,
    [activePeriod.year, activePeriod.stage, id]
  );
  return rows[0];
}

async function recordAssignmentMove(profile: { id: number; user_id: number; district_id: string; regency_id: string }, next: { id: string; regency_id: string }) {
  if (profile.district_id === next.id) return;
  await ensurePendampingAssignmentHistoryTable();
  await query(
    "UPDATE pendamping_assignment_history SET ended_at = CURDATE() WHERE pendamping_id = ? AND ended_at IS NULL",
    [profile.id]
  );
  await query(
    "INSERT INTO pendamping_assignment_history (pendamping_id, user_id, district_id, regency_id, started_at, note) VALUES (?, ?, ?, ?, CURDATE(), ?)",
    [profile.id, profile.user_id, next.id, next.regency_id, "Pindah kecamatan tugas dari menu pendamping"]
  );
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const profileId = Number(id);
  const body = await request.json();
  const profile = await getProfile(profileId);
  if (!profile) return NextResponse.json({ message: "Pendamping tidak ditemukan" }, { status: 404 });
  await ensureP2k2GroupAreaColumns();

  const districtRows = await query<{ id: string; regency_id: string }>("SELECT id, regency_id FROM reg_districts WHERE id = ? LIMIT 1", [String(body.districtId ?? "")]);
  const district = districtRows[0];
  if (!district) return NextResponse.json({ message: "Kecamatan tugas tidak valid" }, { status: 400 });
  const isMovingDistrict = profile.district_id !== district.id;
  const activeKpmCount = Number(profile.kpm_count);
  const confirmedMove = Boolean(body.confirmMove);
  if (isMovingDistrict && activeKpmCount > 0 && !confirmedMove) {
    return NextResponse.json({ message: `Pendamping masih memiliki ${activeKpmCount} KPM pada periode aktif. Konfirmasi pindah tugas diperlukan untuk melepas mapping KPM otomatis.` }, { status: 409 });
  }

  await recordAssignmentMove(profile, district);
  if (isMovingDistrict && activeKpmCount > 0) {
    const activePeriod = await getActivePeriod();
    await query(
      "UPDATE kpm_final_closing SET pendamping_id = NULL, mapped_at = NULL WHERE pendamping_id = ? AND year = ? AND stage = ?",
      [profile.id, activePeriod.year, activePeriod.stage]
    );
  }
  if (isMovingDistrict) {
    const activePeriod = await getActivePeriod();
    await query(
      "UPDATE p2k2_groups SET archived_at = CURRENT_TIMESTAMP WHERE pendamping_id = ? AND year = ? AND stage = ? AND archived_at IS NULL",
      [profile.id, activePeriod.year, activePeriod.stage]
    );
  }
  await query("UPDATE users SET name = ?, nik = ?, nip = ?, regency_id = ?, district_id = ? WHERE id = ?", [body.nama, body.nik, body.nip || null, district.regency_id, district.id, profile.user_id]);
  await query("UPDATE pendamping_profiles SET name = ?, nik = ?, nip = ?, regency_id = ?, district_id = ? WHERE id = ?", [body.nama, body.nik, body.nip || null, district.regency_id, district.id, profile.id]);
  await query("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'UPDATE', 'pendamping_profiles', ?, ?)", [
    user.id,
    String(profile.id),
    isMovingDistrict && activeKpmCount > 0
      ? `Pindah tugas pendamping ${body.nama}; ${activeKpmCount} KPM periode aktif dilepas dari mapping`
      : `Update pendamping ${body.nama}`
  ]);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const profileId = Number(id);
  const body = await request.json();
  const isActive = Boolean(body.isActive);
  const profile = await getProfile(profileId);
  if (!profile) return NextResponse.json({ message: "Pendamping tidak ditemukan" }, { status: 404 });

  await query("UPDATE users SET is_active = ? WHERE id = ?", [isActive ? 1 : 0, profile.user_id]);
  await query("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'UPDATE', 'users', ?, ?)", [user.id, String(profile.user_id), `${isActive ? "Aktifkan" : "Nonaktifkan"} user pendamping ${profileId}`]);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const profileId = Number(id);
  const body = await request.json();
  if (body.action !== "reset-password") return NextResponse.json({ message: "Aksi tidak valid" }, { status: 400 });
  const profile = await getProfile(profileId);
  if (!profile) return NextResponse.json({ message: "Pendamping tidak ditemukan" }, { status: 404 });

  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  await query("UPDATE users SET password_hash = ?, current_session_token = NULL WHERE id = ?", [passwordHash, profile.user_id]);
  await query("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'RESET_PASSWORD', 'users', ?, ?)", [user.id, String(profile.user_id), `Reset password pendamping ${profileId} ke default`]);
  return NextResponse.json({ ok: true, defaultPassword });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const profileId = Number(id);
  const profile = await getProfile(profileId);
  if (!profile) return NextResponse.json({ message: "Pendamping tidak ditemukan" }, { status: 404 });
  if (Number(profile.kpm_count) > 0) {
    return NextResponse.json({ message: `Pendamping masih memiliki ${profile.kpm_count} KPM. Keluarkan/mapping ulang KPM terlebih dahulu sebelum dihapus.` }, { status: 409 });
  }
  await query("DELETE FROM pendamping_profiles WHERE id = ?", [profile.id]);
  await query("UPDATE users SET is_active = 0 WHERE id = ?", [profile.user_id]);
  await query("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'DELETE', 'pendamping_profiles', ?, 'Hapus/nonaktifkan pendamping')", [user.id, String(profile.id)]);
  return NextResponse.json({ ok: true });
}
