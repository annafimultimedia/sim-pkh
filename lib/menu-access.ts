import { SessionUser } from "./types";
import { query } from "./db";
import { redirect } from "next/navigation";

export const pendampingMenuOptions = [
  { key: "tracking", label: "Tracking & Komparasi", group: "Utama", defaultEnabled: true },
  { key: "final-closing", label: "Data Final Closing", group: "Manajemen Data", defaultEnabled: true },
  { key: "art", label: "Data ART", group: "Manajemen Data", defaultEnabled: true },
  { key: "kelompok", label: "Manajemen Kelompok", group: "Operasional Pendamping (P2K2)", defaultEnabled: true },
  { key: "absensi", label: "Cetak Absensi", group: "Operasional Pendamping (P2K2)", defaultEnabled: true },
  { key: "laporan-p2k2", label: "Laporan P2K2", group: "Operasional Pendamping (P2K2)", defaultEnabled: true },
  { key: "rekap-p2k2", label: "Rekap P2K2", group: "Operasional Pendamping (P2K2)", defaultEnabled: true },
  { key: "rekon", label: "Rekon", group: "Penyaluran", defaultEnabled: true },
  { key: "verifikasi-kesehatan", label: "Verifikasi Kesehatan", group: "Verifikasi", defaultEnabled: false },
  { key: "surat", label: "Surat-surat", group: "Arsip Surat", defaultEnabled: true }
] as const;

export type PendampingMenuKey = (typeof pendampingMenuOptions)[number]["key"];

let menuAccessEnsured = false;

export async function ensureMenuAccessTable() {
  if (menuAccessEnsured) return;
  await query(`CREATE TABLE IF NOT EXISTS role_menu_access (
    role ENUM('PENDAMPING') NOT NULL,
    menu_key VARCHAR(80) NOT NULL,
    is_enabled TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (role, menu_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8`);

  for (const item of pendampingMenuOptions) {
    await query(
      "INSERT IGNORE INTO role_menu_access (role, menu_key, is_enabled) VALUES ('PENDAMPING', ?, ?)",
      [item.key, item.defaultEnabled ? 1 : 0]
    );
  }
  menuAccessEnsured = true;
}

export async function getPendampingMenuAccess(): Promise<PendampingMenuKey[]> {
  await ensureMenuAccessTable();
  const rows = await query<{ menuKey: PendampingMenuKey }>(
    "SELECT menu_key AS menuKey FROM role_menu_access WHERE role = 'PENDAMPING' AND is_enabled = 1"
  );
  return rows.map((row) => row.menuKey);
}

export async function canAccessMenu(user: SessionUser, menuKey: PendampingMenuKey) {
  if (user.role === "ADMIN") return true;
  const enabled = await getPendampingMenuAccess();
  return enabled.includes(menuKey);
}

export async function requireMenuAccess(user: SessionUser, menuKey: PendampingMenuKey) {
  if (!(await canAccessMenu(user, menuKey))) redirect("/dashboard");
}
