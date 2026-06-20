"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck2,
  Camera,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Loader2,
  PencilLine,
  FileWarning,
  ImageIcon,
  Printer,
  QrCode,
  Search,
  Trash2,
  Users
} from "lucide-react";
import * as XLSX from "xlsx";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { ActivePeriod, HealthVerificationElder, HealthVerificationRecord, SessionUser } from "@/lib/types";
import { MaskedNik } from "./masked-nik";

type Panel = "data" | "cetak" | "verifikasi" | "rekap";
const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const panels: { id: Panel; label: string; icon: typeof ClipboardList }[] = [
  { id: "data", label: "Data Komponen Kesehatan", icon: ClipboardList },
  { id: "cetak", label: "Cetak Kartu Kontrol", icon: Printer },
  { id: "verifikasi", label: "Pengisian Verifikasi", icon: QrCode },
  { id: "rekap", label: "Rekap Verifikasi", icon: ClipboardList }
];

export function VerifikasiKesehatanClient({ rows, activePeriod, user }: { rows: HealthVerificationElder[]; activePeriod: ActivePeriod; user: SessionUser }) {
  const [localRows, setLocalRows] = useState(rows);
  const [panel, setPanel] = useState<Panel>("data");
  const incomplete = localRows.filter((row) => row.statusData === "BELUM_LENGKAP").length;

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2">
        <SummaryCard icon={Users} label="Komponen Kesehatan" value={localRows.length} description={`Periode aktif ${activePeriod.year} Tahap ${activePeriod.stage}.`} tone="emerald" />
        <SummaryCard icon={FileWarning} label="Identitas Belum Lengkap" value={incomplete} description="Komponen kesehatan yang belum ditemukan pada Data ART." tone="amber" />
      </section>

      <section className="rounded-2xl border border-border bg-white shadow-soft">
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          {panels.map((item) => {
            const Icon = item.icon;
            const active = panel === item.id;
            return (
              <button key={item.id} type="button" onClick={() => setPanel(item.id)} className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${active ? "bg-primary text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>
                <Icon className="h-4 w-4" /> {item.label}
              </button>
            );
          })}
        </div>
        <div className="p-5">
          {panel === "data" ? <DataPanel rows={localRows} user={user} onIdentitySaved={(saved) => setLocalRows((current) => current.map((row) => row.kpmId === saved.kpmId && row.componentType === saved.componentType && row.lansiaKe === saved.slotNo ? { ...row, key: `art-manual-${row.kpmId}-${row.componentType}-${row.lansiaKe}`, namaLansia: saved.nama, lansiaNik: saved.nik, statusData: "LENGKAP", sumberData: "ART_MANUAL" } : row))} /> : null}
          {panel === "cetak" ? <PrintPanel rows={localRows} activePeriod={activePeriod} /> : null}
          {panel === "verifikasi" ? <VerificationPanel rows={localRows} activePeriod={activePeriod} /> : null}
          {panel === "rekap" ? <RekapVerificationPanel activePeriod={activePeriod} /> : null}
        </div>
      </section>
    </div>
  );
}

