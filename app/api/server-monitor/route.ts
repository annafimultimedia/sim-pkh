import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerMonitorData } from "@/lib/server-monitor";
import { saveMaintenanceSettings } from "@/lib/maintenance";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const headers = request.headers;
  const data = await getServerMonitorData({
    cloudflare: Boolean(headers.get("cf-ray")),
    host: headers.get("x-forwarded-host") || headers.get("host") || "-",
    protocol: headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "")
  });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const enabled = Boolean(body.enabled);
  const message = String(body.message ?? "");
  const maintenance = await saveMaintenanceSettings(enabled, message);
  await query(
    "INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'UPDATE', 'maintenance', ?)",
    [user.id, `${enabled ? "Mengaktifkan" : "Menonaktifkan"} mode maintenance`]
  );
  return NextResponse.json({ maintenance });
}
