import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { ensureProfilePhotoColumn, ensureSessionTokenColumn, setSession } from "@/lib/auth";
import { demoUsers } from "@/lib/sample-data";
import { query } from "@/lib/db";
import { SessionUser } from "@/lib/types";

export async function POST(request: Request) {
  const { username, password } = await request.json();
  const login = String(username ?? "").toLowerCase();
  try {
    await ensureProfilePhotoColumn();
    const rows = await query<{
      id: number;
      username: string;
      password_hash: string;
      role: "ADMIN" | "PENDAMPING";
      name: string;
      nip: string | null;
      regency_id: string | null;
      district_id: string | null;
      regency: string | null;
      district: string | null;
      profile_photo_path: string | null;
    }>(
      `SELECT u.id, u.username, u.password_hash, u.role, u.name, u.nip, u.regency_id, u.district_id,
              u.profile_photo_path, r.name AS regency, d.name AS district
       FROM users u
       LEFT JOIN reg_regencies r ON r.id = u.regency_id
       LEFT JOIN reg_districts d ON d.id = u.district_id
       WHERE u.username = ? AND u.is_active = 1
       LIMIT 1`,
      [login]
    );
    const user = rows[0];
    if (user && (await bcrypt.compare(String(password ?? ""), user.password_hash))) {
      await ensureSessionTokenColumn();
      const sessionToken = randomUUID();
      const session: SessionUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        regency: user.regency ?? "KABUPATEN JEMBER",
        regencyId: user.regency_id ?? undefined,
        district: user.district ?? undefined,
        districtId: user.district_id ?? undefined,
        nip: user.nip ?? undefined,
        photoPath: user.profile_photo_path ?? undefined,
        sessionToken
      };
      await query("UPDATE users SET current_session_token = ?, last_seen_at = NOW() WHERE id = ?", [sessionToken, user.id]);
      await setSession(session);
      await query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'LOGIN', 'auth', ?)", [session.id, `Login berhasil: ${session.name} (${session.role})`]);
      return NextResponse.json({ user: session });
    }
  } catch (error) {
    console.error("Login MySQL gagal, memakai fallback demo", error);
  }

  if (process.env.ALLOW_DEMO_LOGIN === "1") {
    const user = demoUsers[login];
    if (user && user.password === password) {
      const { password: _password, ...demoSession } = user;
      const session = { ...demoSession, sessionToken: `demo:${randomUUID()}` };
      await setSession(session);
      return NextResponse.json({ user: session });
    }
  }
  return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
}
