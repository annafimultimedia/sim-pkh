"use client";

import { useRef, useState } from "react";
import { Download, Loader2, RefreshCw, Save, UploadCloud } from "lucide-react";
import { DataTable } from "./data-table";

type BackupSettings = {
  enabled: boolean;
  time: string;
  keep: number;
  lastRun: string;
};

type BackupFile = {
  file: string;
  ukuran: string;
  ukuranBytes: number;
  dibuat: string;
};

export function BackupClient({ initialSettings, initialFiles }: { initialSettings: BackupSettings; initialFiles: BackupFile[] }) {
  const [settings, setSettings] = useState(initialSettings);
  const [files, setFiles] = useState(initialFiles);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const res = await fetch("/api/backup", { cache: "no-store" });
    const json = await readJson(res);
    if (res.ok) {
      setSettings(json.settings);
      setFiles(json.files);
    }
  }

  async function createBackup() {
    setLoading("create");
    setMessage("");
    const body = new FormData();
    body.append("action", "create");
    const res = await fetch("/api/backup", { method: "POST", body });
    const json = await readJson(res);
    setLoading("");
    if (!res.ok) return setMessage(json.message ?? "Gagal membuat backup");
    setFiles(json.files ?? []);
    setMessage(`Backup berhasil dibuat: ${json.fileName}`);
  }

  async function saveSettings() {
    setLoading("settings");
    setMessage("");
    const body = new FormData();
    body.append("action", "settings");
    body.append("enabled", settings.enabled ? "1" : "0");
    body.append("time", settings.time);
    body.append("keep", String(settings.keep));
    const res = await fetch("/api/backup", { method: "POST", body });
    const json = await readJson(res);
    setLoading("");
    if (!res.ok) return setMessage(json.message ?? "Gagal menyimpan jadwal");
    setSettings(json.settings);
    setMessage("Jadwal backup otomatis tersimpan.");
  }

  async function restore() {
    if (!restoreFile) return setMessage("Pilih file SQL terlebih dahulu.");
    setLoading("restore");
    setMessage("");
    const body = new FormData();
    body.append("action", "restore");
    body.append("file", restoreFile);
    body.append("confirm", confirm);
    const res = await fetch("/api/backup", { method: "POST", body });
    const json = await readJson(res);
    setLoading("");
    if (!res.ok) return setMessage(json.message ?? "Gagal restore database");
    setRestoreFile(null);
    setConfirm("");
    if (inputRef.current) inputRef.current.value = "";
    setMessage("Restore database berhasil. Silakan logout dan login ulang jika data sesi berubah.");
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
          <h2 className="text-base font-bold">Backup Manual</h2>
          <p className="mt-1 text-sm text-muted-foreground">Buat file SQL terbaru lalu download untuk disimpan di flashdisk/cloud pribadi.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={createBackup} disabled={!!loading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">
              {loading === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Buat Backup Sekarang
            </button>
            <button onClick={refresh} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
          <h2 className="text-base font-bold">Backup Otomatis</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sistem mengecek jadwal saat admin aktif membuka aplikasi.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold">
              Status
              <select value={settings.enabled ? "1" : "0"} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.value === "1" }))} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Jam Backup
              <input type="time" value={settings.time} onChange={(event) => setSettings((current) => ({ ...current, time: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border px-3" />
            </label>
            <label className="text-sm font-semibold">
              Simpan File
              <input type="number" min={1} max={60} value={settings.keep} onChange={(event) => setSettings((current) => ({ ...current, keep: Number(event.target.value) }))} className="mt-1 h-10 w-full rounded-lg border border-border px-3" />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Terakhir otomatis: {settings.lastRun || "-"}</p>
            <button onClick={saveSettings} disabled={!!loading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">
              {loading === "settings" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Jadwal
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-soft">
        <h2 className="text-base font-bold text-rose-700">Restore Database</h2>
        <p className="mt-1 text-sm text-muted-foreground">Restore akan menimpa tabel sesuai isi file SQL. Gunakan hanya saat benar-benar perlu.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px_auto]">
          <input ref={inputRef} type="file" accept=".sql" onChange={(event) => setRestoreFile(event.target.files?.[0] ?? null)} className="rounded-lg border border-border px-3 py-2 text-sm" />
          <input value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Ketik SAYA YAKIN" className="h-10 rounded-lg border border-border px-3 text-sm" />
          <button onClick={restore} disabled={!!loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
            {loading === "restore" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} Restore
          </button>
        </div>
      </section>

      {message ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{message}</p> : null}

      <DataTable
        rows={files as any[]}
        filename="daftar-backup"
        columns={[
          { key: "file", header: "File" },
          { key: "ukuran", header: "Ukuran" },
          { key: "dibuat", header: "Dibuat" },
          { key: "download", header: "Download", render: (row: BackupFile) => (
            <a href={`/api/backup?file=${encodeURIComponent(row.file)}`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white">
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          ) }
        ] as any[]}
      />
    </div>
  );
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
