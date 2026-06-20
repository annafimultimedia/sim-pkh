import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { pool, query } from "./db";

export type BackupSettings = {
  enabled: boolean;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  time: string;
  weekday: number;
  monthDay: number;
  keep: number;
  lastRun: string;
};

const backupDir = path.join(process.cwd(), "storage", "backups");

export async function ensureBackupSettings() {
  await query(`CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8`);
}

export async function getBackupSettings(): Promise<BackupSettings> {
  await ensureBackupSettings();
  const rows = await query<{ setting_key: string; setting_value: string }>(
    "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('backup_enabled', 'backup_frequency', 'backup_time', 'backup_weekday', 'backup_month_day', 'backup_keep', 'backup_last_run')"
  );
  const map = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  return {
    enabled: map.backup_enabled === "1",
    frequency: normalizeFrequency(map.backup_frequency),
    time: map.backup_time || "22:00",
    weekday: clampNumber(map.backup_weekday, 1, 7, 1),
    monthDay: clampNumber(map.backup_month_day, 1, 28, 1),
    keep: Number(map.backup_keep || 7),
    lastRun: map.backup_last_run || ""
  };
}

export async function saveBackupSettings(settings: BackupSettings) {
  await ensureBackupSettings();
  const values = [
    ["backup_enabled", settings.enabled ? "1" : "0"],
    ["backup_frequency", settings.frequency],
    ["backup_time", settings.time],
    ["backup_weekday", String(settings.weekday)],
    ["backup_month_day", String(settings.monthDay)],
    ["backup_keep", String(settings.keep)],
    ["backup_last_run", settings.lastRun || ""]
  ];
  for (const [key, value] of values) {
    await query(
      "INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [key, value]
    );
  }
}

export async function maybeRunScheduledBackup() {
  const settings = await getBackupSettings();
  if (!settings.enabled) return { created: false, reason: "disabled" };
  const now = new Date();
  const dueDate = latestDueDate(now, settings);
  if (!dueDate) return { created: false, reason: "not-due" };
  if (settings.lastRun >= dueDate) return { created: false, reason: "already-run" };
  const file = await createDatabaseBackup();
  await saveBackupSettings({ ...settings, lastRun: dueDate });
  await pruneBackups(settings.keep);
  return { created: true, file };
}

export async function createDatabaseBackup() {
  await mkdir(backupDir, { recursive: true });
  const database = process.env.MYSQL_DATABASE ?? "sim_pkh";
  const tables = await query<{ TABLE_NAME: string }>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
    [database]
  );
  const parts: string[] = [
    "-- Backup SIM PKH",
    `-- Database: ${database}`,
    `-- Waktu: ${new Date().toISOString()}`,
    "SET FOREIGN_KEY_CHECKS=0;"
  ];

  for (const table of tables) {
    const tableName = table.TABLE_NAME;
    const [createRows] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
    const createSql = (createRows as any[])[0]?.["Create Table"];
    parts.push("", `DROP TABLE IF EXISTS \`${tableName}\`;`, `${createSql};`);
    const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);
    for (const row of rows as Record<string, unknown>[]) {
      const columns = Object.keys(row).map((key) => `\`${key}\``).join(", ");
      const values = Object.values(row).map(sqlValue).join(", ");
      parts.push(`INSERT INTO \`${tableName}\` (${columns}) VALUES (${values});`);
    }
  }

  parts.push("SET FOREIGN_KEY_CHECKS=1;", "");
  const fileName = `backup-sim-pkh-${localDate(new Date())}-${compactTime(new Date())}.sql`;
  const fullPath = path.join(backupDir, fileName);
  await writeFile(fullPath, parts.join("\n"), "utf8");
  return { fileName, fullPath };
}

export async function restoreDatabaseBackup(sql: string) {
  const statements = splitSqlStatements(sql);
  const connection = await pool.getConnection();
  try {
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed || trimmed.startsWith("--")) continue;
      await connection.query(trimmed);
    }
  } finally {
    connection.release();
  }
}

export async function getBackupFiles() {
  await mkdir(backupDir, { recursive: true });
  const entries = await readdir(backupDir, { withFileTypes: true });
  const files = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map(async (entry) => {
      const fullPath = path.join(backupDir, entry.name);
      const info = await stat(fullPath);
      return {
        file: entry.name,
        ukuran: formatBytes(info.size),
        ukuranBytes: info.size,
        dibuat: new Date(info.mtimeMs).toLocaleString("id-ID")
      };
    }));
  return files.sort((a, b) => b.file.localeCompare(a.file));
}

export async function readBackupFile(fileName: string) {
  const safeName = path.basename(fileName);
  if (!safeName.endsWith(".sql")) throw new Error("Nama file backup tidak valid");
  const fullPath = path.join(backupDir, safeName);
  return { data: await readFile(fullPath), fileName: safeName };
}

async function pruneBackups(keep: number) {
  const files = await getBackupFiles();
  const extra = files.slice(Math.max(keep, 1));
  for (const file of extra) {
    await import("fs/promises").then((fs) => fs.unlink(path.join(backupDir, file.file)).catch(() => {}));
  }
}

function sqlValue(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function splitSqlStatements(sql: string) {
  const statements: string[] = [];
  let current = "";
  let quote: "'" | '"' | "`" | null = null;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const prev = sql[i - 1];
    if ((char === "'" || char === '"' || char === "`") && prev !== "\\") {
      quote = quote === char ? null : quote ?? char;
    }
    if (char === ";" && !quote) {
      statements.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) statements.push(current);
  return statements;
}

function localDate(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function localTime(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function compactTime(date: Date) {
  return localTime(date).replace(":", "");
}

function normalizeFrequency(value: string | undefined): BackupSettings["frequency"] {
  return value === "WEEKLY" || value === "MONTHLY" ? value : "DAILY";
}

function clampNumber(value: string | number | undefined, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

function latestDueDate(now: Date, settings: BackupSettings) {
  const parts = localDateParts(now);
  const today = localDateFromParts(parts.year, parts.month, parts.day);
  const timeReached = localTime(now) >= settings.time;

  if (settings.frequency === "DAILY") {
    return timeReached ? today : addLocalDays(today, -1);
  }

  if (settings.frequency === "WEEKLY") {
    const currentWeekday = parts.weekday === 0 ? 7 : parts.weekday;
    let daysBack = currentWeekday - settings.weekday;
    if (daysBack < 0) daysBack += 7;
    if (daysBack === 0 && !timeReached) daysBack = 7;
    return addLocalDays(today, -daysBack);
  }

  const currentDue = localDateFromParts(parts.year, parts.month, settings.monthDay);
  if (today > currentDue || (today === currentDue && timeReached)) return currentDue;
  const previousMonth = parts.month === 1 ? 12 : parts.month - 1;
  const previousYear = parts.month === 1 ? parts.year - 1 : parts.year;
  return localDateFromParts(previousYear, previousMonth, settings.monthDay);
}

function addLocalDays(date: string, amount: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + amount));
  return value.toISOString().slice(0, 10);
}

function localDateFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    weekday: weekdayMap[value.weekday] ?? 0
  };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
