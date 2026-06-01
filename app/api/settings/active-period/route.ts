import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSettingsTable } from "@/lib/data";
import { query } from "@/lib/db";

export async function PUT(request: Request) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { year, stage, appName } = await request.json();
  const activeYear = Number(year);
  const activeStage = Number(stage);
  const systemName = String(appName ?? "").trim();
  if (!activeYear || ![1, 2, 3, 4].includes(activeStage)) {
    return NextResponse.json({ message: "Tahun atau tahap tidak valid" }, { status: 400 });
  }
  if (!systemName) return NextResponse.json({ message: "Nama aplikasi wajib diisi" }, { status: 400 });
  await ensureSettingsTable();
  await query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('active_year', ?), ('active_stage', ?), ('app_name', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [String(activeYear), String(activeStage), systemName]);
  await query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'UPDATE', 'app_settings', ?)", [user.id, `Set nama aplikasi ${systemName}, periode aktif ${activeYear} tahap ${activeStage}`]);
  return NextResponse.json({ ok: true });
}
