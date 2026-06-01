import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  const user = await getSession();
  const { ids, pendampingId } = await request.json();
  const kpmIds = Array.isArray(ids) ? ids.map(Number).filter(Boolean) : [];
  if (!kpmIds.length) return NextResponse.json({ message: "Tidak ada KPM dipilih" }, { status: 400 });

  let targetPendampingId = Number(pendampingId);
  if (user.role === "PENDAMPING") {
    const rows = await query<{ id: number }>("SELECT id FROM pendamping_profiles WHERE user_id = ? LIMIT 1", [user.id]);
    targetPendampingId = rows[0]?.id;
  }
  if (!targetPendampingId) return NextResponse.json({ message: "Pendamping tidak ditemukan" }, { status: 404 });

  const placeholders = kpmIds.map(() => "?").join(",");
  await query(
    `UPDATE kpm_final_closing
     SET pendamping_id = ?, mapped_at = CURRENT_TIMESTAMP
     WHERE id IN (${placeholders})`,
    [targetPendampingId, ...kpmIds]
  );
  await query(
    "INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'MAPPING', 'kpm_final_closing', ?)",
    [user.id, `Mapping ${kpmIds.length} KPM ke pendamping ${targetPendampingId}`]
  );
  return NextResponse.json({ ok: true });
}
