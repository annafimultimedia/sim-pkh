import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getPendampingProfileForUser } from "@/lib/data";

async function canDeleteGroup(groupId: number, userId: number, role: string) {
  if (role === "ADMIN") {
    const rows = await query<{ id: number; name: string }>("SELECT id, name FROM p2k2_groups WHERE id = ? LIMIT 1", [groupId]);
    return rows[0] ?? null;
  }
  const profile = await getPendampingProfileForUser(userId);
  if (!profile) return null;
  const rows = await query<{ id: number; name: string }>("SELECT id, name FROM p2k2_groups WHERE id = ? AND pendamping_id = ? LIMIT 1", [groupId, profile.id]);
  return rows[0] ?? null;
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!["ADMIN", "PENDAMPING"].includes(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const groupId = Number(id);
  if (!groupId) return NextResponse.json({ message: "Kelompok tidak valid" }, { status: 400 });
  const group = await canDeleteGroup(groupId, user.id, user.role);
  if (!group) return NextResponse.json({ message: "Kelompok tidak ditemukan atau bukan milik Anda" }, { status: 404 });

  await query("DELETE FROM p2k2_group_members WHERE group_id = ?", [groupId]);
  await query("DELETE FROM p2k2_groups WHERE id = ?", [groupId]);
  await query("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'DELETE', 'p2k2_groups', ?, ?)", [user.id, String(groupId), `Menghapus kelompok ${group.name} dan mengeluarkan semua KPM dari kelompok`]);

  return NextResponse.json({ ok: true });
}
