import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/notification-reads";

export async function POST(request: Request) {
  const user = await getSession();
  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [String(body.id ?? "")];
  await markNotificationsRead(user.id, ids);
  return NextResponse.json({ ok: true });
}
