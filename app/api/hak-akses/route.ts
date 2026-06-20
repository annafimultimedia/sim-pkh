import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureMenuAccessTable, pendampingMenuOptions } from "@/lib/menu-access";
import { query } from "@/lib/db";

export async function PUT(request: Request) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const requested = new Set(Array.isArray(body.menuKeys) ? body.menuKeys.map(String) : []);
  const validKeys = new Set(pendampingMenuOptions.map((item) => item.key));
  await ensureMenuAccessTable();

  for (const item of pendampingMenuOptions) {
    await query(
      `INSERT INTO role_menu_access (role, menu_key, is_enabled)
       VALUES ('PENDAMPING', ?, ?)
       ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled)`,
      [item.key, requested.has(item.key) && validKeys.has(item.key) ? 1 : 0]
    );
  }

  await query(
    "INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'UPDATE', 'role_menu_access', ?)",
    [user.id, `Memperbarui hak akses menu Pendamping: ${requested.size} menu aktif`]
  );
  return NextResponse.json({ ok: true });
}

