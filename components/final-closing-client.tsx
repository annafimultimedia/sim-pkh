"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Layers3, Loader2, MapPin, PieChart, Users, X } from "lucide-react";
import { DataTable } from "./data-table";
import { MaskedNik } from "./masked-nik";
import { ActivePeriod, DistrictOption, Kpm, Pendamping, SessionUser, VillageOption } from "@/lib/types";

type ImportLog = {
  id: number;
  jenis: string;
  tahun: number;
  tahap: number;
  kecamatan: string;
  file: string;
  jumlahData: number;
  diuploadOleh: string;
  waktu: string;
};

export function FinalClosingClient({ rows, pendamping, user, districts, villages, activePeriod, importLogs }: { rows: Kpm[]; pendamping: Pendamping[]; user: SessionUser; districts: DistrictOption[]; villages: VillageOption[]; activePeriod: ActivePeriod; importLogs: ImportLog[] }) {
  const assignedDistrictName = districts.find((district) => district.id === user.districtId)?.name || user.district || "";
  const [selected, setSelected] = useState<number[]>([]);
  const [visibleRows, setVisibleRows] = useState<Kpm[]>([]);
  const [modal, setModal] = useState(false);
  const [confirmMapping, setConfirmMapping] = useState<{ id?: number; name: string } | null>(null);
  const [pendampingKecamatan, setPendampingKecamatan] = useState("SEMUA");
  const [kabupaten, setKabupaten] = useState("KAB. JEMBER");
  const [kecamatan, setKecamatan] = useState(user.role === "PENDAMPING" ? assignedDistrictName || "SEMUA" : "SEMUA");
  const [desa, setDesa] = useState("SEMUA");
  const [pendampingFilter, setPendampingFilter] = useState("SEMUA");
  const [status, setStatus] = useState("SEMUA");
  const [mappingStatus, setMappingStatus] = useState("SEMUA");
  const years = useMemo(() => [...new Set(rows.map((row) => row.tahun))].sort((a, b) => b - a), [rows]);
  const stages = useMemo(() => [...new Set(rows.map((row) => row.tahap))].sort((a, b) => a - b), [rows]);
  const [tahun, setTahun] = useState(() => String(activePeriod.year));
  const [tahap, setTahap] = useState(() => String(activePeriod.stage));
  const [localRows, setLocalRows] = useState(rows);
  const currentPendampingProfile = useMemo(() => pendamping.find((item) => item.userId === user.id) ?? pendamping.find((item) => sameText(item.nama, user.name)), [pendamping, user.id, user.name]);
  const [onlyMyMapped, setOnlyMyMapped] = useState(user.role === "PENDAMPING");
  const [artModal, setArtModal] = useState<{ noKk: string; rows: ArtMember[]; loading: boolean; error?: string } | null>(null);

  const kabupatenOptions = useMemo(() => ["KAB. JEMBER", ...[...new Set(localRows.map((row) => row.kabupaten).filter(Boolean))].filter((item) => item !== "KAB. JEMBER")], [localRows]);
  const kecamatanOptions = useMemo(() => {
    if (user.role === "PENDAMPING") return assignedDistrictName ? [assignedDistrictName] : [];
    return districts.map((district) => district.name).sort();
  }, [assignedDistrictName, districts, user.role]);
  const selectedDistrict = useMemo(() => districts.find((district) => district.name.toUpperCase() === kecamatan.toUpperCase()), [districts, kecamatan]);
  const desaOptions = useMemo(() => {
    if (kecamatan === "SEMUA") return [];
    if (!selectedDistrict) return [];
    return villages.filter((village) => village.districtId === selectedDistrict.id).map((village) => village.name).sort();
  }, [kecamatan, selectedDistrict, villages]);
  const pendampingOptions = useMemo(() => {
    return [...new Set(pendamping
      .filter((row) => kecamatan === "SEMUA" || sameText(row.kecamatan, kecamatan))
      .map((row) => row.nama)
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }, [kecamatan, pendamping]);
  const statusOptions = useMemo(() => {
    return uniqueSorted(localRows
      .filter((row) => {
        const rowKab = row.kabupaten.replace(/^KABUPATEN\s+/i, "KAB. ");
        const inKabupaten = kabupaten === "SEMUA" || row.kabupaten === kabupaten || rowKab === kabupaten;
        const inKecamatan = kecamatan === "SEMUA" || sameText(row.kecamatan, kecamatan);
        const inDesa = desa === "SEMUA" || sameText(row.kelurahan, desa);
        const inPendamping = pendampingFilter === "SEMUA" || sameText(row.pendamping ?? "", pendampingFilter);
        const inMapping = mappingStatus === "SEMUA" || (mappingStatus === "SUDAH" ? !!row.pendamping : !row.pendamping);
        const inMine = !onlyMyMapped || (user.role === "PENDAMPING" ? isMappedToCurrentPendamping(row, currentPendampingProfile, user) : !!row.pendamping);
        const inStage = tahap === "SEMUA" || row.tahap === Number(tahap);
        const inYear = row.tahun === Number(tahun);
        return inKabupaten && inKecamatan && inDesa && inPendamping && inMapping && inMine && inStage && inYear;
      })
      .map((row) => row.status));
  }, [currentPendampingProfile, desa, kabupaten, kecamatan, localRows, mappingStatus, onlyMyMapped, pendampingFilter, tahap, tahun, user]);
  const pendampingKecamatanOptions = useMemo(() => [...new Set(pendamping.map((row) => row.kecamatan).filter(Boolean))].sort(), [pendamping]);
  const filteredPendamping = useMemo(() => {
    return pendamping.filter((row) => pendampingKecamatan === "SEMUA" || row.kecamatan.toUpperCase() === pendampingKecamatan.toUpperCase());
  }, [pendamping, pendampingKecamatan]);

  const filtered = useMemo(() => {
    return localRows.filter((row) => {
      const rowKab = row.kabupaten.replace(/^KABUPATEN\s+/i, "KAB. ");
      const rowKec = row.kecamatan.toUpperCase();
      const selectedKec = kecamatan.toUpperCase();
      return (
        (kabupaten === "SEMUA" || row.kabupaten === kabupaten || rowKab === kabupaten) &&
        (kecamatan === "SEMUA" || rowKec === selectedKec) &&
        (desa === "SEMUA" || row.kelurahan.toUpperCase() === desa.toUpperCase()) &&
        (pendampingFilter === "SEMUA" || sameText(row.pendamping ?? "", pendampingFilter)) &&
        (status === "SEMUA" || row.status === status) &&
        (mappingStatus === "SEMUA" || (mappingStatus === "SUDAH" ? !!row.pendamping : !row.pendamping)) &&
        (!onlyMyMapped || (user.role === "PENDAMPING" ? isMappedToCurrentPendamping(row, currentPendampingProfile, user) : !!row.pendamping)) &&
        (tahap === "SEMUA" || row.tahap === Number(tahap)) &&
        row.tahun === Number(tahun)
      );
    });
  }, [currentPendampingProfile, desa, kabupaten, kecamatan, localRows, mappingStatus, onlyMyMapped, pendampingFilter, status, tahap, tahun, user]);
  const summary = useMemo(() => {
    const totalKpm = filtered.length;
    const dampingCount = user.role === "PENDAMPING"
      ? filtered.filter((row) => isMappedToCurrentPendamping(row, currentPendampingProfile, user)).length
      : filtered.filter((row) => !!row.pendamping).length;
    const unmappedCount = filtered.filter((row) => !row.pendamping).length;
    const statusMap = new Map<string, number>();
    for (const row of filtered) {
      const key = row.status?.trim() || "Tanpa Status";
      statusMap.set(key, (statusMap.get(key) ?? 0) + 1);
    }
    const statusRows = [...statusMap.entries()]
      .map(([name, total]) => ({ name, total, percent: totalKpm ? Math.round((total / totalKpm) * 100) : 0 }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    return {
      totalKpm,
      dampingCount,
      unmappedCount,
      statusRows,
      topStatus: statusRows[0]
    };
  }, [currentPendampingProfile, filtered, user]);
  const latestImport = useMemo(() => {
    if (user.role === "ADMIN" && kecamatan === "SEMUA") return null;
    const selectedYear = Number(tahun);
    const selectedStage = tahap === "SEMUA" ? null : Number(tahap);
    const finalClosingLogs = importLogs
      .filter((log) => log.jenis === "FINAL_CLOSING" && log.tahun === selectedYear)
      .sort((a, b) => b.waktu.localeCompare(a.waktu));
    return finalClosingLogs.find((log) => {
      const inStage = selectedStage === null || log.tahap === selectedStage;
      const inDistrict = kecamatan !== "SEMUA" && sameText(log.kecamatan, kecamatan);
      return inStage && inDistrict;
    }) ?? null;
  }, [importLogs, kecamatan, tahap, tahun, user.role]);

  useEffect(() => {
    if (status !== "SEMUA" && !statusOptions.some((item) => sameText(item, status))) {
      setStatus("SEMUA");
    }
  }, [status, statusOptions]);

  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selected.includes(row.id));
  const handleVisibleRowsChange = useCallback((items: Record<string, unknown>[]) => {
    setVisibleRows(items as Kpm[]);
  }, []);

  function toggleSelectAll(checked: boolean) {
    const ids = visibleRows.map((row) => row.id);
    setSelected((current) => checked ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id)));
  }

  async function mapTo(name: string, pendampingId?: number) {
    await fetch("/api/kpm/map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected, pendampingId })
    });
    const mappedPendampingId = user.role === "PENDAMPING" ? currentPendampingProfile?.id : pendampingId;
    setLocalRows((current) => current.map((row) => (selected.includes(row.id) ? { ...row, pendamping: name, pendampingId: mappedPendampingId } : row)));
    setSelected([]);
    setModal(false);
  }

  function handleMapping() {
    if (user.role === "PENDAMPING") {
      setConfirmMapping({ name: user.name });
      return;
    }
    setModal(true);
  }

  async function openArtModal(noKk: string) {
    setArtModal({ noKk, rows: [], loading: true });
    try {
      const res = await fetch(`/api/art/${encodeURIComponent(noKk)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Gagal membaca data ART");
      setArtModal({ noKk, rows: json.rows ?? [], loading: false });
    } catch (error) {
      setArtModal({ noKk, rows: [], loading: false, error: error instanceof Error ? error.message : "Gagal membaca data ART" });
    }
  }

  const columns = [
    {
      key: "select",
      header: "select-all",
      headerClassName: "md:sticky md:left-0 md:z-20 bg-slate-50",
      className: "md:sticky md:left-0 md:z-10 bg-inherit",
      render: (row: Kpm) => <input type="checkbox" checked={selected.includes(row.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, row.id] : s.filter((id) => id !== row.id)))} />
    },
    {
      key: "nama",
      header: "Nama Penerima",
      headerClassName: "md:sticky md:left-[40px] md:z-20 bg-slate-50 min-w-56",
      className: "md:sticky md:left-[40px] md:z-10 min-w-56 bg-inherit font-semibold md:shadow-[8px_0_10px_-12px_rgba(15,23,42,0.45)]",
      render: (row: Kpm) => row.nama
    },
    {
      key: "nik",
      header: "NIK",
      className: "min-w-44 pl-5 font-semibold text-primary",
      headerClassName: "min-w-44 pl-5",
      value: (row: Kpm) => row.nik,
      render: (row: Kpm) => <MaskedNik nik={row.nik} />
    },
    {
      key: "noKk",
      header: "No KK",
      render: (row: Kpm) => (
        <button onClick={() => openArtModal(row.noKk)} className="font-semibold text-primary underline-offset-2 hover:underline">
          {row.noKk}
        </button>
      )
    },
    { key: "tglLahir", header: "Tgl Lahir" },
    { key: "umur", header: "Umur" },
    { key: "art", header: "ART" },
    { key: "hamil", header: "Hamil" },
    { key: "aud", header: "AUD" },
    { key: "sd", header: "SD" },
    { key: "smp", header: "SMP" },
    { key: "sma", header: "SMA" },
    { key: "disabil", header: "Disabil" },
    { key: "lansia", header: "Lansia" },
    { key: "ham", header: "HAM" },
    { key: "komponen", header: "Jml Komponen" },
    { key: "nominal", header: "Nominal", value: (row: Kpm) => row.nominal },
    { key: "status", header: "Status" },
    { key: "alamatFc", header: "Alamat FC" },
    { key: "alamat", header: "Alamat" },
    { key: "rt", header: "RT" },
    { key: "rw", header: "RW" },
    { key: "kelurahan", header: "Kelurahan" },
    { key: "kecamatan", header: "Kecamatan" },
    { key: "kabupaten", header: "Kabupaten" },
    { key: "provinsi", header: "Provinsi" },
    { key: "pendamping", header: "Nama Pendamping", render: (row: Kpm) => row.pendamping ?? <span className="font-semibold text-rose-700">Belum mapping</span> }
  ];

  return (
    <div className="space-y-4">
      <p className="-mt-2 text-sm text-muted-foreground">
        <span className="font-semibold text-slate-700">Data Diperbarui</span>{" "}
        {latestImport?.waktu ?? "-"}
      </p>
      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Jumlah KPM" value={summary.totalKpm} icon={Users} tone="emerald" />
        <SummaryCard label="Jumlah Dampingan" value={summary.dampingCount} icon={CheckCircle2} tone="sky" />
        <SummaryCard label="Belum Termapping" value={summary.unmappedCount} icon={Layers3} tone="rose" />
      </section>
      <section className="rounded-2xl border border-border bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <PieChart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground">Rekap Status</p>
              <h2 className="mt-1 text-base font-bold text-slate-900">
                {summary.topStatus ? `Terbanyak: ${summary.topStatus.name}` : "Belum ada data"}
              </h2>
            </div>
          </div>
          {summary.topStatus ? (
            <span className="w-fit rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
              {summary.topStatus.total.toLocaleString("id-ID")} KPM
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
          {summary.statusRows.length ? summary.statusRows.map((item) => (
            <div key={item.name} className="min-w-48 flex-1 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100 sm:max-w-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{item.name}</span>
                <span className="shrink-0 text-xs font-bold text-slate-600">{item.total.toLocaleString("id-ID")}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-primary" style={{ width: `${item.percent}%` }} />
              </div>
            </div>
          )) : (
            <p className="w-full rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada status pada filter ini.</p>
          )}
        </div>
      </section>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-white p-3 shadow-soft sm:p-4 [&>label]:w-full [&>label]:sm:w-auto [&_select]:w-full">
        <label className="text-sm font-medium">
          Kabupaten
          <select value={kabupaten} onChange={(e) => { setKabupaten(e.target.value); if (user.role !== "PENDAMPING") setKecamatan("SEMUA"); setDesa("SEMUA"); setPendampingFilter("SEMUA"); }} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
            {kabupatenOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Tahun
          <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
            {years.length ? years.map((item) => <option key={item}>{item}</option>) : <option>2026</option>}
          </select>
        </label>
        <label className="text-sm font-medium">
          Tahap
          <select value={tahap} onChange={(e) => setTahap(e.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
            <option>SEMUA</option>
            {(stages.length ? stages : [1, 2, 3, 4]).map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Kecamatan
          <select value={kecamatan} disabled={user.role === "PENDAMPING"} onChange={(e) => { setKecamatan(e.target.value); setDesa("SEMUA"); setPendampingFilter("SEMUA"); }} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3 disabled:bg-slate-100 disabled:text-slate-600">
            {user.role === "ADMIN" ? <option>SEMUA</option> : null}
            {kecamatanOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Desa
          <select value={desa} onChange={(e) => setDesa(e.target.value)} disabled={kecamatan === "SEMUA"} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3 disabled:bg-slate-100 disabled:text-muted-foreground">
            <option>SEMUA</option>
            {desaOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        {user.role === "ADMIN" ? (
          <label className="text-sm font-medium">
            Pendamping
            <select value={pendampingFilter} onChange={(e) => setPendampingFilter(e.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
              <option value="SEMUA">SEMUA PENDAMPING</option>
              {pendampingOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        ) : null}
        <label className="text-sm font-medium">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
            <option>SEMUA</option>
            {statusOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Mapping
          <select value={mappingStatus} onChange={(e) => setMappingStatus(e.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
            <option value="SEMUA">SEMUA</option>
            <option value="SUDAH">Sudah Termapping</option>
            <option value="BELUM">Belum Termapping</option>
          </select>
        </label>
        {user.role === "PENDAMPING" ? (
          <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={onlyMyMapped}
              onChange={(event) => {
                setOnlyMyMapped(event.target.checked);
                setSelected([]);
              }}
              className="h-4 w-4 accent-primary"
            />
            Hanya KPM saya
          </label>
        ) : null}
        <button disabled={!selected.length} onClick={handleMapping} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40 sm:w-auto">
          <MapPin className="h-4 w-4" /> Mapping {selected.length || ""}
        </button>
        <div className="w-full text-sm text-muted-foreground sm:ml-auto sm:w-auto">
          Tampil: <span className="font-semibold text-slate-900">{filtered.length.toLocaleString("id-ID")}</span> KPM
        </div>
      </div>
      <DataTable
        rows={filtered as any[]}
        columns={columns.map((column) => column.key === "select" ? {
          ...column,
          header: (
            <input
              aria-label="Select all"
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(e) => toggleSelectAll(e.target.checked)}
            />
          )
        } : column) as any[]}
        filename="data-final-closing"
        rowClassName={(row) => (row.pendamping ? "bg-white" : "bg-rose-50")}
        onVisibleRowsChange={handleVisibleRowsChange}
      />
      {modal && (
        <div className="fixed inset-0 z-[500] overflow-y-auto bg-slate-950/40 p-3 sm:grid sm:place-items-center sm:p-4" onPointerDown={() => setModal(false)}>
          <div className="mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-soft sm:max-h-[calc(100dvh-2rem)]" onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-border p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-bold">Pilih Pendamping</h2>
                <p className="text-sm text-muted-foreground">Filter berdasarkan kabupaten/kecamatan dan cari NIP/NIK/Nama.</p>
              </div>
              <button onClick={() => setModal(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-slate-50 p-3 [&>label]:w-full [&>label]:sm:w-auto [&_select]:w-full">
              <label className="text-sm font-semibold">
                Filter Kecamatan
                <select value={pendampingKecamatan} onChange={(e) => setPendampingKecamatan(e.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
                  <option>SEMUA</option>
                  {pendampingKecamatanOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <div className="text-sm text-muted-foreground">
                KPM dipilih: <span className="font-bold text-slate-900">{selected.length.toLocaleString("id-ID")}</span>
              </div>
            </div>
            <DataTable
              rows={filteredPendamping as any[]}
              filename="pendamping"
              columns={[
                { key: "nik", header: "NIK" },
                { key: "nip", header: "NIP" },
                { key: "nama", header: "Nama Pendamping" },
                { key: "kecamatan", header: "Kecamatan" },
                { key: "aksi", header: "Aksi", render: (row: Pendamping) => <button onClick={() => setConfirmMapping({ id: row.id, name: row.nama })} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"><Check className="h-3 w-3" /> Pilih</button> }
              ] as any[]}
            />
            </div>
          </div>
        </div>
      )}
      {confirmMapping && (
        <div className="fixed inset-0 z-[510] grid place-items-center bg-slate-950/40 p-4" onPointerDown={() => setConfirmMapping(null)}>
          <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft" onPointerDown={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-bold">Konfirmasi Mapping KPM</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Anda akan memapping <span className="font-bold text-slate-900">{selected.length.toLocaleString("id-ID")} KPM</span> ke pendamping <span className="font-bold text-slate-900">{confirmMapping.name}</span>.
            </p>
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Pastikan pilihan sudah benar. Data KPM terpilih akan berpindah ke pendamping ini.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmMapping(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Tidak</button>
              <button onClick={() => {
                mapTo(confirmMapping.name, confirmMapping.id);
                setConfirmMapping(null);
              }} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Ya, Mapping</button>
            </div>
          </section>
        </div>
      )}
      {artModal ? (
        <div className="fixed inset-0 z-[520] overflow-y-auto bg-slate-950/40 p-3 sm:grid sm:place-items-center sm:p-4" onPointerDown={() => setArtModal(null)}>
          <section className="mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-soft sm:max-h-[calc(100dvh-2rem)]" onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-bold">Data ART Keluarga</h2>
                <p className="text-sm text-muted-foreground">No KK: <span className="font-semibold text-slate-900">{artModal.noKk}</span></p>
              </div>
              <button onClick={() => setArtModal(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {artModal.loading ? (
                <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Memuat ART...</span>
                </div>
              ) : artModal.error ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{artModal.error}</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="min-w-[640px] border-collapse text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {["No", "KK", "NIK", "Nama", "Komponen"].map((heading) => <th key={heading} className="border-b border-border px-3 py-2 text-left text-xs font-bold uppercase text-slate-600">{heading}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {artModal.rows.length ? artModal.rows.map((row, index) => (
                        <tr key={`${row.nik}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-emerald-50/45"}>
                          <td className="border-b border-border px-3 py-2">{index + 1}</td>
                          <td className="border-b border-border px-3 py-2">{row.noKk}</td>
                          <td className="border-b border-border px-3 py-2"><MaskedNik nik={row.nik} /></td>
                          <td className="border-b border-border px-3 py-2 font-semibold">{row.nama}</td>
                          <td className="border-b border-border px-3 py-2">{row.komponen}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">ART belum tersedia untuk No KK ini.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

type ArtMember = {
  noKk: string;
  nik: string;
  nama: string;
  komponen: string;
};

function isMappedToCurrentPendamping(row: Kpm, profile: Pendamping | undefined, user: SessionUser) {
  if (!row.pendamping) return false;
  if (profile?.id && row.pendampingId) return row.pendampingId === profile.id;
  return sameText(row.pendamping, profile?.nama || user.name);
}

function sameText(left: string, right: string) {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: "emerald" | "sky" | "rose" }) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    rose: "bg-rose-50 text-rose-700"
  };
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-soft">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${colors[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value.toLocaleString("id-ID")}</p>
    </div>
  );
}
