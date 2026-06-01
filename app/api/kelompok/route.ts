import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pool, query } from "@/lib/db";
import { ensureP2k2GroupAreaColumns, getPendampingProfileForUser } from "@/lib/data";

export async function POST(request: Request) {
  const user = await getSession();
  if (user.role !== "PENDAMPING") return NextResponse.json({ message: "Hanya pendamping yang dapat membuat kelompok" }, { status: 403 });
  const profile = await getPendampingProfileForUser(user.id);
  if (!profile) return NextResponse.json({ message: "Profil pendamping tidak ditemukan" }, { status: 404 });
  const { name, year, stage } = await request.json();
  if (!String(name ?? "").trim()) return NextResponse.json({ message: "Nama kelompok wajib diisi" }, { status: 400 });
  await ensureP2k2GroupAreaColumns();
  const [result] = await pool.execute(
    "INSERT INTO p2k2_groups (name, pendamping_id, district_id, regency_id, year, stage) VALUES (?, ?, ?, ?, ?, ?)",
    [String(name).trim(), profile.id, profile.district_id, profile.regency_id, Number(year || new Date().getFullYear()), Number(stage || 1)]
  );
  const id = Number((result as any).insertId);
  await query("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'CREATE', 'p2k2_groups', ?, ?)", [user.id, String(id), `Membuat kelompok ${name}`]);
  return NextResponse.json({ id });
}
