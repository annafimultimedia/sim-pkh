import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureDeadlineTaskTables, getDeadlineTasks } from "@/lib/data";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const dueDate = String(body.dueDate ?? "").trim();
  const targetRole = ["ALL", "ADMIN", "PENDAMPING"].includes(body.targetRole) ? body.targetRole : "ALL";
  const districtId = String(body.districtId ?? "").trim();

  if (!title) return NextResponse.json({ message: "Nama tugas wajib diisi" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return NextResponse.json({ message: "Deadline wajib diisi" }, { status: 400 });

  await ensureDeadlineTaskTables();
  const result = await query<any>(
    "INSERT INTO deadline_tasks (title, description, due_date, target_role, district_id, created_by) VALUES (?, ?, ?, ?, ?, ?)",
    [title, description, dueDate, targetRole, districtId || null, user.id]
  ) as any;
  await query("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'CREATE', 'deadline_tasks', ?, ?)", [
    user.id,
    String(result?.insertId ?? ""),
    `Tambah tugas deadline: ${title}`
  ]);
  const tasks = await getDeadlineTasks(user);
  const task = tasks.find((item) => item.id === Number(result?.insertId));
  return NextResponse.json({ ok: true, id: result?.insertId, task });
}
