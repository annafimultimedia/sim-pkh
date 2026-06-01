import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import { query } from "./db";
import { SessionUser } from "./types";

const cookieName = "sim_pkh_session";
const secret = process.env.JWT_SECRET ?? "sim-pkh-local-secret";
const idleTimeoutSeconds = 60 * 60;
let ensuredSessionColumns = false;
let ensuredProfilePhotoColumn = false;

export function signSession(user: SessionUser) {
  const { exp: _exp, iat: _iat, ...session } = user as SessionUser & { exp?: number; iat?: number };
  return jwt.sign(session, secret, { expiresIn: "8h" });
}

export async function ensureSessionTokenColumn() {
  if (ensuredSessionColumns) return;
  try {
    await query("ALTER TABLE users ADD COLUMN current_session_token VARCHAR(120) NULL");
  } catch (error: any) {
    if (error?.code !== "ER_DUP_FIELDNAME" && error?.errno !== 1060) {
      throw error;
    }
  }
  try {
    await query("ALTER TABLE users ADD COLUMN last_seen_at DATETIME NULL");
  } catch (error: any) {
    if (error?.code !== "ER_DUP_FIELDNAME" && error?.errno !== 1060) {
      throw error;
    }
  }
  ensuredSessionColumns = true;
}

export async function ensureProfilePhotoColumn() {
  if (ensuredProfilePhotoColumn) return;
  try {
    await query("ALTER TABLE users ADD COLUMN profile_photo_path VARCHAR(255) NULL");
  } catch (error: any) {
    if (error?.code !== "ER_DUP_FIELDNAME" && error?.errno !== 1060) {
      throw error;
    }
  }
  ensuredProfilePhotoColumn = true;
}

export async function getOptionalSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (!token) return null;
  try {
    const session = jwt.verify(token, secret) as SessionUser;
    if (!session.sessionToken) return null;
    if (process.env.ALLOW_DEMO_LOGIN === "1" && session.sessionToken.startsWith("demo:")) return session;
    await ensureSessionTokenColumn();
    await ensureProfilePhotoColumn();
    const rows = await query<{ current_session_token: string | null; idle_seconds: number | null; profile_photo_path: string | null }>(
      "SELECT current_session_token, profile_photo_path, TIMESTAMPDIFF(SECOND, last_seen_at, NOW()) AS idle_seconds FROM users WHERE id = ? AND is_active = 1 LIMIT 1",
      [session.id]
    );
    if (rows[0]?.current_session_token !== session.sessionToken) return null;
    if (rows[0]?.idle_seconds !== null && Number(rows[0]?.idle_seconds ?? 0) > idleTimeoutSeconds) {
      await query(
        "UPDATE users SET current_session_token = NULL, last_seen_at = NULL WHERE id = ? AND current_session_token = ?",
        [session.id, session.sessionToken]
      );
      try {
        await query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'AUTO_LOGOUT', 'auth', ?)", [session.id, `Logout otomatis karena tidak aktif lebih dari 1 jam: ${session.name}`]);
      } catch {}
      return null;
    }
    return { ...session, photoPath: rows[0]?.profile_photo_path ?? session.photoPath };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser> {
  const session = await getOptionalSession();
  if (!session) redirect("/login");
  return session;
}

export async function setSession(user: SessionUser) {
  const store = await cookies();
  store.set(cookieName, signSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(cookieName);
}

export async function clearCurrentSession(user: SessionUser) {
  if (!user.sessionToken) return;
  try {
    await ensureSessionTokenColumn();
    await query(
      "UPDATE users SET current_session_token = NULL, last_seen_at = NULL WHERE id = ? AND current_session_token = ?",
      [user.id, user.sessionToken]
    );
  } catch {}
}
