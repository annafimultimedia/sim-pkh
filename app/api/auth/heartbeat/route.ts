import { NextResponse } from "next/server";
import { ensureSessionTokenColumn, getOptionalSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST() {
  const user = await getOptionalSession();
  if (!user?.sessionToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await ensureSessionTokenColumn();
  await query(
    "UPDATE users SET last_seen_at = NOW() WHERE id = ? AND current_session_token = ?",
    [user.id, user.sessionToken]
  );

  return NextResponse.json({ ok: true });
}
