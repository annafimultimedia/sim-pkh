import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureDeadlineTaskTables } from "@/lib/data";
import { query } from "@/lib/db";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  const { id } = await params;
  const taskId = Number(id);
  if (!taskId) return NextResponse.json({ message: "Tugas tidak ditemukan" }, { status: 404 });

  await ensureDeadlineTaskTables();
  await query("INSERT INTO deadline_task_completions (task_id, user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE completed_at = CURRENT_TIMESTAMP", [taskId, user.id]);
  await query("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'UPDATE', 'deadline_tasks', ?, 'Tandai tugas selesai')", [user.id, String(taskId)]);
  return NextResponse.json({ ok: true });
}
