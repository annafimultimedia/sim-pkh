"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Users } from "lucide-react";
import { ActivePeriod, GroupSummary, Kpm, SessionUser } from "@/lib/types";
import { DataTable } from "./data-table";

type ReportRow = {
  reportId: number;
  groupId: number;
  groupName: string;
  pendampingId: number;
  pendamping: string;
  kecamatan: string;
  year: number;
  month: number;
  meetingDate: string | null;
  status: "DRAFT" | "TERKIRIM";
  hadir: number;
  tidakHadir: number;
};

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

type PendampingRecapRow = {
  pendamping: string;
  kecamatan: string;
  jumlahKelompok: number;
  laporanTerkirim: number;
  draft: number;
  belumLapor: number;
  totalPertemuan: number;
  persenLapor: number;
  pertemuanTerakhir: string;
  status: string;
};

type KpmRecapRow = {
  nama: string;
  nik: string;
  noKk: string;
  desa: string;
  kecamatan: string;
  kelompok: string;
  hadir: number;
  tidakHadir: number;
  totalPertemuan: number;
  pertemuanTerakhir: string;
  status: string;
  catatan: string;
};

export function RekapP2k2Client({
  user,
  groups,
  reports,
  attendanceRows = [],
  kpmRows = [],
  activePeriod
}: {
  user: SessionUser;
  groups: GroupSummary[];
  reports: ReportRow[];
  attendanceRows?: AttendanceRow[];
  kpmRows?: Kpm[];
  activePeriod: ActivePeriod;
}) {
  const [year, setYear] = useState(String(activePeriod.year));
  const [monthFrom, setMonthFrom] = useState("1");
  const [monthTo, setMonthTo] = useState("12");
  const [kecamatan, setKecamatan] = useState("SEMUA");
  const [pendamping, setPendamping] = useState("SEMUA");
  const [kelompok, setKelompok] = useState("SEMUA");
  const [reportStatus, setReportStatus] = useState("SEMUA");

  const yearOptions = useMemo(() => uniqueNumbers([...reports.map((row) => row.year), ...groups.map((group) => group.year), activePeriod.year]).sort((a, b) => b - a), [activePeriod.year, groups, reports]);
  const filteredReports = useMemo(() => {
    const from = Number(monthFrom);
    const to = Number(monthTo);
    return reports.filter((row) => {
      const inYear = row.year === Number(year);
      const inMonth = row.month >= Math.min(from, to) && row.month <= Math.max(from, to);
      const inKecamatan = kecamatan === "SEMUA" || sameText(row.kecamatan, kecamatan);
      const inPendamping = pendamping === "SEMUA" || sameText(row.pendamping, pendamping);
      const inKelompok = kelompok === "SEMUA" || sameText(row.groupName, kelompok);
      return inYear && inMonth && inKecamatan && inPendamping && inKelompok;
    });
  }, [kecamatan, kelompok, monthFrom, monthTo, pendamping, reports, year]);

  const filteredGroups = useMemo(() => groups.filter((group) => {
    const inYear = group.year === Number(year);
    const inKecamatan = kecamatan === "SEMUA" || sameText(group.kecamatan, kecamatan);
    const inPendamping = pendamping === "SEMUA" || sameText(group.pendamping, pendamping);
    const inKelompok = kelompok === "SEMUA" || sameText(group.name, kelompok);
    return inYear && inKecamatan && inPendamping && inKelompok;
  }), [groups, kecamatan, kelompok, pendamping, year]);

  const kecamatanOptions = useMemo(() => uniqueStrings(groups.filter((group) => group.year === Number(year)).map((group) => group.kecamatan)), [groups, year]);
  const pendampingOptions = useMemo(() => uniqueStrings(groups
    .filter((group) => group.year === Number(year))
    .filter((group) => kecamatan === "SEMUA" || sameText(group.kecamatan, kecamatan))
    .map((group) => group.pendamping)), [groups, kecamatan, year]);
  const kelompokOptions = useMemo(() => uniqueStrings(groups
    .filter((group) => group.year === Number(year))
    .filter((group) => kecamatan === "SEMUA" || sameText(group.kecamatan, kecamatan))
    .filter((group) => pendamping === "SEMUA" || sameText(group.pendamping, pendamping))
    .map((group) => group.name)), [groups, kecamatan, pendamping, year]);

  const activeKpmRows = useMemo(() => kpmRows.filter((row) => row.tahun === activePeriod.year && row.tahap === activePeriod.stage), [activePeriod.stage, activePeriod.year, kpmRows]);
  const kpmRecapRows = useMemo(() => buildKpmRecap(activeKpmRows, filteredGroups, attendanceRows, {
    year: Number(year),
    monthFrom: Math.min(Number(monthFrom), Number(monthTo)),
    monthTo: Math.max(Number(monthFrom), Number(monthTo)),
    kecamatan,
    kelompok,
    reportStatus
  }), [activeKpmRows, attendanceRows, filteredGroups, kecamatan, kelompok, monthFrom, monthTo, reportStatus, year]);

  const pendampingRows = useMemo(() => buildPendampingRecap(filteredGroups, filteredReports).filter((row) => {
    if (reportStatus === "SEMUA") return true;
    if (reportStatus === "TERKIRIM") return row.laporanTerkirim > 0;
    if (reportStatus === "DRAFT") return row.draft > 0;
    if (reportStatus === "BELUM_LAPOR") return row.belumLapor > 0;
    if (reportStatus === "AKTIF") return row.status === "Aktif";
    if (reportStatus === "DIPANTAU") return row.status === "Perlu Dipantau";
    return true;
  }), [filteredGroups, filteredReports, reportStatus]);
  const totalPendamping = pendampingRows.length;
  const totalGroups = pendampingRows.reduce((sum, row) => sum + row.jumlahKelompok, 0);
  const totalSentReports = pendampingRows.reduce((sum, row) => sum + row.laporanTerkirim, 0);
  const totalMissingReports = pendampingRows.reduce((sum, row) => sum + row.belumLapor, 0);

  if (user.role === "PENDAMPING") {
    const totalKpm = kpmRecapRows.length;
    const totalHadir = kpmRecapRows.reduce((sum, row) => sum + row.hadir, 0);
    const totalTidakHadir = kpmRecapRows.reduce((sum, row) => sum + row.tidakHadir, 0);
    const totalBelumAdaLaporan = kpmRecapRows.filter((row) => row.status === "Belum Ada Laporan").length;

    return (
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-white p-3 shadow-soft sm:p-4">
          <div className="grid gap-3 lg:grid-cols-5">
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
              Kelompok
              <select value={kelompok} onChange={(event) => setKelompok(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
                <option value="SEMUA">SEMUA</option>
                {kelompokOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Status KPM
              <select value={reportStatus} onChange={(event) => setReportStatus(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
                <option value="SEMUA">SEMUA</option>
                <option value="HADIR">Pernah Hadir</option>
                <option value="TIDAK_HADIR">Pernah Tidak Hadir</option>
                <option value="BELUM_LAPOR">Belum Ada Laporan</option>
              </select>
            </label>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="KPM Dampingan" value={totalKpm} icon={Users} />
          <Stat label="Hadir" value={totalHadir} icon={CheckCircle2} tone="emerald" />
          <Stat label="Tidak Hadir" value={totalTidakHadir} icon={AlertTriangle} tone="rose" />
          <Stat label="Belum Ada Laporan" value={totalBelumAdaLaporan} icon={ClipboardCheck} tone="amber" />
        </section>

        <DataTable
          rows={kpmRecapRows as any[]}
          filename="rekap-kpm-p2k2"
          searchPlaceholder="Cari nama KPM, NIK, No KK, desa, atau kelompok"
          columns={[
            { key: "nama", header: "Nama KPM" },
            { key: "nik", header: "NIK", maskNik: true },
            { key: "noKk", header: "No KK" },
            { key: "desa", header: "Desa" },
            { key: "kecamatan", header: "Kecamatan" },
            { key: "kelompok", header: "Kelompok" },
            { key: "hadir", header: "Hadir" },
            { key: "tidakHadir", header: "Tidak Hadir" },
            { key: "totalPertemuan", header: "Total Pertemuan" },
            { key: "pertemuanTerakhir", header: "Pertemuan Terakhir" },
            { key: "status", header: "Status", render: (row: KpmRecapRow) => <StatusBadge status={row.status} /> },
            { key: "catatan", header: "Catatan" }
          ] as any[]}
          rowClassName={(row) => row.status === "Belum Ada Laporan" ? "bg-rose-50" : row.tidakHadir > 0 ? "bg-amber-50" : "bg-white"}
        />
      </div>
    );
  }

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
            <select value={kecamatan} onChange={(event) => { setKecamatan(event.target.value); setPendamping("SEMUA"); setKelompok("SEMUA"); }} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              <option value="SEMUA">SEMUA</option>
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
            Status Laporan
            <select value={reportStatus} onChange={(event) => setReportStatus(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              <option value="SEMUA">SEMUA</option>
              <option value="TERKIRIM">Ada Terkirim</option>
              <option value="DRAFT">Ada Draft</option>
              <option value="BELUM_LAPOR">Belum Lapor</option>
              <option value="AKTIF">Aktif</option>
              <option value="DIPANTAU">Perlu Dipantau</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pendamping" value={totalPendamping} icon={Users} />
        <Stat label="Kelompok" value={totalGroups} icon={ClipboardCheck} tone="emerald" />
        <Stat label="Laporan Terkirim" value={totalSentReports} icon={CheckCircle2} tone="emerald" />
        <Stat label="Belum Lapor" value={totalMissingReports} icon={AlertTriangle} tone="rose" />
      </section>

      <DataTable
        rows={pendampingRows as any[]}
        filename="rekap-pendamping-p2k2"
        searchPlaceholder="Cari pendamping atau kecamatan"
        columns={[
          { key: "pendamping", header: "Nama Pendamping" },
          { key: "kecamatan", header: "Kecamatan" },
          { key: "jumlahKelompok", header: "Jumlah Kelompok" },
          { key: "laporanTerkirim", header: "Laporan Terkirim" },
          { key: "draft", header: "Draft" },
          { key: "belumLapor", header: "Belum Lapor" },
          { key: "totalPertemuan", header: "Total Pertemuan" },
          { key: "persenLapor", header: "% Lapor", render: (row: PendampingRecapRow) => `${row.persenLapor}%` },
          { key: "pertemuanTerakhir", header: "Pertemuan Terakhir" },
          { key: "status", header: "Status", render: (row: PendampingRecapRow) => <StatusBadge status={row.status} /> }
        ] as any[]}
        rowClassName={(row) => row.status === "Perlu Dipantau" ? "bg-amber-50" : row.status === "Belum Ada Laporan" ? "bg-rose-50" : "bg-white"}
      />
    </div>
  );
}

function buildKpmRecap(
  kpmRows: Kpm[],
  groups: GroupSummary[],
  attendanceRows: AttendanceRow[],
  filters: { year: number; monthFrom: number; monthTo: number; kecamatan: string; kelompok: string; reportStatus: string }
): KpmRecapRow[] {
  const groupByNik = new Map<string, GroupSummary>();
  for (const group of groups) {
    for (const nik of group.memberNiks) {
      if (nik) groupByNik.set(nik, group);
    }
  }

  const attendanceByNik = new Map<string, AttendanceRow[]>();
  for (const row of attendanceRows) {
    if (row.year !== filters.year || row.month < filters.monthFrom || row.month > filters.monthTo) continue;
    if (filters.kecamatan !== "SEMUA" && !sameText(row.kecamatan, filters.kecamatan)) continue;
    if (filters.kelompok !== "SEMUA" && !sameText(row.groupName, filters.kelompok)) continue;
    const rows = attendanceByNik.get(row.nik) ?? [];
    rows.push(row);
    attendanceByNik.set(row.nik, rows);
  }

  return kpmRows.map((kpm) => {
    const group = groupByNik.get(kpm.nik);
    const rows = attendanceByNik.get(kpm.nik) ?? [];
    const latest = rows
      .map((row) => row.meetingDate)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? "-";
    const note = rows.map((row) => row.note).find(Boolean) ?? "";
    const hadir = rows.filter((row) => row.status === "HADIR").length;
    const tidakHadir = rows.filter((row) => row.status === "TIDAK_HADIR").length;
    const status = rows.length === 0 ? "Belum Ada Laporan" : tidakHadir > 0 ? "Perlu Dipantau" : "Aktif";
    return {
      nama: kpm.nama,
      nik: kpm.nik,
      noKk: kpm.noKk,
      desa: kpm.kelurahan,
      kecamatan: group?.kecamatan || kpm.kecamatan,
      kelompok: group?.name ?? "-",
      hadir,
      tidakHadir,
      totalPertemuan: rows.length,
      pertemuanTerakhir: latest,
      status,
      catatan: note || "-"
    };
  }).filter((row) => {
    if (filters.kecamatan !== "SEMUA" && !sameText(row.kecamatan, filters.kecamatan)) return false;
    if (filters.kelompok !== "SEMUA" && !sameText(row.kelompok, filters.kelompok)) return false;
    if (filters.reportStatus === "HADIR") return row.hadir > 0;
    if (filters.reportStatus === "TIDAK_HADIR") return row.tidakHadir > 0;
    if (filters.reportStatus === "BELUM_LAPOR") return row.status === "Belum Ada Laporan";
    return true;
  }).sort((a, b) => a.kelompok.localeCompare(b.kelompok) || a.desa.localeCompare(b.desa) || a.nama.localeCompare(b.nama));
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

function StatusBadge({ status }: { status: string }) {
  const className = status === "Aktif"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === "Perlu Dipantau"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-rose-50 text-rose-700 ring-rose-200";
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ring-1 ${className}`}>{status}</span>;
}

function buildPendampingRecap(groups: GroupSummary[], reports: ReportRow[]): PendampingRecapRow[] {
  const groupMap = new Map<number, GroupSummary>();
  for (const group of groups) groupMap.set(group.id, group);

  const map = new Map<string, PendampingRecapRow & { reportedGroups: Set<number>; latestDate: string }>();
  for (const group of groups) {
    const key = `${group.pendampingId}|${group.pendamping}`;
    const existing = map.get(key) ?? {
      pendamping: group.pendamping,
      kecamatan: group.kecamatan,
      jumlahKelompok: 0,
      laporanTerkirim: 0,
      draft: 0,
      belumLapor: 0,
      totalPertemuan: 0,
      persenLapor: 0,
      pertemuanTerakhir: "-",
      status: "Belum Ada Laporan",
      reportedGroups: new Set<number>(),
      latestDate: ""
    };
    existing.jumlahKelompok += 1;
    map.set(key, existing);
  }

  for (const report of reports) {
    const group = groupMap.get(report.groupId);
    const key = group ? `${group.pendampingId}|${group.pendamping}` : `${report.pendampingId}|${report.pendamping}`;
    const existing = map.get(key) ?? {
      pendamping: report.pendamping,
      kecamatan: report.kecamatan,
      jumlahKelompok: 0,
      laporanTerkirim: 0,
      draft: 0,
      belumLapor: 0,
      totalPertemuan: 0,
      persenLapor: 0,
      pertemuanTerakhir: "-",
      status: "Belum Ada Laporan",
      reportedGroups: new Set<number>(),
      latestDate: ""
    };
    if (!group && !existing.reportedGroups.has(report.groupId)) existing.jumlahKelompok += 1;
    existing.reportedGroups.add(report.groupId);
    existing.totalPertemuan += 1;
    if (report.status === "TERKIRIM") existing.laporanTerkirim += 1;
    if (report.status === "DRAFT") existing.draft += 1;
    if (report.meetingDate && report.meetingDate > existing.latestDate) {
      existing.latestDate = report.meetingDate;
      existing.pertemuanTerakhir = report.meetingDate;
    }
    map.set(key, existing);
  }

  return [...map.values()].map((row) => {
    const expectedReports = Math.max(row.jumlahKelompok, 0);
    const reportedGroupCount = row.reportedGroups.size;
    row.belumLapor = Math.max(expectedReports - reportedGroupCount, 0);
    row.persenLapor = expectedReports ? Math.round((reportedGroupCount / expectedReports) * 100) : 0;
    row.status = row.totalPertemuan === 0
      ? "Belum Ada Laporan"
      : row.persenLapor >= 80 && row.laporanTerkirim > 0
        ? "Aktif"
        : "Perlu Dipantau";
    const { reportedGroups: _reportedGroups, latestDate: _latestDate, ...clean } = row;
    return clean;
  }).sort((a, b) => b.totalPertemuan - a.totalPertemuan || b.persenLapor - a.persenLapor || a.pendamping.localeCompare(b.pendamping));
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
