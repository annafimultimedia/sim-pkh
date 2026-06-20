import { query } from "./db";

export type MaintenanceSettings = {
  enabled: boolean;
  message: string;
  updatedAt: string;
};

export async function getMaintenanceSettings(): Promise<MaintenanceSettings> {
  try {
    const rows = await query<{ setting_key: string; setting_value: string; updated_at: Date | string }>(
      "SELECT setting_key, setting_value, updated_at FROM app_settings WHERE setting_key IN ('maintenance_enabled', 'maintenance_message')"
    );
    const values = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
    const latest = rows.map((row) => new Date(row.updated_at).getTime()).filter(Number.isFinite).sort((a, b) => b - a)[0];
    return {
      enabled: values.maintenance_enabled === "1",
      message: values.maintenance_message || "Aplikasi sedang dalam pemeliharaan. Silakan coba kembali beberapa saat lagi.",
      updatedAt: latest ? new Date(latest).toISOString() : ""
    };
  } catch (error) {
    console.error("Gagal membaca pengaturan maintenance", error);
    return {
      enabled: false,
      message: "Aplikasi sedang dalam pemeliharaan. Silakan coba kembali beberapa saat lagi.",
      updatedAt: ""
    };
  }
}

export async function saveMaintenanceSettings(enabled: boolean, message: string) {
  await ensureMaintenanceSettings();
  const cleanMessage = message.trim().slice(0, 240) || "Aplikasi sedang dalam pemeliharaan. Silakan coba kembali beberapa saat lagi.";
  await query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES
       ('maintenance_enabled', ?), ('maintenance_message', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [enabled ? "1" : "0", cleanMessage]
  );
  return getMaintenanceSettings();
}

async function ensureMaintenanceSettings() {
  await query(`CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8`);
  await query(
    `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
      ('maintenance_enabled', '0'),
      ('maintenance_message', 'Aplikasi sedang dalam pemeliharaan. Silakan coba kembali beberapa saat lagi.')`
  );
}
