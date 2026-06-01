import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureGroupMemberNikColumn, getPendampingProfileForUser } from "@/lib/data";

async function ensureOwner(groupId: number, userId: number) {
  const profile = await getPendampingProfileForUser(userId);
  if (!profile) return null;
  const rows = await query<{ id: number }>("SELECT id FROM p2k2_groups WHERE id = ? AND pendamping_id = ? LIMIT 1", [groupId, profile.id]);
  return rows[0] ? profile : null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (user.role !== "PENDAMPING") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const groupId = Number(id);
  await ensureGroupMemberNikColumn();
  const profile = await ensureOwner(groupId, user.id);
  if (!profile) return NextResponse.json({ message: "Kelompok tidak ditemukan atau bukan milik Anda" }, { status: 404 });
  const { kpmId, kpmNik, checked } = await request.json();
  const kpmRows = await query<{ id: number; nik: string }>("SELECT id, nik FROM kpm_final_closing WHERE id = ? AND pendamping_id = ? LIMIT 1", [Number(kpmId), profile.id]);
  if (!kpmRows[0]) return NextResponse.json({ message: "KPM bukan dampingan Anda" }, { status: 403 });
  const nik = String(kpmNik || kpmRows[0].nik);
  if (checked) {
    await query(
      `DELETE gm FROM p2k2_group_members gm
       JOIN p2k2_groups g ON g.id = gm.group_id
       LEFT JOIN kpm_final_closing k ON k.id = gm.kpm_id
       WHERE g.pendamping_id = ? AND gm.group_id <> ? AND COALESCE(gm.kpm_nik, k.nik) = ?`,
      [profile.id, groupId, nik]
    );
    await query(
      `DELETE gm FROM p2k2_group_members gm
       LEFT JOIN kpm_final_closing k ON k.id = gm.kpm_id
       WHERE gm.group_id = ? AND COALESCE(gm.kpm_nik, k.nik) = ? AND gm.kpm_id <> ?`,
      [groupId, nik, Number(kpmId)]
    );
    await query("INSERT IGNORE INTO p2k2_group_members (group_id, kpm_id, kpm_nik) VALUES (?, ?, ?)", [groupId, Number(kpmId), nik]);
  } else {
    await query(
      `DELETE gm FROM p2k2_group_members gm
       LEFT JOIN kpm_final_closing k ON k.id = gm.kpm_id
       WHERE gm.group_id = ? AND COALESCE(gm.kpm_nik, k.nik) = ?`,
      [groupId, nik]
    );
  }
  return NextResponse.json({ ok: true });
}