function DataPanel({ rows, user, onIdentitySaved }: { rows: HealthVerificationElder[]; user: SessionUser; onIdentitySaved: (saved: { kpmId: number; slotNo: number; componentType: HealthVerificationElder["componentType"]; nik: string; nama: string }) => void }) {
  const defaultKecamatan = user.role === "PENDAMPING" ? rows.find((row) => sameText(row.kecamatan, user.district ?? ""))?.kecamatan ?? rows[0]?.kecamatan ?? "SEMUA" : "SEMUA";
  const defaultPendamping = user.role === "PENDAMPING" ? rows.find((row) => sameText(row.pendamping, user.name))?.pendamping ?? rows[0]?.pendamping ?? "SEMUA" : "SEMUA";
  const [kecamatan, setKecamatan] = useState(defaultKecamatan);
  const [pendamping, setPendamping] = useState(defaultPendamping);
  const [kelompok, setKelompok] = useState("SEMUA");
  const [status, setStatus] = useState("SEMUA");
  const [component, setComponent] = useState("SEMUA");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<HealthVerificationElder | null>(null);
  const [identity, setIdentity] = useState({ nama: "", nik: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const kecamatanOptions = useMemo(() => unique(rows.map((row) => row.kecamatan)), [rows]);
  const pendampingOptions = useMemo(() => unique(rows.filter((row) => kecamatan === "SEMUA" || row.kecamatan === kecamatan).map((row) => row.pendamping)), [kecamatan, rows]);
  const kelompokOptions = useMemo(() => unique(rows.filter((row) => pendamping === "SEMUA" || row.pendamping === pendamping).map((row) => row.groupName || "BELUM ADA KELOMPOK")), [pendamping, rows]);
  const visibleRows = useMemo(() => {
    const keyword = search.trim().toUpperCase();
    return rows.filter((row) => {
      const rowGroup = row.groupName || "BELUM ADA KELOMPOK";
      const matchesSearch = !keyword || [row.namaPengurus, row.namaLansia, row.noKk, row.lansiaNik, row.desa].some((value) => value.toUpperCase().includes(keyword));
      return matchesSearch
        && (kecamatan === "SEMUA" || row.kecamatan === kecamatan)
        && (pendamping === "SEMUA" || row.pendamping === pendamping)
        && (kelompok === "SEMUA" || rowGroup === kelompok)
        && (component === "SEMUA" || row.componentType === component)
        && (status === "SEMUA" || row.statusData === status);
    });
  }, [component, kecamatan, kelompok, pendamping, rows, search, status]);
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const pageRows = visibleRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [component, kecamatan, kelompok, pageSize, pendamping, search, status]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function exportExcel() {
    const data = visibleRows.map((row, index) => ({
      No: index + 1,
      "Nama Pengurus": row.namaPengurus,
      Komponen: row.componentLabel,
      "Nama Anggota": row.namaLansia || `${row.componentLabel} ke-${row.lansiaKe} belum diketahui`,
      "NIK Anggota": row.lansiaNik,
      "No. KK": row.noKk,
      Kelompok: row.groupName || "Belum ada kelompok",
      Pendamping: row.pendamping,
      Alamat: shortAddress(row),
      "Status Data": row.statusData === "LENGKAP" ? "Lengkap" : "Belum Lengkap"
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 7 }, { wch: 28 }, { wch: 28 }, { wch: 20 }, { wch: 20 },
      { wch: 24 }, { wch: 28 }, { wch: 48 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Komponen Kesehatan");
    XLSX.writeFile(workbook, "verifikasi-kesehatan-data-komponen.xlsx");
  }

  function openIdentity(row: HealthVerificationElder) {
    setEditing(row);
    setIdentity({ nama: row.namaLansia, nik: row.lansiaNik });
    setError("");
  }

  async function saveIdentity() {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/verifikasi-kesehatan/identitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpmId: editing.kpmId, slotNo: editing.lansiaKe, componentType: editing.componentType, nama: identity.nama, nik: identity.nik })
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.message ?? "Gagal menyimpan identitas anggota");
        return;
      }
      onIdentitySaved(json);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PanelHeading icon={ClipboardList} title="Data Komponen Kesehatan" description="Data Final Closing dicocokkan dengan anggota Ibu Hamil, AUD, Lansia, dan Disabilitas pada Data ART." />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <FilterSelect label="Kecamatan" value={kecamatan} onChange={(value) => { setKecamatan(value); setPendamping("SEMUA"); setKelompok("SEMUA"); }} options={kecamatanOptions} />
        <FilterSelect label="Pendamping" value={pendamping} onChange={(value) => { setPendamping(value); setKelompok("SEMUA"); }} options={pendampingOptions} />
        <FilterSelect label="Kelompok" value={kelompok} onChange={setKelompok} options={kelompokOptions} />
        <FilterSelect label="Komponen" value={component} onChange={setComponent} options={["HAMIL", "AUD", "LANSIA", "DISABILITAS"]} labels={{ HAMIL: "Ibu Hamil", AUD: "Anak Usia Dini (AUD)", LANSIA: "Lansia", DISABILITAS: "Disabilitas" }} />
        <FilterSelect label="Status Data" value={status} onChange={setStatus} options={["LENGKAP", "BELUM_LENGKAP"]} labels={{ LENGKAP: "Lengkap", BELUM_LENGKAP: "Belum Lengkap" }} />
        <label className="text-sm font-semibold text-slate-700">
          Pencarian
          <div className="relative mt-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama, KK, NIK..." className="h-10 w-full rounded-lg border border-border pl-9 pr-3 text-sm" />
          </div>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Menampilkan <span className="font-bold text-slate-900">{visibleRows.length}</span> dari {rows.length} komponen kesehatan.
        </p>
        <button type="button" onClick={exportExcel} disabled={!visibleRows.length} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50">
          <Download className="h-4 w-4" /> Export Excel
        </button>
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="min-w-[1100px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {["No", "Nama Pengurus", "Komponen", "Nama Anggota", "NIK Anggota", "No. KK", "Kelompok", "Pendamping", "Alamat", "Status", "Aksi"].map((heading) => <th key={heading} className="border-b border-border px-3 py-3 font-bold">{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {!visibleRows.length ? (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">Tidak ada data komponen kesehatan sesuai filter.</td></tr>
            ) : pageRows.map((row, index) => (
              <tr key={row.key} className="border-b border-border last:border-0 hover:bg-slate-50/70">
                <td className="px-3 py-3 text-slate-500">{(page - 1) * pageSize + index + 1}</td>
                <td className="px-3 py-3 font-semibold text-slate-900">{row.namaPengurus}</td>
                <td className="px-3 py-3">{row.componentLabel}</td>
                <td className="px-3 py-3">{row.namaLansia || <span className="italic text-amber-700">{row.componentLabel} ke-{row.lansiaKe} belum diketahui</span>}</td>
                <td className="px-3 py-3">{row.lansiaNik ? <MaskedNik nik={row.lansiaNik} /> : "-"}</td>
                <td className="px-3 py-3">{row.noKk || "-"}</td>
                <td className="px-3 py-3">{row.groupName || <span className="text-slate-400">Belum ada kelompok</span>}</td>
                <td className="px-3 py-3">{row.pendamping || "-"}</td>
                <td className="max-w-72 px-3 py-3">{shortAddress(row)}</td>
                <td className="px-3 py-3"><StatusBadge status={row.statusData} /></td>
                <td className="px-3 py-3">
                  {row.sumberData === "ART" ? <span className="text-xs text-slate-400">Data ART</span> : (
                    <button type="button" onClick={() => openIdentity(row)} className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-white px-3 text-xs font-semibold text-primary hover:bg-primary/5">
                      <PencilLine className="h-3.5 w-3.5" /> {row.statusData === "LENGKAP" ? "Edit Identitas" : "Lengkapi Identitas"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-sm text-muted-foreground">
          Tampilkan
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="mx-2 h-9 rounded-lg border border-border bg-white px-2 font-semibold text-slate-700">
            {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          data
        </label>
        <div className="flex items-center gap-2">
          <span className="mr-1 text-sm text-muted-foreground">Halaman {page} dari {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} title="Halaman sebelumnya" className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-slate-700 disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} title="Halaman berikutnya" className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-slate-700 disabled:opacity-40">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {editing ? (
        <div className="fixed inset-0 z-[500] grid place-items-center bg-slate-950/40 p-4">
          <section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-soft">
            <h3 className="text-lg font-bold">Lengkapi Identitas Anggota</h3>
            <p className="mt-1 text-sm text-muted-foreground">{editing.namaPengurus} | No. KK {editing.noKk} | {editing.componentLabel} ke-{editing.lansiaKe}</p>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold">
                Nama Anggota
                <input value={identity.nama} onChange={(event) => setIdentity((current) => ({ ...current, nama: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal" autoFocus />
              </label>
              <label className="block text-sm font-semibold">
                NIK Anggota
                <input value={identity.nik} onChange={(event) => setIdentity((current) => ({ ...current, nik: event.target.value.replace(/\D/g, "").slice(0, 16) }))} inputMode="numeric" placeholder="16 angka" className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal" />
              </label>
            </div>
            {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            <p className="mt-4 text-xs text-muted-foreground">Data disimpan ke Data ART sebagai komponen {editing.componentLabel} dengan sumber input manual. Import ART dengan No. KK dan NIK yang sama akan menggantinya dengan data file terbaru.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} disabled={saving} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold">Batal</button>
              <button type="button" onClick={saveIdentity} disabled={saving || !identity.nama.trim() || identity.nik.length !== 16} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan Identitas
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function PrintPanel({ rows, activePeriod }: { rows: HealthVerificationElder[]; activePeriod: ActivePeriod }) {
  const completeRows = useMemo(() => rows.filter((row) => row.statusData === "LENGKAP"), [rows]);
  const groups = useMemo(() => unique(completeRows.map((row) => row.groupName || "BELUM ADA KELOMPOK")), [completeRows]);
  const [group, setGroup] = useState(groups[0] ?? "SEMUA");
  const [component, setComponent] = useState("SEMUA");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [tablePageSize, setTablePageSize] = useState(10);
  const [tablePage, setTablePage] = useState(1);
  const filteredRows = useMemo(() => {
    const keyword = search.trim().toUpperCase();
    return completeRows.filter((row) => {
      const rowGroup = row.groupName || "BELUM ADA KELOMPOK";
      return (group === "SEMUA" || rowGroup === group)
        && (component === "SEMUA" || row.componentType === component)
        && (!keyword || [row.namaPengurus, row.namaLansia, row.noKk, row.lansiaNik].some((value) => value.toUpperCase().includes(keyword)));
    });
  }, [completeRows, component, group, search]);
  const selectedRows = useMemo(() => completeRows.filter((row) => selected.has(row.key)), [completeRows, selected]);
  const sheets = useMemo(() => chunk(selectedRows, 8), [selectedRows]);
  const tableTotalPages = Math.max(1, Math.ceil(filteredRows.length / tablePageSize));
  const tableRows = filteredRows.slice((tablePage - 1) * tablePageSize, tablePage * tablePageSize);
  const allPageRowsSelected = tableRows.length > 0 && tableRows.every((row) => selected.has(row.key));

  useEffect(() => {
    setTablePage(1);
  }, [component, group, search, tablePageSize]);

  useEffect(() => {
    if (tablePage > tableTotalPages) setTablePage(tableTotalPages);
  }, [tablePage, tableTotalPages]);

  useEffect(() => {
    let cancelled = false;
    async function generateQrCodes() {
      const entries = await Promise.all(selectedRows.map(async (row) => {
        const value = `PKH-KESEHATAN|${row.kpmId}|${row.componentType}|${row.lansiaKe}|${row.noKk}|${row.lansiaNik}`;
        const image = await QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 1, width: 220 });
        return [row.key, image] as const;
      }));
      if (!cancelled) setQrCodes(Object.fromEntries(entries));
    }
    generateQrCodes();
    return () => { cancelled = true; };
  }, [selectedRows]);

  useEffect(() => {
    if (!selectedRows.length || selectedRows.some((row) => !qrCodes[row.key])) {
      setPreviewUrl("");
      return;
    }

    setGeneratingPreview(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const pdf = buildHealthCardsPdf(sheets, activePeriod.year, qrCodes);
      const groupName = group === "SEMUA" ? "SEMUA KELOMPOK" : group;
      const filename = `LEMBAR KONTROL KESEHATAN_${sanitizeFilename(groupName)}.pdf`;
      const form = new FormData();
      form.append("file", pdf.output("blob"), filename);
      form.append("filename", filename);
      try {
        const response = await fetch("/api/verifikasi-kesehatan/preview-pdf", {
          method: "POST",
          body: form,
          signal: controller.signal
        });
        const json = await response.json();
        if (response.ok) setPreviewUrl(json.url);
      } catch (error) {
        if (!controller.signal.aborted) console.error("Gagal membuat preview PDF", error);
      } finally {
        if (!controller.signal.aborted) setGeneratingPreview(false);
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activePeriod.year, group, qrCodes, selectedRows, sheets]);

  function toggleAllPageRows() {
    setSelected((current) => {
      const next = new Set(current);
      if (allPageRowsSelected) tableRows.forEach((row) => next.delete(row.key));
      else tableRows.forEach((row) => next.add(row.key));
      return next;
    });
  }

  async function downloadPdf() {
    if (!selectedRows.length || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const pdf = buildHealthCardsPdf(sheets, activePeriod.year, qrCodes);
      const groupName = group === "SEMUA" ? "SEMUA KELOMPOK" : group;
      pdf.save(`LEMBAR KONTROL KESEHATAN_${sanitizeFilename(groupName)}.pdf`);
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div>
      <PanelHeading icon={Printer} title="Cetak Kartu Kontrol" description="Format folio 21,5 x 33 cm dengan delapan kartu per lembar. Setiap anggota komponen kesehatan memperoleh satu kartu." />
      <section className="no-print mt-5 rounded-xl border border-border bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(220px,1fr)_auto]">
          <FilterSelect label="Kelompok" value={group} onChange={setGroup} options={groups} />
          <FilterSelect label="Komponen" value={component} onChange={setComponent} options={["HAMIL", "AUD", "LANSIA", "DISABILITAS"]} labels={{ HAMIL: "Ibu Hamil", AUD: "Anak Usia Dini (AUD)", LANSIA: "Lansia", DISABILITAS: "Disabilitas" }} />
          <label className="text-sm font-semibold text-slate-700">
            Pencarian
            <div className="relative mt-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama, KK, atau NIK..." className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm" />
            </div>
          </label>
          <button type="button" onClick={downloadPdf} disabled={downloadingPdf || !selectedRows.length || selectedRows.some((row) => !qrCodes[row.key])} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">
            {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloadingPdf ? "Membuat PDF..." : `Download PDF (${selectedRows.length} Kartu)`}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={allPageRowsSelected} onChange={toggleAllPageRows} className="h-4 w-4 rounded border-border text-primary" />
            Pilih semua data tampil ({tableRows.length})
          </label>
          <p className="text-sm text-muted-foreground">{selectedRows.length} kartu dipilih · {Math.ceil(selectedRows.length / 8)} lembar folio</p>
        </div>
        <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-border bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase text-slate-600">
              <tr><th className="w-12 px-3 py-2">Pilih</th><th className="px-3 py-2">Nama Pengurus</th><th className="px-3 py-2">Komponen</th><th className="px-3 py-2">Nama Anggota</th><th className="px-3 py-2">No. KK</th><th className="px-3 py-2">Kelompok</th></tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.key} className="border-t border-border">
                  <td className="px-3 py-2 text-center"><input type="checkbox" checked={selected.has(row.key)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(row.key) ? next.delete(row.key) : next.add(row.key); return next; })} className="h-4 w-4 rounded border-border text-primary" /></td>
                  <td className="px-3 py-2 font-semibold">{row.namaPengurus}</td>
                  <td className="px-3 py-2">{row.componentLabel}</td>
                  <td className="px-3 py-2">{row.namaLansia}</td>
                  <td className="px-3 py-2">{row.noKk}</td>
                  <td className="px-3 py-2">{row.groupName || "Belum ada kelompok"}</td>
                </tr>
              ))}
              {!filteredRows.length ? <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Tidak ada data lengkap sesuai filter.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm text-muted-foreground">
            Tampilkan
            <select value={tablePageSize} onChange={(event) => setTablePageSize(Number(event.target.value))} className="mx-2 h-9 rounded-lg border border-border bg-white px-2 font-semibold text-slate-700">
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            data
          </label>
          <div className="flex items-center gap-2">
            <span className="mr-1 text-sm text-muted-foreground">Halaman {tablePage} dari {tableTotalPages}</span>
            <button type="button" onClick={() => setTablePage((current) => Math.max(1, current - 1))} disabled={tablePage === 1} className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white disabled:opacity-40" title="Halaman sebelumnya">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setTablePage((current) => Math.min(tableTotalPages, current + 1))} disabled={tablePage === tableTotalPages} className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white disabled:opacity-40" title="Halaman berikutnya">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Data berstatus Belum Lengkap tidak ditampilkan dan belum dapat dicetak.</p>
      </section>

      {!selectedRows.length ? (
        <EmptyState icon={Printer} title="Pilih anggota untuk membuat preview" description="Pilih kelompok atau komponen, lalu centang anggota. Sistem menata delapan kartu pada setiap lembar folio." />
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-slate-100 shadow-soft">
          {generatingPreview || !previewUrl ? (
            <div className="grid min-h-[720px] place-items-center text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Membuat preview PDF vektor...</span>
            </div>
          ) : (
            <iframe title="Preview PDF Kartu Kontrol" src={previewUrl} className="h-[82vh] min-h-[720px] w-full bg-white" />
          )}
        </div>
      )}
    </div>
  );
}

function RekapVerificationPanel({ activePeriod }: { activePeriod: ActivePeriod }) {
  const today = jakartaToday();
  const allowedPeriods = useMemo(() => getAllowedVerificationPeriods(activePeriod.year, today), [activePeriod.year, today]);
  const [monthFrom, setMonthFrom] = useState(allowedPeriods[0]?.month ?? 1);
  const [monthTo, setMonthTo] = useState(allowedPeriods[allowedPeriods.length - 1]?.month ?? 1);
  const [group, setGroup] = useState("SEMUA");
  const [component, setComponent] = useState("SEMUA");
  const [status, setStatus] = useState("SEMUA");
  const [photoStatus, setPhotoStatus] = useState("SEMUA");
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<HealthVerificationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<HealthVerificationRecord | null>(null);

  const selectedMonths = useMemo(() => {
    const from = Math.min(monthFrom, monthTo);
    const to = Math.max(monthFrom, monthTo);
    return allowedPeriods.filter((period) => period.month >= from && period.month <= to);
  }, [allowedPeriods, monthFrom, monthTo]);

  useEffect(() => {
    let cancelled = false;
    async function loadRecords() {
      setLoading(true);
      try {
        const results = await Promise.all(selectedMonths.map(async (period) => {
          const response = await fetch(`/api/verifikasi-kesehatan/kunjungan?year=${period.year}&month=${period.month}`, { cache: "no-store" });
          const json = await response.json();
          return response.ok ? json.rows ?? [] : [];
        }));
        if (!cancelled) setRecords(results.flat());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRecords();
    return () => { cancelled = true; };
  }, [selectedMonths]);

  const groupOptions = useMemo(() => unique(records.map((record) => record.groupName || "Belum ada kelompok")), [records]);
  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toUpperCase();
    return records.filter((record) => {
      const recordGroup = record.groupName || "Belum ada kelompok";
      const hasPhoto = Boolean(record.photoPath);
      return (group === "SEMUA" || recordGroup === group)
        && (component === "SEMUA" || record.componentType === component)
        && (status === "SEMUA" || record.status === status)
        && (photoStatus === "SEMUA" || (photoStatus === "ADA" ? hasPhoto : !hasPhoto))
        && (!keyword || [record.elderName, record.elderNik, record.recipientName, record.noKk, recordGroup, record.note].some((value) => String(value ?? "").toUpperCase().includes(keyword)));
    });
  }, [component, group, photoStatus, records, search, status]);
  const photoRows = filteredRecords.filter((record) => record.photoPath);

  function exportExcel() {
    const data = filteredRecords.map((record, index) => ({
      No: index + 1,
      Bulan: `${monthNames[record.month - 1]} ${record.year}`,
      "Nama Anggota": record.elderName,
      "NIK Anggota": record.elderNik,
      Komponen: record.componentLabel,
      Pengurus: record.recipientName,
      "No KK": record.noKk,
      Kelompok: record.groupName || "Belum ada kelompok",
      Status: record.status === "HADIR" ? "Hadir" : "Tidak Hadir",
      Keterangan: record.note || "-",
      "Nama File Foto": record.photoPath ? verificationPhotoFilename(record) : "-"
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 6 }, { wch: 16 }, { wch: 28 }, { wch: 22 }, { wch: 22 },
      { wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 32 }, { wch: 42 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Verifikasi");
    XLSX.writeFile(workbook, `${rekapExportBaseName("Rekap-verifikasi", group, selectedMonths)}.xlsx`);
  }

  async function exportPhotoZip() {
    if (!photoRows.length || exportingZip) return;
    setExportingZip(true);
    try {
      const files = await Promise.all(photoRows.map(async (record) => {
        const response = await fetch(publicUploadUrl(record.photoPath!));
        if (!response.ok) return null;
        return { name: verificationPhotoFilename(record), blob: await response.blob() };
      }));
      const zipBlob = await createStoredZip(files.filter(Boolean) as { name: string; blob: Blob }[]);
      downloadBlob(zipBlob, `${rekapExportBaseName("Foto-zip", group, selectedMonths)}.zip`);
    } finally {
      setExportingZip(false);
    }
  }

  return (
    <div>
      <PanelHeading icon={ClipboardList} title="Rekap Verifikasi" description="Rekap hasil entri verifikasi kesehatan berdasarkan periode, kelompok, status, dan kelengkapan foto." />
      <section className="mt-5 rounded-xl border border-border bg-slate-50 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm font-semibold">Bulan Dari<select value={monthFrom} onChange={(event) => setMonthFrom(Number(event.target.value))} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">{allowedPeriods.map((period) => <option key={period.key} value={period.month}>{period.label}</option>)}</select></label>
          <label className="text-sm font-semibold">Bulan Sampai<select value={monthTo} onChange={(event) => setMonthTo(Number(event.target.value))} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">{allowedPeriods.map((period) => <option key={period.key} value={period.month}>{period.label}</option>)}</select></label>
          <label className="text-sm font-semibold">Kelompok<select value={group} onChange={(event) => setGroup(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3"><option value="SEMUA">Semua</option>{groupOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm font-semibold">Komponen<select value={component} onChange={(event) => setComponent(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3"><option value="SEMUA">Semua</option><option value="HAMIL">Ibu Hamil</option><option value="AUD">Anak Usia Dini (AUD)</option><option value="LANSIA">Lansia</option><option value="DISABILITAS">Disabilitas</option></select></label>
          <label className="text-sm font-semibold">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3"><option value="SEMUA">Semua</option><option value="HADIR">Hadir</option><option value="TIDAK_HADIR">Tidak Hadir</option></select></label>
          <label className="text-sm font-semibold">Foto<select value={photoStatus} onChange={(event) => setPhotoStatus(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3"><option value="SEMUA">Semua</option><option value="ADA">Ada Foto</option><option value="TANPA">Tanpa Foto</option></select></label>
        </div>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, NIK, KK, kelompok..." className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm" />
          </div>
          <div className="grid gap-2 sm:flex">
            <button type="button" onClick={exportExcel} disabled={!filteredRecords.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50"><Download className="h-4 w-4" /> Export Excel</button>
            <button type="button" onClick={exportPhotoZip} disabled={!photoRows.length || exportingZip} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">{exportingZip ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} Export Foto ZIP</button>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-border">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h3 className="font-bold">Hasil Rekap</h3>
            <p className="mt-1 text-sm text-muted-foreground">{loading ? "Memuat data..." : `${filteredRecords.length.toLocaleString("id-ID")} entri, ${photoRows.length.toLocaleString("id-ID")} foto.`}</p>
          </div>
        </div>
        <div className="relative overflow-x-auto">
          {loading ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/75 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white px-5 py-4 shadow-soft">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <span className="text-sm font-semibold text-slate-700">Memuat data...</span>
              </div>
            </div>
          ) : null}
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                {["No", "Bulan", "Komponen / Nama Anggota", "NIK Anggota", "Pengurus / No KK", "Kelompok", "Status", "Keterangan", "Foto"].map((heading) => <th key={heading} className="px-3 py-3 text-left">{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, index) => (
                <tr key={`${record.id}-${record.month}-${record.year}`} className="border-t border-border">
                  <td className="px-3 py-3">{index + 1}</td>
                  <td className="px-3 py-3">{monthNames[record.month - 1]} {record.year}</td>
                  <td className="px-3 py-3"><span className="block text-xs font-bold text-primary">{record.componentLabel}</span><strong>{record.elderName}</strong></td>
                  <td className="px-3 py-3">{record.elderNik}</td>
                  <td className="px-3 py-3">{record.recipientName}<span className="block text-xs text-muted-foreground">{record.noKk}</span></td>
                  <td className="px-3 py-3">{record.groupName || "Belum ada kelompok"}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${record.status === "HADIR" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{record.status === "HADIR" ? "Hadir" : "Tidak Hadir"}</span></td>
                  <td className="max-w-60 px-3 py-3">{record.note || "-"}</td>
                  <td className="px-3 py-3">{record.photoPath ? <button type="button" onClick={() => setPreviewPhoto(record)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-50 px-3 text-xs font-bold text-sky-700"><ImageIcon className="h-3.5 w-3.5" /> Lihat</button> : <span className="text-xs text-slate-400">-</span>}</td>
                </tr>
              ))}
              {!filteredRecords.length ? <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Belum ada data rekap sesuai filter.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {previewPhoto?.photoPath ? <PhotoPreviewModal record={previewPhoto} records={records} onClose={() => setPreviewPhoto(null)} /> : null}
    </div>
  );
}

function VerificationPanel({ rows, activePeriod }: { rows: HealthVerificationElder[]; activePeriod: ActivePeriod }) {
  const completeRows = useMemo(() => rows.filter((row) => row.statusData === "LENGKAP"), [rows]);
  const today = jakartaToday();
  const allowedPeriods = useMemo(() => getAllowedVerificationPeriods(activePeriod.year, today), [activePeriod.year, today]);
  const [periodKey, setPeriodKey] = useState(allowedPeriods[allowedPeriods.length - 1].key);
  const selectedPeriod = allowedPeriods.find((period) => period.key === periodKey) ?? allowedPeriods[allowedPeriods.length - 1];
  const year = selectedPeriod.year;
  const month = selectedPeriod.month;
  const [visitDate, setVisitDate] = useState(clampVisitDateToPeriod(today, selectedPeriod.year, selectedPeriod.month, Number(today.slice(8, 10))));
  const [entryMode, setEntryMode] = useState<"single" | "multi">("single");
  const [selectedMonthKeys, setSelectedMonthKeys] = useState<Set<string>>(new Set([periodKey]));
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<HealthVerificationElder | null>(null);
  const [pendingScan, setPendingScan] = useState<HealthVerificationElder | null>(null);
  const [status, setStatus] = useState<"HADIR" | "TIDAK_HADIR">("HADIR");
  const [note, setNote] = useState("");
  const [monthAttendance, setMonthAttendance] = useState<Record<string, { status: "HADIR" | "TIDAK_HADIR"; note: string }>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [existingNotice, setExistingNotice] = useState<HealthVerificationRecord | null>(null);
  const [records, setRecords] = useState<HealthVerificationRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HealthVerificationRecord | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<HealthVerificationRecord | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [resultSearch, setResultSearch] = useState("");
  const [resultPageSize, setResultPageSize] = useState(10);
  const [resultPage, setResultPage] = useState(1);
  const scannerRef = useRef<any>(null);
  const scannerSectionRef = useRef<HTMLElement | null>(null);
  const scannerPausedRef = useRef(false);
  const selectedPeriodRef = useRef({ year, month });
  const recordsRef = useRef<HealthVerificationRecord[]>([]);
  const lastScanRef = useRef({ value: "", at: 0 });
  const searchResults = useMemo(() => {
    const keyword = search.trim().toUpperCase();
    if (!keyword) return [];
    return completeRows.filter((row) => [row.namaPengurus, row.namaLansia, row.componentLabel, row.noKk, row.lansiaNik, row.groupName].some((value) => value.toUpperCase().includes(keyword))).slice(0, 20);
  }, [completeRows, search]);
  const currentPeriodRecords = useMemo(
    () => records.filter((record) => Number(record.year) === year && Number(record.month) === month),
    [month, records, year]
  );
  const recordMap = useMemo(() => new Map(currentPeriodRecords.map((record) => [`${record.kpmId}-${record.componentType}-${record.slotNo}`, record])), [currentPeriodRecords]);
  const filteredRecords = useMemo(() => {
    const keyword = resultSearch.trim().toUpperCase();
    if (!keyword) return currentPeriodRecords;
    return currentPeriodRecords.filter((record) =>
      [record.componentLabel, record.elderName, record.elderNik, record.recipientName, record.noKk, record.groupName, record.note]
        .some((value) => value.toUpperCase().includes(keyword))
    );
  }, [currentPeriodRecords, resultSearch]);
  const resultTotalPages = Math.max(1, Math.ceil(filteredRecords.length / resultPageSize));
  const resultRows = filteredRecords.slice((resultPage - 1) * resultPageSize, resultPage * resultPageSize);

  useEffect(() => {
    selectedPeriodRef.current = { year, month };
    lastScanRef.current = { value: "", at: 0 };
    if (entryMode === "single") setSelectedMonthKeys(new Set([periodKey]));
  }, [month, year]);

  useEffect(() => {
    setMonthAttendance((current) => {
      const next = { ...current };
      for (const key of selectedMonthKeys) {
        if (!next[key]) next[key] = { status: "HADIR", note: "" };
      }
      return next;
    });
  }, [selectedMonthKeys]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview("");
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  useEffect(() => {
    recordsRef.current = currentPeriodRecords;
  }, [currentPeriodRecords]);

  useEffect(() => {
    setVisitDate(clampVisitDateToPeriod(today, year, month, Number(visitDate.slice(8, 10)) || Number(today.slice(8, 10))));
  }, [month, today, visitDate, year]);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner?.isScanning) scanner.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRecords([]);
    setExistingNotice(null);
    setLoadingRecords(true);
    fetch(`/api/verifikasi-kesehatan/kunjungan?year=${year}&month=${month}`, { cache: "no-store" })
      .then(async (response) => ({ response, json: await response.json() }))
      .then(({ response, json }) => {
        if (!cancelled && response.ok) setRecords(json.rows ?? []);
      })
      .finally(() => { if (!cancelled) setLoadingRecords(false); });
    return () => { cancelled = true; };
  }, [month, year]);

  useEffect(() => {
    setResultPage(1);
  }, [month, resultPageSize, resultSearch, year]);

  useEffect(() => {
    if (resultPage > resultTotalPages) setResultPage(resultTotalPages);
  }, [resultPage, resultTotalPages]);

  async function chooseElder(row: HealthVerificationElder, loadExisting = false) {
    const selectedPeriod = selectedPeriodRef.current;
    const scanner = scannerRef.current;
    if (scanner?.isScanning && !scannerPausedRef.current) {
      scanner.pause(true);
      scannerPausedRef.current = true;
    }
    setSelected(row);
    setSearch("");
    setMessage("");
    setError("");
    let existing = recordsRef.current.find((record) =>
      Number(record.year) === selectedPeriod.year
      && Number(record.month) === selectedPeriod.month
      && (
        (record.kpmId === row.kpmId && record.componentType === row.componentType && record.slotNo === row.lansiaKe)
        || (record.componentType === row.componentType && record.elderNik === row.lansiaNik)
      )
    )
      ?? null;
    setExistingNotice(existing);
    setStatus(loadExisting && existing ? existing.status : "HADIR");
    setNote(loadExisting && existing ? existing.note : "");
    if (existing?.visitDate) setVisitDate(existing.visitDate);
    if (!existing) {
      try {
        const response = await fetch(`/api/verifikasi-kesehatan/kunjungan?year=${selectedPeriod.year}&month=${selectedPeriod.month}&kpmId=${row.kpmId}&componentType=${row.componentType}&slotNo=${row.lansiaKe}`, { cache: "no-store" });
        const json = await response.json();
        existing = response.ok ? json.rows?.[0] ?? null : null;
        if (existing) {
          setExistingNotice(existing);
          if (loadExisting) {
            setStatus(existing.status);
            setNote(existing.note);
            if (existing.visitDate) setVisitDate(existing.visitDate);
          }
        }
      } catch {}
    }
  }

  function editRecord(record: HealthVerificationRecord) {
    const row = completeRows.find((item) => item.kpmId === record.kpmId && item.componentType === record.componentType && item.lansiaKe === record.slotNo);
    if (!row) {
      setError("Data anggota untuk entri ini tidak lagi ditemukan.");
      return;
    }
    void chooseElder(row, true);
    setStatus(record.status);
    setNote(record.note);
    setVisitDate(record.visitDate);
    setMessage(`Mengoreksi verifikasi ${record.elderName}. Simpan kembali setelah diperbaiki.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function startScanner() {
    setScannerError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setScannerError(cameraSecureContextMessage());
      return;
    }
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = scannerRef.current ?? new Html5Qrcode("health-qr-reader");
      scannerRef.current = scanner;
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras.length) {
        setScannerError("Kamera tidak ditemukan pada perangkat ini.");
        return;
      }
      const rearCamera = cameras.find((camera) => /back|rear|environment|belakang/i.test(camera.label));
      const cameraId = rearCamera?.id ?? cameras[cameras.length - 1].id;
      await scanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        (decodedText: string) => {
          const now = Date.now();
          if (lastScanRef.current.value === decodedText && now - lastScanRef.current.at < 2500) return;
          lastScanRef.current = { value: decodedText, at: now };
          const parsed = parseHealthQr(decodedText);
          if (!parsed) {
            setScannerError("QR tidak dikenali sebagai kartu kontrol kesehatan.");
            return;
          }
          const row = completeRows.find((item) => item.kpmId === parsed.kpmId && item.componentType === parsed.componentType && item.lansiaKe === parsed.slotNo && item.noKk === parsed.noKk && item.lansiaNik === parsed.nik);
          if (!row) {
            setScannerError("Data pada QR tidak ditemukan atau identitas anggota sudah berubah.");
            return;
          }
          if (scanner?.isScanning && !scannerPausedRef.current) {
            scanner.pause(true);
            scannerPausedRef.current = true;
          }
          setPendingScan(row);
          setMessage("");
          setScannerError("");
        },
        () => {}
      );
      scannerPausedRef.current = false;
      setScannerActive(true);
    } catch (scannerStartError: any) {
      setScannerActive(false);
      setScannerError(cameraErrorMessage(scannerStartError));
    }
  }

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (scanner?.isScanning) await scanner.stop().catch(() => {});
    scannerPausedRef.current = false;
    setScannerActive(false);
  }

  async function saveVerification() {
    if (!selected) return;
    const activeKeys = entryMode === "multi" ? [...selectedMonthKeys] : [periodKey];
    const savePeriods = allowedPeriods
      .filter((period) => activeKeys.includes(period.key))
      .map((period) => ({
        year: period.year,
        month: period.month,
        visitDate: clampVisitDateToPeriod(today, period.year, period.month, Number(visitDate.slice(8, 10)) || Number(today.slice(8, 10))),
        status: entryMode === "multi" ? monthAttendance[period.key]?.status ?? "HADIR" : status,
        note: entryMode === "multi" ? monthAttendance[period.key]?.note ?? "" : note
      }));
    if (!savePeriods.length) {
      setError("Pilih minimal satu bulan verifikasi.");
      return;
    }
    if (savePeriods.some((period) => period.status === "TIDAK_HADIR" && !period.note.trim())) {
      setError("Keterangan wajib diisi untuk bulan yang Tidak Hadir.");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const form = new FormData();
      form.append("kpmId", String(selected.kpmId));
      form.append("slotNo", String(selected.lansiaKe));
      form.append("componentType", selected.componentType);
      form.append("elderNik", selected.lansiaNik);
      form.append("elderName", selected.namaLansia);
      form.append("year", String(year));
      form.append("month", String(month));
      form.append("visitDate", visitDate);
      form.append("periods", JSON.stringify(savePeriods));
      form.append("status", status);
      form.append("note", note);
      if (photoFile) form.append("photo", await compressImageFile(photoFile));
      const response = await fetch("/api/verifikasi-kesehatan/kunjungan", { method: "POST", body: form });
      const json = await response.json();
      if (!response.ok) {
        setError(json.message ?? "Gagal menyimpan verifikasi");
        return;
      }
      const refreshed = await fetch(`/api/verifikasi-kesehatan/kunjungan?year=${year}&month=${month}`, { cache: "no-store" });
      const refreshedJson = await refreshed.json();
      if (refreshed.ok) setRecords(refreshedJson.rows ?? []);
      setMessage(`Verifikasi ${selected.namaLansia} berhasil disimpan${savePeriods.length > 1 ? ` untuk ${savePeriods.length} bulan` : ""}.`);
      setSelected(null);
      setExistingNotice(null);
      setEntryMode("single");
      setSelectedMonthKeys(new Set([periodKey]));
      setStatus("HADIR");
      setNote("");
      setMonthAttendance({});
      setPhotoFile(null);
      const scanner = scannerRef.current;
      if (scanner?.isScanning && scannerPausedRef.current) {
        scanner.resume();
        scannerPausedRef.current = false;
      }
    } catch {
      setError("Tidak dapat terhubung ke server. Silakan coba kembali.");
    } finally {
      setSaving(false);
    }
  }

  function closeVerificationModal() {
    setSelected(null);
    setPendingScan(null);
    setExistingNotice(null);
    setStatus("HADIR");
    setNote("");
    setEntryMode("single");
    setSelectedMonthKeys(new Set([periodKey]));
    setPhotoFile(null);
    setMonthAttendance({});
    setError("");
    const scanner = scannerRef.current;
    if (scanner?.isScanning && scannerPausedRef.current) {
      scanner.resume();
      scannerPausedRef.current = false;
    }
  }

  async function deleteRecord(record: HealthVerificationRecord) {
    setDeletingId(record.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/verifikasi-kesehatan/kunjungan", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id })
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.message ?? "Gagal menghapus verifikasi");
        return;
      }
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setConfirmDelete(null);
      setMessage(`Verifikasi ${record.elderName} berhasil dihapus.`);
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setDeletingId(null);
    }
  }

  const verifiedCount = currentPeriodRecords.length;
  const hadirCount = currentPeriodRecords.filter((record) => record.status === "HADIR").length;
  const absentCount = currentPeriodRecords.filter((record) => record.status === "TIDAK_HADIR").length;
  const selectedMonthLabels = allowedPeriods.filter((period) => selectedMonthKeys.has(period.key)).map((period) => period.label);
  const selectedPeriods = allowedPeriods.filter((period) => selectedMonthKeys.has(period.key));
  const missingMultiNote = entryMode === "multi" && selectedPeriods.some((period) => {
    const attendance = monthAttendance[period.key] ?? { status: "HADIR", note: "" };
    return attendance.status === "TIDAK_HADIR" && !attendance.note.trim();
  });

  return (
    <div>
      <PanelHeading icon={QrCode} title="Pengisian Verifikasi Bulanan" description="Tersedia dua cara pengisian: scan QR melalui perangkat berkamera atau pencarian manual melalui komputer." />
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniVerificationStat label="Sudah Diverifikasi" value={verifiedCount} tone="sky" />
        <MiniVerificationStat label="Hadir" value={hadirCount} tone="emerald" />
        <MiniVerificationStat label="Tidak Hadir" value={absentCount} tone="rose" />
      </div>

      <section className="mt-5 rounded-xl border border-border bg-slate-50 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Mode Pengisian<select value={entryMode} onChange={(event) => {
            const mode = event.target.value as "single" | "multi";
            setEntryMode(mode);
            setSelectedMonthKeys(mode === "single" ? new Set([periodKey]) : new Set([periodKey]));
          }} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3"><option value="single">Isi per bulan</option><option value="multi">Multi bulan</option></select></label>
          <label className="text-sm font-semibold">Periode Tampilan<select value={periodKey} onChange={(event) => { setPeriodKey(event.target.value); if (entryMode === "single") setSelectedMonthKeys(new Set([event.target.value])); }} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">{allowedPeriods.map((period) => <option key={period.key} value={period.key}>{period.label}</option>)}</select></label>
        </div>
        {entryMode === "multi" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {allowedPeriods.map((period) => (
              <label key={period.key} className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold ${selectedMonthKeys.has(period.key) ? "border-primary bg-primary/10 text-primary" : "border-border bg-white text-slate-600"}`}>
                <input
                  type="checkbox"
                  checked={selectedMonthKeys.has(period.key)}
                  onChange={(event) => setSelectedMonthKeys((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(period.key);
                    else next.delete(period.key);
                    return next;
                  })}
                  className="h-3.5 w-3.5"
                />
                {period.label}
              </label>
            ))}
          </div>
        ) : null}
      </section>

      <section ref={scannerSectionRef} className="mt-5 scroll-mt-20 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" /><h3 className="font-bold">Scan QR Kartu Kontrol</h3></div><p className="mt-1 text-sm text-muted-foreground">Kamera tetap aktif setelah penyimpanan untuk memindai kartu berikutnya.</p></div>
          {!scannerActive ? <button type="button" onClick={startScanner} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white">Buka Pemindai</button> : <button type="button" onClick={stopScanner} className="h-10 rounded-lg border border-border bg-white px-4 text-sm font-semibold">Tutup Pemindai</button>}
        </div>
        {pendingScan ? (
          <div className="mx-auto mt-4 max-w-lg rounded-2xl bg-amber-400 p-4 text-slate-950 shadow-soft">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold">Nama</span><span>: {pendingScan.namaLansia}</span>
              <span className="font-semibold">Pengurus</span><span>: {pendingScan.namaPengurus}</span>
              <span className="font-semibold">Alamat</span><span>: {shortAddress(pendingScan)}</span>
              <span className="font-semibold">Kelompok</span><span>: {pendingScan.groupName || "Belum ada kelompok"}</span>
            </div>
            <div className="mt-4 grid grid-cols-[0.8fr_1.2fr] gap-3">
              <button type="button" onClick={() => { setPendingScan(null); const scanner = scannerRef.current; if (scanner?.isScanning && scannerPausedRef.current) { scanner.resume(); scannerPausedRef.current = false; } }} className="h-11 rounded-xl bg-white/80 text-sm font-bold">Batal</button>
              <button type="button" onClick={() => { const row = pendingScan; setPendingScan(null); void chooseElder(row); }} className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white">Pilih Data</button>
            </div>
          </div>
        ) : null}
        <div id="health-qr-reader" className={`mx-auto mt-4 max-w-lg overflow-hidden rounded-xl ${scannerActive ? "border border-border" : ""}`} />
        {scannerError ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{scannerError}</p> : null}
      </section>

      <div className="mt-5">
        <section className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" /><h3 className="font-bold">Cari Manual</h3></div>
          <p className="mt-1 text-sm text-muted-foreground">Cari nama pengurus, anggota, komponen, NIK, nomor KK, atau kelompok.</p>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ketik minimal nama atau nomor..." className="h-10 w-full rounded-lg border border-border pl-9 pr-3 text-sm" />
          </div>
          {search ? <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-border">
            {searchResults.length ? searchResults.map((row) => {
              const existing = recordMap.get(`${row.kpmId}-${row.componentType}-${row.lansiaKe}`);
              return <button key={row.key} type="button" onClick={() => void chooseElder(row)} className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-3 text-left last:border-0 hover:bg-slate-50"><span><strong className="block text-sm">{row.namaLansia}</strong><span className="text-xs text-muted-foreground">{row.componentLabel} | {row.namaPengurus} | {row.noKk} | {row.groupName || "Belum ada kelompok"}</span></span>{existing ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{existing.status === "HADIR" ? "Hadir" : "Tidak Hadir"}</span> : null}</button>;
            }) : <p className="px-3 py-8 text-center text-sm text-muted-foreground">Data tidak ditemukan.</p>}
          </div> : null}
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">Pencarian manual dan pemindai QR menggunakan form penyimpanan yang sama.</div>
        </section>
      </div>
      {message ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {!selected && error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      <p className="mt-4 text-sm text-muted-foreground">{loadingRecords ? "Memuat rekap verifikasi..." : `${verifiedCount.toLocaleString("id-ID")} dari ${completeRows.length.toLocaleString("id-ID")} komponen kesehatan sudah diverifikasi pada ${monthNames[month - 1]} ${year}.`}</p>

      <section className="mt-6 rounded-xl border border-border">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-4">
          <div>
            <h3 className="font-bold">Hasil Verifikasi</h3>
            <p className="mt-1 text-sm text-muted-foreground">Entri yang salah dapat dibuka kembali melalui tombol Koreksi.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="text-xs font-semibold text-slate-600">Tampilkan
              <select value={resultPageSize} onChange={(event) => setResultPageSize(Number(event.target.value))} className="ml-2 h-9 rounded-lg border border-border bg-white px-2 text-sm">
                {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={resultSearch} onChange={(event) => setResultSearch(event.target.value)} placeholder="Cari hasil..." className="h-9 rounded-lg border border-border pl-9 pr-3 text-sm" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3 text-center">No</th>
                <th className="px-3 py-3 text-left">Komponen / Nama Anggota</th>
                <th className="px-3 py-3 text-left">Pengurus / No. KK</th>
                <th className="px-3 py-3 text-left">Kelompok</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-3 py-3 text-left">Keterangan / Foto</th>
                <th className="px-3 py-3 text-left">Diisi Oleh</th>
                <th className="px-3 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {resultRows.map((record, index) => (
                <tr key={record.id} className="border-t border-border">
                  <td className="px-3 py-3 text-center">{(resultPage - 1) * resultPageSize + index + 1}</td>
                  <td className="px-3 py-3"><span className="block text-xs font-bold text-primary">{record.componentLabel}</span><strong>{record.elderName}</strong><span className="block text-xs text-muted-foreground">{record.elderNik}</span></td>
                  <td className="px-3 py-3">{record.recipientName}<span className="block text-xs text-muted-foreground">{record.noKk}</span></td>
                  <td className="px-3 py-3">{record.groupName || "Belum ada kelompok"}</td>
                  <td className="px-3 py-3 text-center"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${record.status === "HADIR" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{record.status === "HADIR" ? "Hadir" : "Tidak Hadir"}</span></td>
                  <td className="max-w-56 px-3 py-3">
                    <span className="block">{record.note || "-"}</span>
                    {record.photoPath ? (
                      <button type="button" onClick={() => setPreviewPhoto(record)} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-50 px-3 text-xs font-bold text-sky-700">
                        <ImageIcon className="h-3.5 w-3.5" /> Lihat Foto
                      </button>
                    ) : <span className="mt-2 block text-xs text-slate-400">Tanpa foto</span>}
                  </td>
                  <td className="px-3 py-3">{record.verifiedBy || "-"}<span className="block text-xs text-muted-foreground">{record.updatedAt}</span></td>
                  <td className="px-3 py-3 text-center"><div className="inline-flex gap-2"><button type="button" onClick={() => editRecord(record)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-50 px-3 text-xs font-bold text-amber-800"><PencilLine className="h-3.5 w-3.5" /> Koreksi</button><button type="button" onClick={() => setConfirmDelete(record)} disabled={deletingId === record.id} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-50 px-3 text-xs font-bold text-rose-700 disabled:opacity-50">{deletingId === record.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Hapus</button></div></td>
                </tr>
              ))}
              {!resultRows.length ? <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Belum ada hasil verifikasi pada bulan ini.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border p-3 text-sm">
          <span>{filteredRecords.length.toLocaleString("id-ID")} hasil</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={resultPage <= 1} onClick={() => setResultPage((page) => page - 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span>Halaman {resultPage} dari {resultTotalPages}</span>
            <button type="button" disabled={resultPage >= resultTotalPages} onClick={() => setResultPage((page) => page + 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </section>
      {selected ? (
        <div className="fixed inset-0 z-[500] grid place-items-end bg-slate-950/50 p-0 sm:place-items-center sm:p-4">
          <section className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Form Verifikasi Kesehatan</h3>
                <p className="text-sm text-muted-foreground">{entryMode === "multi" ? selectedMonthLabels.join(", ") || "Multi bulan" : `${monthNames[month - 1]} ${year}`}</p>
              </div>
              <button type="button" onClick={closeVerificationModal} disabled={saving} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600 disabled:opacity-50" aria-label="Tutup"><span className="text-xl leading-none">&times;</span></button>
            </div>
            <div className="mt-4 rounded-xl bg-primary/5 p-4">
              <p className="text-sm font-bold text-primary">{selected.componentLabel}</p>
              <p className="text-xl font-bold">{selected.namaLansia}</p>
              <p className="mt-1 text-sm text-muted-foreground">Pengurus: {selected.namaPengurus}</p>
              <p className="text-sm text-muted-foreground">No. KK: {selected.noKk}</p>
              <p className="text-sm text-muted-foreground">Kelompok: {selected.groupName || "Belum ada kelompok"}</p>
            </div>
            {existingNotice ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-bold">Verifikasi bulan ini sudah ada.</p>
                <p className="mt-1">Status sebelumnya: <strong>{existingNotice.status === "HADIR" ? "Hadir" : "Tidak Hadir"}</strong>{existingNotice.note ? ` | ${existingNotice.note}` : ""}. Menyimpan form ini akan memperbarui data sebelumnya.</p>
              </div>
            ) : null}
            {entryMode === "multi" ? (
              <div className="mt-4 space-y-3">
                {selectedPeriods.length ? selectedPeriods.map((period) => {
                  const attendance = monthAttendance[period.key] ?? { status: "HADIR", note: "" };
                  return (
                    <div key={period.key} className="rounded-xl border border-border p-3">
                      <p className="text-sm font-bold">{period.label}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(["HADIR", "TIDAK_HADIR"] as const).map((value) => (
                          <button key={value} type="button" onClick={() => setMonthAttendance((current) => ({
                            ...current,
                            [period.key]: { status: value, note: value === "HADIR" ? "" : current[period.key]?.note ?? "" }
                          }))} className={`h-11 rounded-xl border text-sm font-bold ${attendance.status === value ? value === "HADIR" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-rose-600 bg-rose-50 text-rose-700" : "border-border bg-white text-slate-600"}`}>{value === "HADIR" ? "Hadir" : "Tidak Hadir"}</button>
                        ))}
                      </div>
                      {attendance.status === "TIDAK_HADIR" ? (
                        <textarea value={attendance.note} onChange={(event) => setMonthAttendance((current) => ({ ...current, [period.key]: { status: "TIDAK_HADIR", note: event.target.value } }))} rows={2} placeholder="Keterangan tidak hadir" className="mt-3 w-full rounded-xl border border-border p-3 text-sm" />
                      ) : null}
                    </div>
                  );
                }) : <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Pilih minimal satu bulan.</p>}
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {(["HADIR", "TIDAK_HADIR"] as const).map((value) => <button key={value} type="button" onClick={() => { setStatus(value); if (value === "HADIR") setNote(""); }} className={`h-14 rounded-xl border text-sm font-bold ${status === value ? value === "HADIR" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-rose-600 bg-rose-50 text-rose-700" : "border-border bg-white text-slate-600"}`}>{value === "HADIR" ? "Hadir" : "Tidak Hadir"}</button>)}
                </div>
                {status === "TIDAK_HADIR" ? <label className="mt-4 block text-sm font-semibold">Keterangan Tidak Hadir<textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Contoh: sakit, bepergian, atau alasan lainnya" className="mt-1 w-full rounded-xl border border-border p-3 font-normal" /></label> : null}
              </>
            )}
            <label className="mt-4 block text-sm font-semibold">
              Foto Verifikasi
              <span className="mt-1 flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-slate-50 p-3 text-center font-normal text-muted-foreground">
                {photoPreview ? <img src={photoPreview} alt="Preview foto verifikasi" className="mb-3 max-h-44 rounded-lg object-contain" /> : <Camera className="mb-2 h-7 w-7 text-slate-400" />}
                <span className="text-xs">Ambil foto atau pilih dari galeri. Otomatis dikompres sekitar di bawah 500 KB.</span>
                <input type="file" accept="image/*" capture="environment" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} className="mt-3 w-full text-xs" />
              </span>
            </label>
            {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            <div className="mt-5 grid grid-cols-[0.8fr_1.2fr] gap-3">
              <button type="button" onClick={closeVerificationModal} disabled={saving} className="h-12 rounded-xl border border-border bg-white text-sm font-bold disabled:opacity-50">Batal</button>
              <button type="button" onClick={saveVerification} disabled={saving || (entryMode === "single" && status === "TIDAK_HADIR" && !note.trim()) || missingMultiNote} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />}Simpan</button>
            </div>
          </section>
        </div>
      ) : null}
      {confirmDelete ? (
        <div className="fixed inset-0 z-[510] grid place-items-end bg-slate-950/50 p-0 sm:place-items-center sm:p-4">
          <section className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <h3 className="text-lg font-bold">Hapus Hasil Verifikasi?</h3>
            <p className="mt-2 text-sm text-muted-foreground">Data {confirmDelete.componentLabel} atas nama <span className="font-bold text-slate-900">{confirmDelete.elderName}</span> untuk {monthNames[confirmDelete.month - 1]} {confirmDelete.year} akan dihapus.</p>
            <div className="mt-5 grid grid-cols-[0.8fr_1.2fr] gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)} disabled={deletingId === confirmDelete.id} className="h-11 rounded-xl border border-border bg-white text-sm font-bold disabled:opacity-50">Batal</button>
              <button type="button" onClick={() => void deleteRecord(confirmDelete)} disabled={deletingId === confirmDelete.id} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white disabled:opacity-50">{deletingId === confirmDelete.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Hapus</button>
            </div>
          </section>
        </div>
      ) : null}
      {previewPhoto?.photoPath ? <PhotoPreviewModal record={previewPhoto} records={records} onClose={() => setPreviewPhoto(null)} /> : null}
    </div>
  );
}

function PhotoPreviewModal({ record, records, onClose }: { record: HealthVerificationRecord; records: HealthVerificationRecord[]; onClose: () => void }) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const photoMonths = useMemo(() => {
    if (record.photoMonths) {
      return record.photoMonths.split(",").map((value) => {
        const [monthValue, yearValue] = value.split("/");
        const monthNumber = Number(monthValue);
        return monthNames[monthNumber - 1] && yearValue ? `${monthNames[monthNumber - 1]} ${yearValue}` : value;
      });
    }
    return records
      .filter((item) => item.photoPath === record.photoPath && item.elderNik === record.elderNik)
      .map((item) => `${monthNames[item.month - 1]} ${item.year}`)
      .filter((label, index, labels) => labels.indexOf(label) === index);
  }, [record, records]);
  const filename = verificationPhotoFilename(record);
  const photoUrl = publicUploadUrl(record.photoPath!);

  return (
    <div className="fixed inset-0 z-[520] grid place-items-end bg-slate-950/70 p-0 sm:place-items-center sm:p-4">
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Foto Verifikasi</h3>
            <p className="mt-1 text-sm text-muted-foreground">{record.elderName} | {photoMonths.length ? photoMonths.join(", ") : `${monthNames[record.month - 1]} ${record.year}`}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600" aria-label="Tutup"><span className="text-xl leading-none">&times;</span></button>
        </div>
        <div className="relative mt-4 min-h-64 overflow-hidden rounded-xl bg-slate-50">
          {imageLoading ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/80">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-semibold text-slate-600">Memuat foto...</span>
              </div>
            </div>
          ) : null}
          {imageError ? (
            <div className="grid min-h-64 place-items-center px-4 text-center text-sm font-semibold text-rose-700">
              Foto tidak bisa dimuat. Coba download atau periksa file di server.
            </div>
          ) : null}
          <img
            src={photoUrl}
            alt={`Foto verifikasi ${record.elderName}`}
            className={`max-h-[72vh] w-full object-contain ${imageError ? "hidden" : ""}`}
            onLoad={() => {
              setImageLoading(false);
              setImageError(false);
            }}
            onError={() => {
              setImageLoading(false);
              setImageError(true);
            }}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <a href={photoUrl} download={filename} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white"><Download className="h-4 w-4" /> Download Foto</a>
        </div>
      </section>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, labels = {} }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-border bg-white px-3 text-sm">
        <option value="SEMUA">Semua</option>
        {options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: HealthVerificationElder["statusData"] }) {
  return status === "LENGKAP"
    ? <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Lengkap</span>
    : <span className="whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Belum Lengkap</span>;
}

function MiniVerificationStat({ label, value, tone }: { label: string; value: number; tone: "sky" | "emerald" | "rose" }) {
  const tones = { sky: "bg-sky-50 text-sky-700", emerald: "bg-emerald-50 text-emerald-700", rose: "bg-rose-50 text-rose-700" };
  return <div className={`rounded-xl px-4 py-3 ${tones[tone]}`}><p className="text-xs font-semibold">{label}</p><p className="mt-1 text-2xl font-black">{value.toLocaleString("id-ID")}</p></div>;
}

function PanelHeading({ icon: Icon, title, description }: { icon: typeof ClipboardList; title: string; description: string }) {
  return <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>;
}

function SummaryCard({ icon: Icon, label, value, description, tone }: { icon: typeof ClipboardList; label: string; value: number; description: string; tone: "emerald" | "amber" | "sky" }) {
  const tones = { emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", sky: "bg-sky-50 text-sky-700" };
  return <div className="rounded-2xl border border-border bg-white p-5 shadow-soft"><div className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div><p className="mt-4 text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value.toLocaleString("id-ID")}</p><p className="mt-2 text-xs text-muted-foreground">{description}</p></div>;
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof ClipboardList; title: string; description: string }) {
  return <div className="mt-5 grid min-h-64 place-items-center rounded-xl border border-dashed border-border bg-slate-50/60 p-6 text-center"><div className="max-w-md"><Icon className="mx-auto h-9 w-9 text-slate-400" /><p className="mt-3 font-bold text-slate-700">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>;
}

function ModeCard({ icon: Icon, title, description, action }: { icon: typeof QrCode; title: string; description: string; action: string }) {
  return <article className="rounded-xl border border-border bg-slate-50 p-5"><Icon className="h-7 w-7 text-primary" /><h3 className="mt-3 font-bold">{title}</h3><p className="mt-1 min-h-10 text-sm text-muted-foreground">{description}</p><button disabled className="mt-4 h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white opacity-50">{action}</button></article>;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function sameText(left: string, right: string) {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function shortAddress(row: HealthVerificationElder) {
  return [row.alamatFc, row.rt && `RT ${row.rt}`, row.rw && `RW ${row.rw}`].filter(Boolean).join(", ") || "-";
}

function buildHealthCardsPdf(sheets: HealthVerificationElder[][], year: number, qrCodes: Record<string, string>) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [215, 330], compress: true });
  sheets.forEach((sheet, sheetIndex) => {
    if (sheetIndex > 0) pdf.addPage([215, 330], "portrait");
    sheet.forEach((row, cardIndex) => drawControlCardPdf(pdf, row, year, qrCodes[row.key], cardIndex));
    drawEmptyCardSlots(pdf, sheet.length);
  });
  return pdf;
}

function drawControlCardPdf(pdf: jsPDF, row: HealthVerificationElder, year: number, qrCode: string | undefined, cardIndex: number) {
  const cardWidth = 107.5;
  const cardHeight = 82.5;
  const x = (cardIndex % 2) * cardWidth;
  const y = Math.floor(cardIndex / 2) * cardHeight;
  const padding = 5;
  const leftWidth = 46.2;
  const dividerX = x + leftWidth;
  const tableX = dividerX + 2.5;
  const tableY = y + padding;
  const tableWidth = x + cardWidth - padding - tableX;
  const tableHeight = cardHeight - (padding * 2);
  const headerHeight = 6;
  const rowHeight = (tableHeight - headerHeight) / 12;
  const columns = [5, 14, 12.5, 11, tableWidth - 42.5];
  const months = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];

  pdf.setDrawColor(71, 85, 105);
  pdf.setLineWidth(0.14);
  pdf.setLineDashPattern([1.2, 1.2], 0);
  pdf.rect(x, y, cardWidth, cardHeight);
  pdf.setLineDashPattern([], 0);
  pdf.setDrawColor(51, 65, 85);
  pdf.setLineWidth(0.1);
  pdf.line(dividerX, y + padding, dividerX, y + cardHeight - padding);

  const leftX = x + padding;
  const leftContentWidth = leftWidth - (padding * 2);
  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.2);
  pdf.text("LEMBAR KONTROL", leftX + leftContentWidth / 2, y + 8, { align: "center" });
  pdf.setFontSize(6.4);
  pdf.text("KUNJUNGAN POSYANDU KPM PKH", leftX + leftContentWidth / 2, y + 11.2, { align: "center" });
  pdf.setFontSize(5.5);
  pdf.text(`TAHUN ${year}`, leftX + leftContentWidth / 2, y + 14, { align: "center" });

  const labelX = leftX;
  const colonX = leftX + 17.5;
  const valueX = leftX + 19.5;
  const valueWidth = leftContentWidth - 19.5;
  const infoRows = [
    ["PENGURUS", row.namaPengurus],
    ["KOMPONEN", row.componentLabel.toUpperCase()],
    ["NAMA", row.namaLansia],
    ["ALAMAT", shortAddress(row)],
    ["POSYANDU", "........................"]
  ];
  let infoY = y + 19;
  pdf.setFontSize(5.4);
  for (const [label, value] of infoRows) {
    pdf.setFont("helvetica", "normal");
    pdf.text(label, labelX, infoY);
    pdf.text(":", colonX, infoY);
    pdf.setFont("helvetica", label === "PENGURUS" || label === "KOMPONEN" || label === "NAMA" ? "bold" : "normal");
    const lines = label === "KOMPONEN" || label === "NAMA" || label === "ALAMAT"
      ? pdf.splitTextToSize(value, valueWidth)
      : [fitPdfText(pdf, value, valueWidth)];
    pdf.text(lines, valueX, infoY);
    infoY += Math.max(3.4, lines.length * 2.65);
  }

  const qrSize = 15.5;
  const qrX = x + leftWidth - padding - qrSize;
  const qrY = y + cardHeight - padding - qrSize - 3;
  if (qrCode) pdf.addImage(qrCode, "PNG", qrX, qrY, qrSize, qrSize, undefined, "FAST");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(4.6);
  pdf.text(fitPdfText(pdf, row.noKk, qrSize), qrX + qrSize / 2, qrY + qrSize + 2.2, { align: "center" });

  const noteWidth = qrX - leftX - 1.5;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(4.7);
  const groupLines = pdf.splitTextToSize(`NAMA KELOMPOK: ${row.groupName || "BELUM ADA KELOMPOK"}`, noteWidth);
  const groupY = qrY - 4.5;
  pdf.text(groupLines, leftX, groupY);

  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(4.9);
  const visitNote = pdf.splitTextToSize("Komponen wajib melakukan kunjungan ke posyandu setiap bulan.", noteWidth);
  const visitNoteY = groupY + (groupLines.length * 2.1) + 1.4;
  pdf.text(visitNote, leftX, visitNoteY);
  pdf.setFont("helvetica", "bolditalic");
  pdf.text(pdf.splitTextToSize("Kartu wajib dibawa saat pertemuan kelompok.", noteWidth), leftX, visitNoteY + (visitNote.length * 2.1) + 1.5);

  pdf.setDrawColor(15, 23, 42);
  pdf.setLineWidth(0.1);
  pdf.rect(tableX, tableY, tableWidth, tableHeight);
  let lineX = tableX;
  for (let index = 0; index < columns.length - 1; index += 1) {
    lineX += columns[index];
    pdf.line(lineX, tableY, lineX, tableY + tableHeight);
  }
  pdf.line(tableX, tableY + headerHeight, tableX + tableWidth, tableY + headerHeight);
  for (let index = 1; index < 12; index += 1) {
    const lineY = tableY + headerHeight + rowHeight * index;
    pdf.line(tableX, lineY, tableX + tableWidth, lineY);
  }

  const headings = ["NO", "BULAN", "TGL", "PARAF", "KET"];
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.5);
  let cellX = tableX;
  headings.forEach((heading, index) => {
    pdf.text(heading, cellX + columns[index] / 2, centeredPdfTextY(tableY, headerHeight, 5.5), { align: "center" });
    cellX += columns[index];
  });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(5.2);
  months.forEach((month, index) => {
    const rowTop = tableY + headerHeight + rowHeight * index;
    const textY = centeredPdfTextY(rowTop, rowHeight, 5.2);
    pdf.text(String(index + 1), tableX + columns[0] / 2, textY, { align: "center" });
    pdf.text(fitPdfText(pdf, month, columns[1] - 1), tableX + columns[0] + columns[1] / 2, textY, { align: "center" });
  });
}

function drawEmptyCardSlots(pdf: jsPDF, filledSlots: number) {
  pdf.setDrawColor(148, 163, 184);
  pdf.setLineWidth(0.14);
  pdf.setLineDashPattern([1.2, 1.2], 0);
  for (let index = filledSlots; index < 8; index += 1) {
    const x = (index % 2) * 107.5;
    const y = Math.floor(index / 2) * 82.5;
    pdf.rect(x, y, 107.5, 82.5);
  }
  pdf.setLineDashPattern([], 0);
}

function fitPdfText(pdf: jsPDF, value: string, maxWidth: number) {
  if (pdf.getTextWidth(value) <= maxWidth) return value;
  let text = value;
  while (text.length > 1 && pdf.getTextWidth(`${text}...`) > maxWidth) text = text.slice(0, -1);
  return `${text.trimEnd()}...`;
}

function centeredPdfTextY(top: number, height: number, fontSize: number) {
  return top + (height / 2) + (fontSize * 0.3528 * 0.32);
}

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}

function publicUploadUrl(value: string) {
  return `/api/verifikasi-kesehatan/file?path=${encodeURIComponent(value)}`;
}

function verificationPhotoFilename(record: HealthVerificationRecord) {
  const extension = record.photoPath?.split(".").pop()?.split("?")[0] || "jpg";
  return `${safeFilenamePart(record.elderNik)}_${safeFilenamePart(record.elderName)}_${safeFilenamePart(monthNames[record.month - 1].toUpperCase())}_${record.year}.${extension}`;
}

function rekapExportBaseName(prefix: string, group: string, periods: { year: number; month: number; label: string }[]) {
  const groupPart = group === "SEMUA" ? "Semua-Kelompok" : group;
  const periodPart = exportPeriodLabel(periods);
  return [prefix, groupPart, periodPart].map(safeFilenamePart).join("-");
}

function exportPeriodLabel(periods: { year: number; month: number; label: string }[]) {
  if (!periods.length) return "Periode";
  const first = periods[0];
  const last = periods[periods.length - 1];
  if (first.year === last.year && first.month === last.month) {
    return `${monthNames[first.month - 1]}-${first.year}`;
  }
  if (first.year === last.year) {
    return `${monthNames[first.month - 1]}-sd-${monthNames[last.month - 1]}-${first.year}`;
  }
  return `${monthNames[first.month - 1]}-${first.year}-sd-${monthNames[last.month - 1]}-${last.year}`;
}

function safeFilenamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase() || "DATA";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function createStoredZip(files: { name: string; blob: Blob }[]) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const usedNames = new Map<string, number>();

  for (const file of files) {
    const count = usedNames.get(file.name) ?? 0;
    usedNames.set(file.name, count + 1);
    const filename = count ? addFilenameSuffix(file.name, count + 1) : file.name;
    const nameBytes = encoder.encode(filename);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...localParts, ...centralParts, end].map(uint8ToArrayBuffer), { type: "application/zip" });
}

function uint8ToArrayBuffer(value: Uint8Array) {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

function addFilenameSuffix(filename: string, suffix: number) {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return `${filename}_${suffix}`;
  return `${filename.slice(0, dot)}_${suffix}${filename.slice(dot)}`;
}

function crc32(data: Uint8Array) {
  let crc = -1;
  for (const byte of data) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

async function compressImageFile(file: File, targetBytes = 500 * 1024) {
  if (!file.type.startsWith("image/") || file.size <= targetBytes) return file;

  const image = await loadImage(file);
  const maxDimension = 1280;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let bestBlob: Blob | null = null;
  for (const quality of [0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34]) {
    const blob = await canvasToBlob(canvas, quality);
    if (!blob) continue;
    bestBlob = blob;
    if (blob.size <= targetBytes) break;
  }
  if (!bestBlob || bestBlob.size >= file.size) return file;
  return new File([bestBlob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg", lastModified: Date.now() });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca foto"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

function parseHealthQr(value: string) {
  const parts = value.trim().split("|");
  const legacy = parts[0] === "PKH-LANSIA";
  const [prefix, kpmId, componentTypeValue, slotNo, noKk, nik] = legacy
    ? [parts[0], parts[1], "LANSIA", parts[2], parts[3], parts[4]]
    : parts;
  const parsedKpmId = Number(kpmId);
  const parsedSlotNo = Number(slotNo);
  const componentType = ["HAMIL", "AUD", "LANSIA", "DISABILITAS"].includes(componentTypeValue)
    ? componentTypeValue as HealthVerificationElder["componentType"]
    : null;

  if (
    (prefix !== "PKH-LANSIA" && prefix !== "PKH-KESEHATAN") ||
    !componentType ||
    !Number.isInteger(parsedKpmId) ||
    parsedKpmId <= 0 ||
    !Number.isInteger(parsedSlotNo) ||
    parsedSlotNo <= 0 ||
    !noKk ||
    !nik
  ) {
    return null;
  }

  return {
    kpmId: parsedKpmId,
    componentType,
    slotNo: parsedSlotNo,
    noKk,
    nik,
  };
}

function cameraErrorMessage(error: unknown) {
  const name = typeof error === "object" && error && "name" in error ? String((error as { name?: unknown }).name) : "";
  const message = typeof error === "object" && error && "message" in error
    ? String((error as { message?: unknown }).message)
    : String(error ?? "");
  const detail = `${name} ${message}`.toLowerCase();

  if (detail.includes("notallowed") || detail.includes("permission") || detail.includes("denied")) {
    return "Izin kamera ditolak. Buka pengaturan situs pada browser, izinkan Kamera, lalu muat ulang halaman.";
  }
  if (detail.includes("notfound") || detail.includes("devicesnotfound")) {
    return "Kamera tidak ditemukan pada perangkat ini.";
  }
  if (detail.includes("notreadable") || detail.includes("trackstarterror") || detail.includes("could not start")) {
    return "Kamera sedang digunakan aplikasi lain. Tutup aplikasi kamera atau video call, lalu coba kembali.";
  }
  if (detail.includes("overconstrained")) {
    return "Kamera perangkat tidak cocok dengan pengaturan pemindai. Coba muat ulang halaman.";
  }
  if (detail.includes("security") || detail.includes("secure")) {
    return "Kamera diblokir karena halaman tidak menggunakan HTTPS.";
  }
  return "Kamera tidak dapat dibuka. Pastikan izin kamera aktif dan halaman dibuka langsung melalui Chrome.";
}

function cameraSecureContextMessage() {
  const host = window.location.hostname;
  const productionHost = "sim.peduakadua.com";
  const targetHost = host && host !== productionHost ? host : productionHost;
  return `Kamera hanya dapat digunakan melalui alamat HTTPS. Buka aplikasi melalui https://${targetHost}, bukan alamat http:// atau IP lokal.`;
}

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getAllowedVerificationPeriods(activeYear: number, today: string) {
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const lastMonth = activeYear === currentYear ? currentMonth : 12;
  return Array.from({ length: lastMonth }, (_, index) => {
    const month = index + 1;
    return {
      year: activeYear,
      month,
      key: `${activeYear}-${String(month).padStart(2, "0")}`,
      label: `${monthNames[month - 1]} ${activeYear}`
    };
  });
}

function clampVisitDateToPeriod(today: string, year: number, month: number, preferredDay: number) {
  const maxDay = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(preferredDay || 1, 1), maxDay);
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return value > today ? today : value;
}
