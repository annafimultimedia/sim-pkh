import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pool, query } from "@/lib/db";
import { ensureGroupMemberNikColumn, getActivePeriod, getPendampingProfileForUser } from "@/lib/data";

export async function POST() {
  const user = await getSession();
  if (!["ADMIN", "PENDAMPING"].includes(user.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await ensureGroupMemberNikColumn();
  const activePeriod = await getActivePeriod();
  const profile = user.role === "PENDAMPING" ? await getPendampingProfileForUser(user.id) : null;
  if (user.role === "PENDAMPING" && !profile) {
    return NextResponse.json({ message: "Profil pendamping tidak ditemukan" }, { status: 404 });
  }

  const groupRows = await query<{ id: number; pendamping_id: number }>(
    `SELECT id, pendamping_id
     FROM p2k2_groups
     WHERE archived_at IS NULL ${profile ? "AND pendamping_id = ?" : ""}`,
    profile ? [profile.id] : []
  );
  if (!groupRows.length) return NextResponse.json({ groups: 0, checked: 0, matched: 0, missing: 0 });

  const groupIds = groupRows.map((group) => group.id);
  const groupPendamping = new Map(groupRows.map((group) => [group.id, group.pendamping_id]));
  const placeholders = groupIds.map(() => "?").join(",");
  const memberRows = await query<{ id: number; group_id: number; nik: string | null }>(
    `SELECT gm.id, gm.group_id, COALESCE(gm.kpm_nik, k.nik) AS nik
     FROM p2k2_group_members gm
     LEFT JOIN kpm_final_closing k ON k.id = gm.kpm_id
     WHERE gm.group_id IN (${placeholders})`,
    groupIds
  );
  const members = memberRows.filter((row) => row.nik);
  if (!members.length) return NextResponse.json({ groups: groupRows.length, checked: 0, matched: 0, missing: 0 });

  const activeRows = await query<{ id: number; nik: string; pendamping_id: number | null }>(
    "SELECT id, nik, pendamping_id FROM kpm_final_closing WHERE year = ? AND stage = ?",
    [activePeriod.year, activePeriod.stage]
  );
  const activeByPendampingNik = new Map(activeRows.map((row) => [`${row.pendamping_id ?? 0}|${row.nik}`, row]));

  const connection = await pool.getConnection();
  let matched = 0;
  let missing = 0;
  try {
    await connection.beginTransaction();
    for (const member of members) {
      const nik = String(member.nik);
      const pendampingId = groupPendamping.get(member.group_id) ?? 0;
      const activeKpm = activeByPendampingNik.get(`${pendampingId}|${nik}`);
      await connection.execute(
        `DELETE gm FROM p2k2_group_members gm
         LEFT JOIN kpm_final_closing k ON k.id = gm.kpm_id
         WHERE gm.group_id = ? AND gm.id <> ? AND COALESCE(gm.kpm_nik, k.nik) = ?`,
        [member.group_id, member.id, nik]
      );
      if (activeKpm) {
        await connection.execute("UPDATE p2k2_group_members SET kpm_id = ?, kpm_nik = ? WHERE id = ?", [activeKpm.id, nik, member.id]);
        matched += 1;
      } else {
        await connection.execute("UPDATE p2k2_group_members SET kpm_id = NULL, kpm_nik = ? WHERE id = ?", [nik, member.id]);
        missing += 1;
      }
    }
    await connection.execute(
      "INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'SYNC', 'p2k2_group_members', ?)",
      [user.id, `Sinkron anggota kelompok ke periode aktif ${activePeriod.year} tahap ${activePeriod.stage}: ${matched} cocok, ${missing} tidak ditemukan`]
    );
    await connection.commit();
  } catch (error: any) {
    await connection.rollback();
    return NextResponse.json({ message: error?.sqlMessage ?? error?.message ?? "Gagal sinkronisasi anggota kelompok" }, { status: 500 });
  } finally {
    connection.release();
  }

  return NextResponse.json({ groups: groupRows.length, checked: members.length, matched, missing, activePeriod });
}
