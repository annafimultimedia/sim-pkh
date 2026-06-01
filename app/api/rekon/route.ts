import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureRekonTables, getPendampingProfileForUser } from "@/lib/data";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  const user = await getSession();
  if (!["ADMIN", "PENDAMPING"].includes(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  await ensureRekonTables();

  const form = await request.formData();
  const kpmId = Number(form.get("kpmId"));
  const nik = String(form.get("nik") ?? "").trim();
  const groupId = Number(form.get("groupId"));
  const pendampingId = Number(form.get("pendampingId"));
  const year = Number(form.get("year"));
  const stage = Number(form.get("stage"));
  const status = String(form.get("status") ?? "SUDAH_TRANSAKSI") === "BELUM_TRANSAKSI" ? "BELUM_TRANSAKSI" : "SUDAH_TRANSAKSI";

  if (!nik || !groupId || !pendampingId || !year || !stage) return NextResponse.json({ message: "Data rekon tidak lengkap" }, { status: 400 });
  if (user.role === "PENDAMPING") {
    const profile = await getPendampingProfileForUser(user.id);
    if (!profile || profile.id !== pendampingId) return NextResponse.json({ message: "KPM bukan akses Anda" }, { status: 403 });
  }

  const rows = await query<{ id: number }>(
    `SELECT k.id
     FROM kpm_final_closing k
     JOIN p2k2_groups g ON g.id = ?
     WHERE k.nik = ? AND k.year = ? AND k.stage = ? AND k.pendamping_id = ? AND g.pendamping_id = ?
     LIMIT 1`,
    [groupId, nik, year, stage, pendampingId, pendampingId]
  );
  if (!rows[0]) return NextResponse.json({ message: "KPM tidak ditemukan pada periode aktif/kelompok ini" }, { status: 404 });

  await query(
    `INSERT INTO rekon_transactions
     (kpm_id, kpm_nik, group_id, pendamping_id, year, stage, status, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       kpm_id = VALUES(kpm_id),
       group_id = VALUES(group_id),
       pendamping_id = VALUES(pendamping_id),
       status = VALUES(status),
       updated_by = VALUES(updated_by)`,
    [kpmId || rows[0].id, nik, groupId, pendampingId, year, stage, status, user.id]
  );
  await query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'UPDATE', 'rekon_transactions', ?)", [user.id, `Update rekon ${nik} tahun ${year} tahap ${stage}: ${status}`]);

  return NextResponse.json({ ok: true, status });
}

export async function PATCH(request: Request) {
  const user = await getSession();
  if (!["ADMIN", "PENDAMPING"].includes(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  await ensureRekonTables();

  const body = await request.json();
  const items = Array.isArray(body.items) ? body.items : [];
  const year = Number(body.year);
  const stage = Number(body.stage);
  const status = String(body.status ?? "") === "SUDAH_TRANSAKSI" ? "SUDAH_TRANSAKSI" : "BELUM_TRANSAKSI";

  if (!year || !stage || !items.length) return NextResponse.json({ message: "Data bulk rekon tidak lengkap" }, { status: 400 });

  const profile = user.role === "PENDAMPING" ? await getPendampingProfileForUser(user.id) : null;
  let updated = 0;

  for (const item of items) {
    const nik = String(item.nik ?? "").trim();
    const groupId = Number(item.groupId);
    const pendampingId = Number(item.pendampingId);
    const kpmId = Number(item.kpmId);
    if (!nik || !groupId || !pendampingId) continue;
    if (profile && profile.id !== pendampingId) continue;

    const rows = await query<{ id: number }>(
      `SELECT k.id
       FROM kpm_final_closing k
       JOIN p2k2_groups g ON g.id = ?
       WHERE k.nik = ? AND k.year = ? AND k.stage = ? AND k.pendamping_id = ? AND g.pendamping_id = ?
       LIMIT 1`,
      [groupId, nik, year, stage, pendampingId, pendampingId]
    );
    if (!rows[0]) continue;

    await query(
      `INSERT INTO rekon_transactions
       (kpm_id, kpm_nik, group_id, pendamping_id, year, stage, status, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         kpm_id = VALUES(kpm_id),
         group_id = VALUES(group_id),
         pendamping_id = VALUES(pendamping_id),
         status = VALUES(status),
         updated_by = VALUES(updated_by)`,
      [kpmId || rows[0].id, nik, groupId, pendampingId, year, stage, status, user.id]
    );
    updated += 1;
  }

  await query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'UPDATE', 'rekon_transactions', ?)", [user.id, `Bulk update rekon ${updated} KPM tahun ${year} tahap ${stage}: ${status}`]);
  return NextResponse.json({ ok: true, updated, status });
}
