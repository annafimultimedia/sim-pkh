"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Percent, Users } from "lucide-react";
import { ActivePeriod, SessionUser } from "@/lib/types";
import { DataTable } from "./data-table";

type AttendanceRow = {
  reportId: number;
  groupId: number;
  groupName: string;
  pendamping: string;
  kecamatan: string;
  desa: string;
  noKk: string;
  kpmId: number;
  nik: string;
  nama: string;
  year: number;
  month: number;
  meetingDate: string | null;
  status: "HADIR" | "TIDAK_HADIR";
  note: string;
};

type RecapRow = {
  nama: string;
  nik: string;
  noKk: string;
  kelompok: string;
  desa: string;
  kecamatan: string;
  pendamping: string;
  totalPertemuan: number;
  hadir: number;
  tidakHadir: number;
  persenHadir: number;
  bulanTidakHadir: string;
  catatan: string;
};

export function RekapP2k2Client({ user, rows, activePeriod }: { user: SessionUser; rows: AttendanceRow[]; activePeriod: ActivePeriod }) {
  const [year, setYear] = useState(String(activePeriod.year));
  const [monthFrom, setMonthFrom] = useState("1");
  const [monthTo, setMonthTo] = useState("12");
  const [kecamatan, setKecamatan] = useState(user.role === "PENDAMPING" ? user.district || "SEMUA" : "SEMUA");
  const [pendamping, setPendamping] = useState("SEMUA");
  const [kelompok, setKelompok] = useState("SEMUA");
  const [status, setStatus] = useState("SEMUA");

  const yearOptions = useMemo(() => uniqueNumbers([...rows.map((row) => row.year), activePeriod.year]).sort((a, b) => b - a), [activePeriod.year, rows]);
  const filteredRaw = useMemo(() => {
    const from = Number(monthFrom);
    const to = Number(monthTo);
    return rows.filter((row) => {
      const inYear = row.year === Number(year);
      const inMonth = row.month >= Math.min(from, to) && row.month <= Math.max(from, to);
      const inKecamatan = kecamatan === "SEMUA" || sameText(row.kecamatan, kecamatan);
      const inPendamping = pendamping === "SEMUA" || sameText(row.pendamping, pendamping);
      const inKelompok = kelompok === "SEMUA" || sameText(row.groupName, kelompok);
      return inYear && inMonth && inKecamatan && inPendamping && inKelompok;
    });
  }, [kecamatan, kelompok, monthFrom, monthTo, pendamping, rows, year]);

  const kecamatanOptions = useMemo(() => uniqueStrings(rows.filter((row) => row.year === Number(year)).map((row) => row.kecamatan)), [rows, year]);
  const pendampingOptions = useMemo(() => uniqueStrings(rows
    .filter((row) => row.year === Number(year))
    .filter((row) => kecamatan === "SEMUA" || sameText(row.kecamatan, kecamatan))
    .map((row) => row.pendamping)), [kecamatan, rows, year]);
  const kelompokOptions = useMemo(() => uniqueStrings(rows
    .filter((row) => row.year === Number(year))
    .filter((row) => kecamatan === "SEMUA" || sameText(row.kecamatan, kecamatan))
    .filter((row) => pendamping === "SEMUA" || sameText(row.pendamping, pendamping))
    .map((row) => row.groupName)), [kecamatan, pendamping, rows, year]);

  const recapRows = useMemo(() => {
    const perReportNik = new Map<string, AttendanceRow>();
    for (const row of filteredRaw) {
      const key = `${row.reportId}|${row.nik}`;
      if (!perReportNik.has(key)) perReportNik.set(key, row);
    }

    const map = new Map<string, RecapRow & { absentMonths: Set<string>; groups: Set<string>; notes: Set<string> }>();
    for (const row of perReportNik.values()) {
      const existing = map.get(row.nik) ?? {
        nama: row.nama,
        nik: row.nik,
        noKk: row.noKk,
        kelompok: row.groupName,
        desa: row.desa,
        kecamatan: row.kecamatan,
        pendamping: row.pendamping,
        totalPertemuan: 0,
        hadir: 0,
        tidakHadir: 0,
        persenHadir: 0,
        bulanTidakHadir: "",
        catatan: "",
        absentMonths: new Set<string>(),
        groups: new Set<string>(),
        notes: new Set<string>()
      };
      existing.totalPertemuan += 1;
      existing.groups.add(row.groupName);
      const monthName = months[row.month - 1] ?? String(row.month);
      if (row.status === "HADIR") existing.hadir += 1;
      if (row.status === "TIDAK_HADIR") {
        existing.tidakHadir += 1;
        existing.absentMonths.add(monthName);
      }
      if (row.note?.trim()) existing.notes.add(`${monthName}: ${row.note.trim()}`);
      existing.persenHadir = existing.totalPertemuan ? Math.round((existing.hadir / existing.totalPertemuan) * 100) : 0;
      existing.kelompok = [...existing.groups].join(", ");
      existing.bulanTidakHadir = [...existing.absentMonths].join(", ") || "-";
      existing.catatan = [...existing.notes].join("; ") || "-";
      map.set(row.nik, existing);
    }

    return [...map.values()].map(({ absentMonths: _absentMonths, groups: _groups, notes: _notes, ...row }) => row).filter((row) => {
      if (status === "SEMUA") return true;
      if (status === "SERING_HADIR") return row.totalPertemuan > 0 && row.persenHadir >= 80;
      if (status === "SERING_TIDAK_HADIR") return row.tidakHadir >= 2 || row.persenHadir < 80;
      if (status === "TIDAK_HADIR") return row.tidakHadir > 0;
      return true;
    }).sort((a, b) => b.tidakHadir - a.tidakHadir || a.nama.localeCompare(b.nama));
  }, [filteredRaw, status]);

  const totalMeetings = new Set(filteredRaw.map((row) => row.reportId)).size;
  const totalAbsent = recapRows.reduce((sum, row) => sum + row.tidakHadir, 0);
  const averagePresence = recapRows.length ? Math.round(recapRows.reduce((sum, row) => sum + row.persenHadir, 0) / recapRows.length) : 0;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-white p-3 shadow-soft sm:p-4">
        <div className="grid gap-3 lg:grid-cols-7">
          <label className="text-sm font-semibold">
            Tahun
            <select value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              {yearOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Bulan Dari
            <select value={monthFrom} onChange={(event) => setMonthFrom(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              {months.map((item, index) => <option key={item} value={index + 1}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Bulan Sampai
            <select value={monthTo} onChange={(event) => setMonthTo(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              {months.map((item, index) => <option key={item} value={index + 1}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Kecamatan
            <select disabled={user.role === "PENDAMPING"} value={kecamatan} onChange={(event) => { setKecamatan(event.target.value); setPendamping("SEMUA"); setKelompok("SEMUA"); }} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 disabled:bg-slate-100">
              {user.role === "ADMIN" ? <option value="SEMUA">SEMUA</option> : null}
              {kecamatanOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Pendamping
            <select value={pendamping} onChange={(event) => { setPendamping(event.target.value); setKelompok("SEMUA"); }} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              <option value="SEMUA">SEMUA</option>
              {pendampingOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Kelompok
            <select value={kelompok} onChange={(event) => setKelompok(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              <option value="SEMUA">SEMUA</option>
              {kelompokOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              <option value="SEMUA">SEMUA</option>
              <option value="TIDAK_HADIR">Pernah Tidak Hadir</option>
              <option value="SERING_TIDAK_HADIR">Sering Tidak Hadir</option>
              <option value="SERING_HADIR">Sering Hadir</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="KPM Dampingan" value={recapRows.length} icon={Users} />
        <Stat label="Pertemuan" value={totalMeetings} icon={CheckCircle2} tone="emerald" />
        <Stat label="Tidak Hadir" value={totalAbsent} icon={AlertTriangle} tone="rose" />
        <Stat label="Rata-rata Hadir" value={averagePresence} icon={Percent} suffix="%" tone="amber" />
      </section>

      <DataTable
        rows={recapRows as any[]}
        filename="rekap-kehadiran-p2k2"
        columns={[
          { key: "nama", header: "Nama KPM" },
          { key: "nik", header: "NIK", maskNik: true },
          { key: "noKk", header: "No KK" },
          { key: "kelompok", header: "Kelompok" },
          { key: "desa", header: "Desa" },
          { key: "kecamatan", header: "Kecamatan" },
          { key: "pendamping", header: "Pendamping" },
          { key: "totalPertemuan", header: "Total Pertemuan" },
          { key: "hadir", header: "Hadir" },
          { key: "tidakHadir", header: "Tidak Hadir" },
          { key: "persenHadir", header: "% Hadir", render: (row: RecapRow) => `${row.persenHadir}%` },
          { key: "bulanTidakHadir", header: "Bulan Tidak Hadir" },
          { key: "catatan", header: "Catatan/Keterangan" }
        ] as any[]}
        rowClassName={(row) => row.tidakHadir >= 2 ? "bg-rose-50" : row.tidakHadir > 0 ? "bg-amber-50" : "bg-white"}
      />
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone = "slate", suffix = "" }: { label: string; value: number; icon: any; tone?: "slate" | "emerald" | "rose" | "amber"; suffix?: string }) {
  const colors = {
    slate: "bg-slate-50 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700"
  };
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-soft">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${colors[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value.toLocaleString("id-ID")}{suffix}</p>
    </div>
  );
}

const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values.filter(Boolean))];
}

function sameText(left: string, right: string) {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}
