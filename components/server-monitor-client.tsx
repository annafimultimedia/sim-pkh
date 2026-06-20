"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Cloud, Cpu, Database, HardDrive, Loader2, MemoryStick, RefreshCw, Save, Server, ShieldAlert, Users } from "lucide-react";
import type { ServerMonitorData } from "@/lib/server-monitor";

export function ServerMonitorClient() {
  const [data, setData] = useState<ServerMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [maintenanceNotice, setMaintenanceNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/server-monitor", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Gagal membaca kondisi server");
      setData(json);
      setMaintenanceEnabled(json.maintenance.enabled);
      setMaintenanceMessage(json.maintenance.message);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Gagal membaca kondisi server");
    } finally {
      setLoading(false);
    }
  }, []);

  async function saveMaintenance() {
    setSavingMaintenance(true);
    setMaintenanceNotice("");
    try {
      const response = await fetch("/api/server-monitor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: maintenanceEnabled, message: maintenanceMessage })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Gagal menyimpan mode maintenance");
      setData((current) => current ? { ...current, maintenance: json.maintenance } : current);
      setMaintenanceMessage(json.maintenance.message);
      setMaintenanceNotice(maintenanceEnabled ? "Mode maintenance aktif. User non-admin akan melihat halaman pemeliharaan." : "Mode maintenance dinonaktifkan. Aplikasi dapat diakses kembali.");
    } catch (saveError) {
      setMaintenanceNotice(saveError instanceof Error ? saveError.message : "Gagal menyimpan mode maintenance");
    } finally {
      setSavingMaintenance(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (!data && loading) {
    return <div className="grid min-h-72 place-items-center rounded-lg border border-border bg-white"><span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" /> Memeriksa server...</span></div>;
  }

  if (!data) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">{error || "Data server tidak tersedia."}</div>;
  }

  const cpuTone = usageTone(data.system.cpuUsagePercent);
  const memoryTone = usageTone(data.system.memoryUsagePercent);
  const diskTone = data.disk.status;

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-slate-900">Status terakhir</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(data.checkedAt)} · refresh otomatis setiap 30 detik</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Perbarui
        </button>
      </section>

      {error ? <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Pembaruan terakhir gagal: {error}</p> : null}

      <section className={`rounded-lg border p-4 shadow-soft ${maintenanceEnabled ? "border-amber-300 bg-amber-50" : "border-border bg-white"}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${maintenanceEnabled ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}><ShieldAlert className="h-5 w-5" /></span>
            <div>
              <h2 className="font-bold text-slate-900">Mode Maintenance</h2>
              <p className="mt-1 text-sm text-muted-foreground">Saat aktif, user non-admin akan diarahkan ke halaman informasi maintenance. Admin tetap dapat mengakses aplikasi.</p>
            </div>
          </div>
          <label className="inline-flex shrink-0 items-center gap-3 text-sm font-bold text-slate-700">
            <span>{maintenanceEnabled ? "Aktif" : "Nonaktif"}</span>
            <button type="button" role="switch" aria-checked={maintenanceEnabled} onClick={() => setMaintenanceEnabled((current) => !current)} className={`relative h-7 w-12 rounded-full transition ${maintenanceEnabled ? "bg-amber-500" : "bg-slate-300"}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${maintenanceEnabled ? "left-6" : "left-1"}`} />
            </button>
          </label>
        </div>
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Pesan untuk pengguna
          <textarea value={maintenanceMessage} onChange={(event) => setMaintenanceMessage(event.target.value.slice(0, 240))} className="mt-1 min-h-20 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm" placeholder="Informasi maintenance..." />
          <span className="mt-1 block text-right text-xs text-muted-foreground">{maintenanceMessage.length}/240</span>
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-sm font-semibold ${maintenanceNotice.includes("Gagal") ? "text-rose-700" : "text-emerald-700"}`}>{maintenanceNotice}</p>
          <button type="button" onClick={() => void saveMaintenance()} disabled={savingMaintenance} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">
            {savingMaintenance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Maintenance
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={Server} label="Aplikasi" value="Online" detail={`Node ${data.application.nodeVersion}`} tone="normal" />
        <StatusCard icon={Database} label="Kapasitas Database" value={data.database.status === "online" ? formatBytes(data.database.sizeBytes) : "Bermasalah"} detail={data.database.status === "online" ? `${data.database.tableCount} tabel · ${data.database.latencyMs} ms · MySQL ${data.database.version}` : data.database.message || "Tidak terhubung"} tone={data.database.status === "online" ? "normal" : "critical"} />
        <StatusCard icon={Cloud} label="Cloudflare" value={data.connection.cloudflare ? "Terdeteksi" : "Tidak terdeteksi"} detail={`${data.connection.protocol.toUpperCase()} · ${data.connection.host}`} tone={data.connection.cloudflare ? "normal" : "warning"} />
        <StatusCard icon={Users} label="User Aktif" value={data.users.online.toLocaleString("id-ID")} detail="Aktif dalam 2 menit terakhir" tone="normal" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard icon={Cpu} label="CPU" value={`${data.system.cpuUsagePercent}%`} detail={`${data.system.cpuCores} core · ${data.system.cpuModel}`} percent={data.system.cpuUsagePercent} tone={cpuTone} />
        <MetricCard icon={MemoryStick} label="RAM" value={`${data.system.memoryUsagePercent}%`} detail={`${formatBytes(data.system.memoryUsedBytes)} dari ${formatBytes(data.system.memoryTotalBytes)}`} percent={data.system.memoryUsagePercent} tone={memoryTone} />
        <MetricCard icon={HardDrive} label="Disk" value={`${data.disk.usagePercent}%`} detail={`${formatBytes(data.disk.freeBytes)} tersisa dari ${formatBytes(data.disk.totalBytes)}`} percent={data.disk.usagePercent} tone={diskTone} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-border bg-white shadow-soft">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-bold">Penyimpanan File</h2>
            <p className="mt-1 text-sm text-muted-foreground">{data.storage.totalFiles.toLocaleString("id-ID")} file · {formatBytes(data.storage.totalBytes)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3 text-left">Kategori</th><th className="px-4 py-3 text-right">File</th><th className="px-4 py-3 text-right">Ukuran</th></tr></thead>
              <tbody>{data.storage.folders.map((folder) => <tr key={folder.name} className="border-t border-border"><td className="px-4 py-3 font-semibold">{folder.name}</td><td className="px-4 py-3 text-right">{folder.files.toLocaleString("id-ID")}</td><td className="px-4 py-3 text-right">{formatBytes(folder.bytes)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <InfoPanel icon={Save} title="Backup Database" rows={[
            ["Jadwal otomatis", data.backup.enabled ? "Aktif" : "Nonaktif"],
            ["Terakhir otomatis", data.backup.lastRun],
            ["File terbaru", data.backup.latestFile],
            ["Dibuat", data.backup.latestCreated],
            ["Jumlah backup", String(data.backup.fileCount)]
          ]} />
          <InfoPanel icon={Activity} title="Informasi Server" rows={[
            ["Nama PC", data.system.hostname],
            ["Sistem", data.system.platform],
            ["Uptime PC", formatDuration(data.system.uptimeSeconds)],
            ["Uptime aplikasi", formatDuration(data.application.processUptimeSeconds)],
            ["RAM proses Node", formatBytes(data.application.processMemoryBytes)]
          ]} />
        </div>
      </section>
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Server; label: string; value: string; detail: string; tone: Tone }) {
  return <div className="rounded-lg border border-border bg-white p-4 shadow-soft"><div className="flex items-start justify-between gap-3"><span className={`grid h-9 w-9 place-items-center rounded-lg ${toneClasses[tone].soft}`}><Icon className="h-4 w-4" /></span><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${toneClasses[tone].badge}`}>{toneLabel[tone]}</span></div><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p><p className="mt-1 break-words text-xs text-muted-foreground">{detail}</p></div>;
}

function MetricCard({ icon: Icon, label, value, detail, percent, tone }: { icon: typeof Cpu; label: string; value: string; detail: string; percent: number; tone: Tone }) {
  return <div className="rounded-lg border border-border bg-white p-4 shadow-soft"><div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 font-bold"><Icon className="h-4 w-4 text-primary" /> {label}</span><strong>{value}</strong></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${toneClasses[tone].bar}`} style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }} /></div><p className="mt-3 text-xs text-muted-foreground">{detail}</p></div>;
}

function InfoPanel({ icon: Icon, title, rows }: { icon: typeof Save; title: string; rows: string[][] }) {
  return <div className="rounded-lg border border-border bg-white p-4 shadow-soft"><h2 className="inline-flex items-center gap-2 font-bold"><Icon className="h-4 w-4 text-primary" /> {title}</h2><dl className="mt-3 space-y-2">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[130px_1fr] gap-3 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words text-right font-semibold">{value || "-"}</dd></div>)}</dl></div>;
}

type Tone = "normal" | "warning" | "critical";
const toneClasses = { normal: { soft: "bg-emerald-50 text-emerald-700", badge: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" }, warning: { soft: "bg-amber-50 text-amber-700", badge: "bg-amber-50 text-amber-700", bar: "bg-amber-500" }, critical: { soft: "bg-rose-50 text-rose-700", badge: "bg-rose-50 text-rose-700", bar: "bg-rose-500" } };
const toneLabel = { normal: "Normal", warning: "Perhatian", critical: "Kritis" };

function usageTone(value: number): Tone { return value >= 90 ? "critical" : value >= 75 ? "warning" : "normal"; }
function formatBytes(bytes: number) { if (!bytes) return "0 B"; const units = ["B", "KB", "MB", "GB", "TB"]; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`; }
function formatDuration(seconds: number) { const days = Math.floor(seconds / 86400); const hours = Math.floor((seconds % 86400) / 3600); const minutes = Math.floor((seconds % 3600) / 60); return `${days ? `${days} hari ` : ""}${hours} jam ${minutes} menit`; }
function formatDate(value: string) { return new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }); }
