import { NextResponse } from "next/server";
import { createDatabaseBackup, getBackupFiles, getBackupSettings, maybeRunScheduledBackup, readBackupFile, restoreDatabaseBackup, saveBackupSettings } from "@/lib/backup";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const file = url.searchParams.get("file");
  if (file) {
    const backup = await readBackupFile(file);
    await query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'DOWNLOAD', 'backup', ?)", [user.id, `Download backup ${backup.fileName}`]);
    return new NextResponse(backup.data, {
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="${backup.fileName}"`
      }
    });
  }
  const [settings, files] = await Promise.all([getBackupSettings(), getBackupFiles()]);
  return NextResponse.json({ settings, files });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const form = await request.formData();
  const action = String(form.get("action") ?? "");

  if (action === "create") {
    const backup = await createDatabaseBackup();
    await query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'CREATE', 'backup', ?)", [user.id, `Membuat backup ${backup.fileName}`]);
    return NextResponse.json({ ok: true, fileName: backup.fileName, files: await getBackupFiles() });
  }

  if (action === "settings") {
    const enabled = String(form.get("enabled") ?? "") === "1";
    const time = String(form.get("time") ?? "22:00");
    const keep = Math.max(1, Math.min(60, Number(form.get("keep") ?? 7)));
    const current = await getBackupSettings();
    await saveBackupSettings({ ...current, enabled, time, keep });
    await query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'UPDATE', 'backup_settings', ?)", [user.id, `Update jadwal backup ${enabled ? "aktif" : "nonaktif"} jam ${time}`]);
    return NextResponse.json({ ok: true, settings: await getBackupSettings() });
  }

  if (action === "restore") {
    const file = form.get("file");
    const confirm = String(form.get("confirm") ?? "");
    if (confirm !== "SAYA YAKIN") return NextResponse.json({ message: "Ketik SAYA YAKIN untuk restore database" }, { status: 400 });
    if (!(file instanceof File) || !file.name.endsWith(".sql")) return NextResponse.json({ message: "File restore harus SQL" }, { status: 400 });
    const sql = await file.text();
    await restoreDatabaseBackup(sql);
    await query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'RESTORE', 'backup', ?)", [user.id, `Restore database dari ${file.name}`]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: "Action tidak dikenal" }, { status: 400 });
}

export async function PUT() {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const result = await maybeRunScheduledBackup();
  return NextResponse.json(result);
}
