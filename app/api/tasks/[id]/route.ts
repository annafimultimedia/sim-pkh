import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureDeadlineTaskTables } from "@/lib/data";
import { query } from "@/lib/db";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const taskId = Number(id);
  if (!taskId) return NextResponse.json({ message: "Tugas tidak ditemukan" }, { status: 404 });

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const dueDate = String(body.dueDate ?? "").trim();
  const targetRole = ["ALL", "ADMIN", "PENDAMPING"].includes(body.targetRole) ? body.targetRole : "ALL";
  const districtId = String(body.districtId ?? "").trim();

  if (!title) return NextResponse.json({ message: "Nama tugas wajib diisi" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return NextResponse.json({ message: "Deadline wajib diisi" }, { status: 400 });

  await ensureDeadlineTaskTables();
  await query(
    "UPDATE deadline_tasks SET title = ?, description = ?, due_date = ?, target_role = ?, district_id = ? WHERE id = ? AND is_active = 1",
    [title, description, dueDate, targetRole, districtId || null, taskId]
  );
  await query("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'UPDATE', 'deadline_tasks', ?, ?)", [
    user.id,
    String(taskId),
    `Ubah tugas deadline: ${title}`
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const taskId = Number(id);
  if (!taskId) return NextResponse.json({ message: "Tugas tidak ditemukan" }, { status: 404 });

  await ensureDeadlineTaskTables();
  await query("UPDATE deadline_tasks SET is_active = 0 WHERE id = ?", [taskId]);
  await query("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'DELETE', 'deadline_tasks', ?, 'Nonaktifkan tugas deadline')", [user.id, String(taskId)]);
  return NextResponse.json({ ok: true });
}
