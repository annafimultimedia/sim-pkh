import { NextResponse } from "next/server";
import { clearCurrentSession, clearSession, getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST() {
  const user = await getSession();
  try {
    await query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'LOGOUT', 'auth', ?)", [user.id, `Logout: ${user.name} (${user.role})`]);
  } catch (error) {
    console.error("Gagal mencatat logout", error);
  }
  await clearCurrentSession(user);
  await clearSession();
  return NextResponse.json({ ok: true });
}
