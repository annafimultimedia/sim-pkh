import os from "os";
import path from "path";
import { readdir, stat, statfs } from "fs/promises";
import { getBackupFiles, getBackupSettings } from "./backup";
import { query } from "./db";
import { getOnlineUsers } from "./data";
import { getMaintenanceSettings, type MaintenanceSettings } from "./maintenance";

export type ServerMonitorData = {
  checkedAt: string;
  application: { status: "online"; nodeVersion: string; processUptimeSeconds: number; processMemoryBytes: number };
  database: { status: "online" | "error"; latencyMs: number; version: string; sizeBytes: number; tableCount: number; message?: string };
  system: { hostname: string; platform: string; uptimeSeconds: number; cpuModel: string; cpuCores: number; cpuUsagePercent: number; memoryTotalBytes: number; memoryUsedBytes: number; memoryUsagePercent: number };
  disk: { totalBytes: number; usedBytes: number; freeBytes: number; usagePercent: number; status: "normal" | "warning" | "critical" };
  storage: { totalFiles: number; totalBytes: number; folders: { name: string; files: number; bytes: number }[] };
  backup: { enabled: boolean; lastRun: string; latestFile: string; latestCreated: string; fileCount: number };
  users: { online: number };
  connection: { cloudflare: boolean; host: string; protocol: string };
  maintenance: MaintenanceSettings;
};

export async function getServerMonitorData(connection: { cloudflare?: boolean; host?: string; protocol?: string } = {}): Promise<ServerMonitorData> {
  const [cpuUsagePercent, database, disk, storage, backup, onlineUsers, maintenance] = await Promise.all([
    measureCpuUsage(),
    checkDatabase(),
    readDiskUsage(),
    readUploadStorage(),
    readBackupStatus(),
    getOnlineUsers(),
    getMaintenanceSettings()
  ]);
  const memoryTotalBytes = os.totalmem();
  const memoryUsedBytes = memoryTotalBytes - os.freemem();
  const cpus = os.cpus();

  return {
    checkedAt: new Date().toISOString(),
    application: {
      status: "online",
      nodeVersion: process.version,
      processUptimeSeconds: process.uptime(),
      processMemoryBytes: process.memoryUsage().rss
    },
    database,
    system: {
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      uptimeSeconds: os.uptime(),
      cpuModel: cpus[0]?.model?.trim() || "-",
      cpuCores: cpus.length,
      cpuUsagePercent,
      memoryTotalBytes,
      memoryUsedBytes,
      memoryUsagePercent: percent(memoryUsedBytes, memoryTotalBytes)
    },
    disk,
    storage,
    backup,
    users: { online: onlineUsers.length },
    connection: {
      cloudflare: Boolean(connection.cloudflare),
      host: connection.host || "-",
      protocol: connection.protocol || "-"
    },
    maintenance
  };
}

async function checkDatabase(): Promise<ServerMonitorData["database"]> {
  const started = performance.now();
  try {
    const rows = await query<{ version: string; sizeBytes: string | number; tableCount: string | number }>(
      `SELECT VERSION() AS version,
              COALESCE(SUM(data_length + index_length), 0) AS sizeBytes,
              COUNT(*) AS tableCount
       FROM information_schema.TABLES
       WHERE table_schema = DATABASE()`
    );
    return {
      status: "online",
      latencyMs: Math.round(performance.now() - started),
      version: rows[0]?.version || "-",
      sizeBytes: Number(rows[0]?.sizeBytes ?? 0),
      tableCount: Number(rows[0]?.tableCount ?? 0)
    };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Math.round(performance.now() - started),
      version: "-",
      sizeBytes: 0,
      tableCount: 0,
      message: error instanceof Error ? error.message : "Database tidak dapat dihubungi"
    };
  }
}

async function readDiskUsage(): Promise<ServerMonitorData["disk"]> {
  try {
    const info = await statfs(process.cwd());
    const totalBytes = Number(info.blocks) * Number(info.bsize);
    const freeBytes = Number(info.bavail) * Number(info.bsize);
    const usedBytes = Math.max(totalBytes - freeBytes, 0);
    const usagePercent = percent(usedBytes, totalBytes);
    return {
      totalBytes,
      usedBytes,
      freeBytes,
      usagePercent,
      status: usagePercent >= 90 ? "critical" : usagePercent >= 80 ? "warning" : "normal"
    };
  } catch {
    return { totalBytes: 0, usedBytes: 0, freeBytes: 0, usagePercent: 0, status: "warning" };
  }
}

async function readUploadStorage(): Promise<ServerMonitorData["storage"]> {
  const root = path.join(process.cwd(), "public", "uploads");
  const folderDefinitions = [
    { name: "Surat", relative: "surat" },
    { name: "Foto P2K2", relative: "p2k2/photos" },
    { name: "PDF Absensi P2K2", relative: "p2k2/absensi" },
    { name: "Foto Verifikasi", relative: "health-verifications" },
    { name: "Bukti Rekon", relative: "rekon" },
    { name: "Foto Profil", relative: "profiles" }
  ];
  const folders = await Promise.all(folderDefinitions.map(async (folder) => {
    const summary = await summarizeFolder(path.join(root, folder.relative));
    return { name: folder.name, ...summary };
  }));
  return {
    totalFiles: folders.reduce((sum, folder) => sum + folder.files, 0),
    totalBytes: folders.reduce((sum, folder) => sum + folder.bytes, 0),
    folders
  };
}

async function summarizeFolder(dir: string): Promise<{ files: number; bytes: number }> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const values = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return summarizeFolder(fullPath);
      if (!entry.isFile()) return { files: 0, bytes: 0 };
      const info = await stat(fullPath);
      return { files: 1, bytes: info.size };
    }));
    return values.reduce((total, value) => ({ files: total.files + value.files, bytes: total.bytes + value.bytes }), { files: 0, bytes: 0 });
  } catch {
    return { files: 0, bytes: 0 };
  }
}

async function readBackupStatus(): Promise<ServerMonitorData["backup"]> {
  try {
    const [settings, files] = await Promise.all([getBackupSettings(), getBackupFiles()]);
    return {
      enabled: settings.enabled,
      lastRun: settings.lastRun || "-",
      latestFile: files[0]?.file || "-",
      latestCreated: files[0]?.dibuat || "-",
      fileCount: files.length
    };
  } catch {
    return { enabled: false, lastRun: "-", latestFile: "-", latestCreated: "-", fileCount: 0 };
  }
}

async function measureCpuUsage() {
  const before = cpuTimes();
  await new Promise((resolve) => setTimeout(resolve, 250));
  const after = cpuTimes();
  const total = after.total - before.total;
  const idle = after.idle - before.idle;
  return total > 0 ? Math.round((1 - idle / total) * 1000) / 10 : 0;
}

function cpuTimes() {
  return os.cpus().reduce((result, cpu) => {
    const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
    return { idle: result.idle + cpu.times.idle, total: result.total + total };
  }, { idle: 0, total: 0 });
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}
