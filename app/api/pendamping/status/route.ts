import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function PATCH(request: Request) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
  const isActive = Boolean(body.isActive);
  if (!ids.length) return NextResponse.json({ message: "Pilih minimal satu pendamping" }, { status: 400 });

  const placeholders = ids.map(() => "?").join(",");
  const profiles = await query<{ id: number; user_id: number }>(`SELECT id, user_id FROM pendamping_profiles WHERE id IN (${placeholders})`, ids);
  if (!profiles.length) return NextResponse.json({ message: "Pendamping tidak ditemukan" }, { status: 404 });

  const userIds = profiles.map((profile) => profile.user_id);
  await query(`UPDATE users SET is_active = ? WHERE id IN (${userIds.map(() => "?").join(",")})`, [isActive ? 1 : 0, ...userIds]);
  await query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'UPDATE', 'users', ?)", [user.id, `${isActive ? "Aktifkan" : "Nonaktifkan"} ${profiles.length} user pendamping`]);

  return NextResponse.json({ ok: true, updated: profiles.length });
}
