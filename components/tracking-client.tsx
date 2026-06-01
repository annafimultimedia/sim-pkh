"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, BadgeCheck, CircleDollarSign, SearchX, Sparkles, Users } from "lucide-react";
import { ActivePeriod, Kpm, SessionUser } from "@/lib/types";
import { DataTable } from "./data-table";

type CompareStatus = "KPM Lama" | "KPM Baru" | "KPM Hilang";
type NominalStatus = "Naik" | "Turun" | "Tetap" | "-";

type CompareRow = {
  kategori: CompareStatus;
  nama: string;
  nik: string;
  noKk: string;
  desa: string;
  kecamatan: string;
  pendamping: string;
  nominalA: number;
  nominalB: number;
  selisih: number;
  perubahanNominal: NominalStatus;
  statusA: string;
  statusB: string;
  komponenA: number;
  komponenB: number;
};

export function TrackingClient({ user, rows, activePeriod }: { user: SessionUser; rows: Kpm[]; activePeriod: ActivePeriod }) {
  const yearOptions = useMemo(() => uniqueNumbers([...rows.map((row) => row.tahun), activePeriod.year]).sort((a, b) => b - a), [rows, activePeriod.year]);
  const stageOptions = [1, 2, 3, 4];
  const [year, setYear] = useState(String(activePeriod.year));
  const [stageA, setStageA] = useState(String(Math.max(1, activePeriod.stage - 1)));
  const [stageB, setStageB] = useState(String(activePeriod.stage));
  const [district, setDistrict] = useState("SEMUA");
  const [village, setVillage] = useState("SEMUA");
  const [pendamping, setPendamping] = useState("SEMUA");
  const [statusFilter, setStatusFilter] = useState("SEMUA");

  const rowsByYear = useMemo(() => rows.filter((row) => row.tahun === Number(year)), [rows, year]);
  const districtOptions = useMemo(() => uniqueStrings(rowsByYear.map((row) => row.kecamatan)), [rowsByYear]);
  const effectiveDistrict = user.role === "PENDAMPING" ? user.district ?? districtOptions[0] ?? "" : district;
  const villageOptions = useMemo(() => uniqueStrings(rowsByYear
    .filter((row) => effectiveDistrict === "SEMUA" || sameText(row.kecamatan, effectiveDistrict))
    .map((row) => row.kelurahan)), [rowsByYear, effectiveDistrict]);
  const pendampingOptions = useMemo(() => uniqueStrings(rowsByYear
    .filter((row) => effectiveDistrict === "SEMUA" || sameText(row.kecamatan, effectiveDistrict))
    .filter((row) => village === "SEMUA" || sameText(row.kelurahan, village))
    .map((row) => row.pendamping ?? "")), [rowsByYear, effectiveDistrict, village]);

  const filteredBase = useMemo(() => rowsByYear
    .filter((row) => effectiveDistrict === "SEMUA" || sameText(row.kecamatan, effectiveDistrict))
    .filter((row) => village === "SEMUA" || sameText(row.kelurahan, village))
    .filter((row) => pendamping === "SEMUA" || sameText(row.pendamping ?? "", pendamping)), [rowsByYear, effectiveDistrict, village, pendamping]);

  const compareRows = useMemo(() => {
    const aRows = filteredBase.filter((row) => row.tahap === Number(stageA));
    const bRows = filteredBase.filter((row) => row.tahap === Number(stageB));
    const aByNik = new Map(aRows.map((row) => [row.nik, row]));
    const bByNik = new Map(bRows.map((row) => [row.nik, row]));
    const niks = [...new Set([...aByNik.keys(), ...bByNik.keys()])];

    return niks.map((nik) => {
      const a = aByNik.get(nik);
      const b = bByNik.get(nik);
      const source = b ?? a;
      const nominalA = a?.nominal ?? 0;
      const nominalB = b?.nominal ?? 0;
      const selisih = nominalB - nominalA;
      const kategori: CompareStatus = a && b ? "KPM Lama" : b ? "KPM Baru" : "KPM Hilang";
      const perubahanNominal: NominalStatus = !a || !b ? "-" : selisih > 0 ? "Naik" : selisih < 0 ? "Turun" : "Tetap";

      return {
        kategori,
        nama: source?.nama ?? "",
        nik,
        noKk: source?.noKk ?? "",
        desa: source?.kelurahan ?? "",
        kecamatan: source?.kecamatan ?? "",
        pendamping: source?.pendamping ?? "-",
        nominalA,
        nominalB,
        selisih,
        perubahanNominal,
        statusA: a?.status ?? "-",
        statusB: b?.status ?? "-",
        komponenA: a?.komponen ?? 0,
        komponenB: b?.komponen ?? 0
      };
    }).sort((a, b) => statusOrder(a.kategori) - statusOrder(b.kategori) || a.kecamatan.localeCompare(b.kecamatan) || a.desa.localeCompare(b.desa) || a.nama.localeCompare(b.nama));
  }, [filteredBase, stageA, stageB]);

  const visibleRows = useMemo(() => compareRows.filter((row) => {
    if (statusFilter === "SEMUA") return true;
    if (statusFilter === "BERUBAH") return row.perubahanNominal === "Naik" || row.perubahanNominal === "Turun";
    if (statusFilter === "TETAP") return row.perubahanNominal === "Tetap";
    return row.kategori === statusFilter;
  }), [compareRows, statusFilter]);

  const oldRows = compareRows.filter((row) => row.kategori === "KPM Lama");
  const newRows = compareRows.filter((row) => row.kategori === "KPM Baru");
  const missingRows = compareRows.filter((row) => row.kategori === "KPM Hilang");
  const changedNominalRows = oldRows.filter((row) => row.selisih !== 0);

  const columns = getColumns(stageA, stageB);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-white p-5 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-6">
          <label className="text-sm font-semibold">
            Tahun
            <select value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              {yearOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Tahap A
            <select value={stageA} onChange={(event) => setStageA(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              {stageOptions.map((item) => <option key={item} value={item}>Tahap {item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Tahap B
            <select value={stageB} onChange={(event) => setStageB(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              {stageOptions.map((item) => <option key={item} value={item}>Tahap {item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Kecamatan
            <select disabled={user.role === "PENDAMPING"} value={effectiveDistrict || "SEMUA"} onChange={(event) => { setDistrict(event.target.value); setVillage("SEMUA"); setPendamping("SEMUA"); }} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 disabled:bg-slate-100">
              {user.role === "ADMIN" ? <option value="SEMUA">SEMUA KECAMATAN</option> : null}
              {districtOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Desa
            <select value={village} onChange={(event) => { setVillage(event.target.value); setPendamping("SEMUA"); }} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              <option value="SEMUA">SEMUA DESA</option>
              {villageOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Pendamping
            <select value={pendamping} onChange={(event) => setPendamping(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              <option value="SEMUA">SEMUA PENDAMPING</option>
              {pendampingOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-slate-700">Filter status:</span>
          {[
            ["SEMUA", "Semua"],
            ["KPM Lama", "KPM Lama"],
            ["KPM Baru", "KPM Baru"],
            ["KPM Hilang", "KPM Hilang"],
            ["BERUBAH", "Nominal Berubah"],
            ["TETAP", "Nominal Tetap"]
          ].map(([value, label]) => (
            <button key={value} onClick={() => setStatusFilter(value)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusFilter === value ? "bg-primary text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              {label}
            </button>
          ))}
        </div>
        {user.role === "PENDAMPING" ? (
          <p className="mt-3 text-sm text-muted-foreground">Kecamatan dikunci sesuai tugas pendamping, tetapi data desa dan pendamping lain dalam kecamatan tersebut tetap bisa dibandingkan.</p>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={`Total Tahap ${stageA}`} value={filteredBase.filter((row) => row.tahap === Number(stageA)).length} icon={Users} />
        <Stat label={`Total Tahap ${stageB}`} value={filteredBase.filter((row) => row.tahap === Number(stageB)).length} icon={Users} tone="sky" />
        <Stat label="KPM Lama" value={oldRows.length} icon={BadgeCheck} tone="emerald" />
        <Stat label="KPM Baru" value={newRows.length} icon={Sparkles} tone="green" />
        <Stat label="KPM Hilang" value={missingRows.length} icon={SearchX} tone="rose" />
        <Stat label="Nominal Berubah" value={changedNominalRows.length} icon={ArrowDownUp} tone="amber" />
        <Stat label="Total Selisih" value={compareRows.reduce((sum, row) => sum + row.selisih, 0)} icon={CircleDollarSign} tone="slate" currency />
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold">Hasil Komparasi</h2>
          <p className="text-sm text-muted-foreground">Menampilkan {visibleRows.length.toLocaleString("id-ID")} baris hasil perbandingan Tahap {stageA} dan Tahap {stageB}.</p>
        </div>
        <DataTable
          rows={visibleRows as any[]}
          columns={columns as any[]}
          filename={`tracking-komparasi-tahap-${stageA}-vs-${stageB}`}
          rowClassName={(row) => row.kategori === "KPM Baru" ? "bg-emerald-50/70" : row.kategori === "KPM Hilang" ? "bg-rose-50/70" : row.selisih !== 0 ? "bg-amber-50/60" : "bg-white"}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div>
          <div className="mb-3">
            <h2 className="text-lg font-bold">KPM Hilang di Tahap Terbaru</h2>
            <p className="text-sm text-muted-foreground">Ada di Tahap {stageA}, tetapi tidak muncul di Tahap {stageB}.</p>
          </div>
          <DataTable rows={missingRows as any[]} columns={columns as any[]} filename={`kpm-hilang-tahap-${stageB}`} rowClassName={() => "bg-rose-50/70"} />
        </div>
        <div>
          <div className="mb-3">
            <h2 className="text-lg font-bold">KPM Baru yang Muncul</h2>
            <p className="text-sm text-muted-foreground">Tidak ada di Tahap {stageA}, tetapi muncul di Tahap {stageB}.</p>
          </div>
          <DataTable rows={newRows as any[]} columns={columns as any[]} filename={`kpm-baru-tahap-${stageB}`} rowClassName={() => "bg-emerald-50/70"} />
        </div>
      </section>
    </div>
  );
}

function getColumns(stageA: string, stageB: string) {
  return [
    { key: "kategori", header: "Kategori" },
    { key: "nama", header: "Nama" },
    { key: "nik", header: "NIK", maskNik: true },
    { key: "noKk", header: "No KK" },
    { key: "desa", header: "Desa" },
    { key: "kecamatan", header: "Kecamatan" },
    { key: "pendamping", header: "Pendamping" },
    { key: "nominalA", header: `Nominal T${stageA}`, value: (row: CompareRow) => row.nominalA, render: (row: CompareRow) => rupiah(row.nominalA) },
    { key: "nominalB", header: `Nominal T${stageB}`, value: (row: CompareRow) => row.nominalB, render: (row: CompareRow) => rupiah(row.nominalB) },
    { key: "selisih", header: "Selisih", value: (row: CompareRow) => row.selisih, render: (row: CompareRow) => <span className={row.selisih > 0 ? "font-bold text-emerald-700" : row.selisih < 0 ? "font-bold text-rose-700" : ""}>{rupiah(row.selisih)}</span> },
    { key: "perubahanNominal", header: "Perubahan" },
    { key: "statusA", header: `Status T${stageA}` },
    { key: "statusB", header: `Status T${stageB}` },
    { key: "komponenA", header: `Komponen T${stageA}` },
    { key: "komponenB", header: `Komponen T${stageB}` }
  ];
}

function Stat({ label, value, icon: Icon, tone = "slate", currency = false }: { label: string; value: number; icon: any; tone?: "slate" | "emerald" | "green" | "sky" | "rose" | "amber" | "orange"; currency?: boolean }) {
  const colors = {
    slate: "bg-slate-50 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
    green: "bg-green-50 text-green-700",
    sky: "bg-sky-50 text-sky-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    orange: "bg-orange-50 text-orange-700"
  };
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-soft">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${colors[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight">{currency ? rupiah(value) : value.toLocaleString("id-ID")}</p>
    </div>
  );
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values.filter(Boolean))];
}

function sameText(left: string, right: string) {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

function statusOrder(status: CompareStatus) {
  return status === "KPM Baru" ? 0 : status === "KPM Hilang" ? 1 : 2;
}

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}
