"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { ActivePeriod, SessionUser } from "@/lib/types";
import { DataTable } from "./data-table";
import { MaskedNik } from "./masked-nik";

type RekonRow = {
  kpmId: number;
  nik: string;
  nama: string;
  noKk: string;
  desa: string;
  kecamatan: string;
  nominal: number;
  pendamping: string;
  pendampingId: number;
  groupId: number;
  groupName: string;
  year: number;
  stage: number;
  status: "SUDAH_TRANSAKSI" | "BELUM_TRANSAKSI";
};

export function RekonClient({ user, rows, activePeriod }: { user: SessionUser; rows: RekonRow[]; activePeriod: ActivePeriod }) {
  const [localRows, setLocalRows] = useState(() => uniqueByNik(rows));
  const [kecamatan, setKecamatan] = useState(user.role === "PENDAMPING" ? user.district || "SEMUA" : "SEMUA");
  const [pendamping, setPendamping] = useState("SEMUA");
  const [kelompok, setKelompok] = useState("SEMUA");
  const [status, setStatus] = useState("BELUM_TRANSAKSI");
  const [selectedNiks, setSelectedNiks] = useState<string[]>([]);
  const [visibleRows, setVisibleRows] = useState<RekonRow[]>([]);
  const [target, setTarget] = useState<RekonRow | null>(null);
  const [targetStatus, setTargetStatus] = useState<"SUDAH_TRANSAKSI" | "BELUM_TRANSAKSI">("SUDAH_TRANSAKSI");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const kecamatanOptions = useMemo(() => uniqueSorted(localRows.map((row) => row.kecamatan)), [localRows]);
  const pendampingOptions = useMemo(() => uniqueSorted(localRows
    .filter((row) => kecamatan === "SEMUA" || sameText(row.kecamatan, kecamatan))
    .map((row) => row.pendamping)), [kecamatan, localRows]);
  const kelompokOptions = useMemo(() => uniqueSorted(localRows
    .filter((row) => kecamatan === "SEMUA" || sameText(row.kecamatan, kecamatan))
    .filter((row) => pendamping === "SEMUA" || sameText(row.pendamping, pendamping))
    .map((row) => row.groupName)), [kecamatan, localRows, pendamping]);
  const filteredRows = useMemo(() => localRows.filter((row) => {
    const inKecamatan = kecamatan === "SEMUA" || sameText(row.kecamatan, kecamatan);
    const inPendamping = pendamping === "SEMUA" || sameText(row.pendamping, pendamping);
    const inKelompok = kelompok === "SEMUA" || sameText(row.groupName, kelompok);
    const inStatus = status === "SEMUA" || row.status === status;
    return inKecamatan && inPendamping && inKelompok && inStatus;
  }), [kecamatan, kelompok, localRows, pendamping, status]);

  const total = filteredRows.length;
  const sudah = filteredRows.filter((row) => row.status === "SUDAH_TRANSAKSI").length;
  const belum = total - sudah;
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedNiks.includes(row.nik));
  const columns = useMemo(() => [
    {
      key: "select",
      header: (
        <input
          aria-label="Pilih semua baris tampil"
          type="checkbox"
          checked={allVisibleSelected}
          onChange={(event) => {
            const niks = visibleRows.map((row) => row.nik);
            setSelectedNiks((current) => event.target.checked ? [...new Set([...current, ...niks])] : current.filter((nik) => !niks.includes(nik)));
          }}
        />
      ),
      render: (row: RekonRow) => (
        <input
          aria-label={`Pilih ${row.nama}`}
          type="checkbox"
          checked={selectedNiks.includes(row.nik)}
          onChange={(event) => setSelectedNiks((current) => event.target.checked ? [...new Set([...current, row.nik])] : current.filter((nik) => nik !== row.nik))}
        />
      )
    },
    { key: "nama", header: "Nama KPM" },
    { key: "nik", header: "NIK", render: (row: RekonRow) => <MaskedNik nik={row.nik} /> },
    { key: "noKk", header: "No KK" },
    { key: "groupName", header: "Kelompok" },
    { key: "desa", header: "Desa" },
    user.role === "PENDAMPING"
      ? { key: "nominal", header: "Nominal", render: (row: RekonRow) => rupiah(row.nominal) }
      : { key: "kecamatan", header: "Kecamatan" },
    { key: "pendamping", header: "Pendamping" },
    { key: "status", header: "Status", render: (row: RekonRow) => row.status === "SUDAH_TRANSAKSI"
      ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Sudah Transaksi</span>
      : <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">Belum Transaksi</span> },
    { key: "aksi", header: "Aksi", render: (row: RekonRow) => <button onClick={() => openModal(row)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white">Update Rekon</button> }
  ], [allVisibleSelected, selectedNiks, user.role, visibleRows]);

  function openModal(row: RekonRow) {
    setTarget(row);
    setTargetStatus("BELUM_TRANSAKSI");
    setMessage("");
  }

  async function bulkSetSudahTransaksi() {
    const selectedRows = localRows.filter((row) => selectedNiks.includes(row.nik));
    if (!selectedRows.length) return;
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/rekon", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: activePeriod.year,
        stage: activePeriod.stage,
        status: "SUDAH_TRANSAKSI",
        items: selectedRows.map((row) => ({
          kpmId: row.kpmId,
          nik: row.nik,
          groupId: row.groupId,
          pendampingId: row.pendampingId
        }))
      })
    });
    const json = await readJson(res);
    setSaving(false);
    if (!res.ok) {
      setMessage(json.message ?? "Gagal update bulk rekon");
      return;
    }
    setLocalRows((current) => current.map((row) => selectedNiks.includes(row.nik) ? { ...row, status: "SUDAH_TRANSAKSI" } : row));
    setMessage(`${Number(json.updated ?? selectedRows.length).toLocaleString("id-ID")} KPM diubah menjadi Sudah Transaksi.`);
    setSelectedNiks([]);
  }

  async function save() {
    if (!target) return;
    setSaving(true);
    setMessage("");
    const body = new FormData();
    body.append("kpmId", String(target.kpmId));
    body.append("nik", target.nik);
    body.append("groupId", String(target.groupId));
    body.append("pendampingId", String(target.pendampingId));
    body.append("year", String(activePeriod.year));
    body.append("stage", String(activePeriod.stage));
    body.append("status", targetStatus);
    const res = await fetch("/api/rekon", { method: "POST", body });
    const json = await readJson(res);
    setSaving(false);
    if (!res.ok) {
      setMessage(json.message ?? "Gagal menyimpan rekon");
      return;
    }
    setLocalRows((current) => current.map((row) => row.nik === target.nik ? { ...row, status: targetStatus } : row));
    setTarget(null);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-white p-4 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Periode" value={`${activePeriod.year} Tahap ${activePeriod.stage}`} />
          <Info label="KPM Tampil" value={total.toLocaleString("id-ID")} />
          <Info label="Sudah Transaksi" value={sudah.toLocaleString("id-ID")} tone="emerald" />
          <Info label="Belum Transaksi" value={belum.toLocaleString("id-ID")} tone="rose" />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-3 shadow-soft sm:p-4">
        <div className="flex flex-wrap items-end gap-3 [&>label]:w-full [&>label]:sm:w-auto [&_select]:w-full">
          <label className="text-sm font-semibold">
            Kecamatan
            <select disabled={user.role === "PENDAMPING"} value={kecamatan} onChange={(event) => { setKecamatan(event.target.value); setPendamping("SEMUA"); setKelompok("SEMUA"); }} className="mt-1 h-10 rounded-lg border border-border bg-white px-3 disabled:bg-slate-100">
              {user.role === "ADMIN" ? <option value="SEMUA">SEMUA</option> : null}
              {kecamatanOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Pendamping
            <select value={pendamping} onChange={(event) => { setPendamping(event.target.value); setKelompok("SEMUA"); }} className="mt-1 h-10 rounded-lg border border-border bg-white px-3">
              <option value="SEMUA">SEMUA</option>
              {pendampingOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Kelompok
            <select value={kelompok} onChange={(event) => setKelompok(event.target.value)} className="mt-1 h-10 rounded-lg border border-border bg-white px-3">
              <option value="SEMUA">SEMUA</option>
              {kelompokOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 h-10 rounded-lg border border-border bg-white px-3">
              <option value="SEMUA">SEMUA</option>
              <option value="SUDAH_TRANSAKSI">Sudah Transaksi</option>
              <option value="BELUM_TRANSAKSI">Belum Transaksi</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Dipilih: <span className="font-bold text-slate-900">{selectedNiks.length.toLocaleString("id-ID")}</span> KPM</p>
          <button disabled={!selectedNiks.length || saving} onClick={bulkSetSudahTransaksi} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-40">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Jadikan Sudah Transaksi
          </button>
        </div>
        {message ? <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p> : null}
      </section>

      <DataTable
        rows={filteredRows as any[]}
        filename="rekon-penyaluran"
        columns={columns as any[]}
        rowClassName={(row) => row.status === "SUDAH_TRANSAKSI" ? "bg-white" : "bg-rose-50"}
        onVisibleRowsChange={(items) => setVisibleRows(items as RekonRow[])}
      />

      {target ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-3 sm:grid sm:place-items-center sm:p-4" onPointerDown={() => setTarget(null)}>
          <section className="mx-auto w-full max-w-lg rounded-2xl bg-white p-4 shadow-soft sm:p-5" onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Update Rekon KPM</h2>
                <p className="text-sm text-muted-foreground">{target.nama} - {target.groupName}</p>
              </div>
              <button onClick={() => setTarget(null)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted">x</button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="text-sm font-semibold">
                Status Transaksi
                <select value={targetStatus} onChange={(event) => setTargetStatus(event.target.value as any)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
                  <option value="SUDAH_TRANSAKSI">Sudah Transaksi</option>
                  <option value="BELUM_TRANSAKSI">Belum Transaksi</option>
                </select>
              </label>
            </div>
            {message ? <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{message}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={saving} onClick={() => setTarget(null)} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-60">Batal</button>
              <button disabled={saving} onClick={save} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Simpan
              </button>
            </div>
          </section>
        </div>
      ) : null}

    </div>
  );
}

function Info({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "emerald" | "rose" | "amber" }) {
  const colors = {
    slate: "bg-slate-50 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700"
  };
  return (
    <div className={`rounded-xl px-4 py-3 ${colors[tone]}`}>
      <p className="text-xs font-bold uppercase">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function uniqueByNik(rows: RekonRow[]) {
  const map = new Map<string, RekonRow>();
  for (const row of rows) {
    if (!map.has(row.nik)) map.set(row.nik, row);
  }
  return [...map.values()];
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function sameText(left: string, right: string) {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value ?? 0));
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
