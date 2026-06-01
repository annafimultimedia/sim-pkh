"use client";

import { DragEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, ImageIcon, Loader2, Save, Send, X } from "lucide-react";
import { ActivePeriod, GroupSummary, Kpm, SessionUser } from "@/lib/types";
import { MaskedNik } from "./masked-nik";

const p2k2Materials = [
  {
    module: "Modul Pendidikan dan Pengasuhan Anak",
    sessions: [
      "Sesi 1: Menjadi Orang Tua yang Lebih Baik",
      "Sesi 2: Memahami Perilaku Anak",
      "Sesi 3: Memahami Cara Anak Usia Dini Belajar",
      "Sesi 4: Membantu Anak Sukses di Sekolah"
    ]
  },
  {
    module: "Modul Ekonomi (Pengelolaan Keuangan & Perencanaan Usaha)",
    sessions: [
      "Sesi 5: Mengelola Keuangan Keluarga",
      "Sesi 6: Cermat Meminjam dan Menabung",
      "Sesi 7: Memulai Usaha"
    ]
  },
  {
    module: "Modul Kesehatan dan Gizi",
    sessions: [
      "Sesi 8: Pentingnya Gizi dan Layanan Ibu Hamil",
      "Sesi 9: Pentingnya Gizi untuk Ibu Menyusui dan Balita",
      "Sesi 10: Kesakitan pada Anak dan Kebersihan Lingkungan"
    ]
  },
  {
    module: "Modul Perlindungan Anak",
    sessions: [
      "Sesi 11: Upaya Pencegahan Kekerasan dan Perlakuan Salah pada Anak",
      "Sesi 12: Penelantaran dan Eksploitasi terhadap Anak"
    ]
  },
  {
    module: "Modul Kesejahteraan Sosial",
    sessions: [
      "Sesi 13: Pelayanan bagi Penyandang Disabilitas Berat",
      "Sesi 14: Pentingnya Kesejahteraan Lanjut Usia (Lansia)"
    ]
  }
];

type ReportSummary = {
  id: number;
  groupId: number;
  groupName: string;
  pendamping: string;
  kecamatan: string;
  year: number;
  month: number;
  meetingDate: string | null;
  moduleName: string | null;
  sessionName: string | null;
  status: "DRAFT" | "TERKIRIM";
  photoPath: string | null;
  pdfPath: string | null;
  hadir: number;
  tidakHadir: number;
};

export function LaporanP2k2Client({
  user,
  groups,
  kpm,
  initialReports,
  initialYear,
  initialMonth,
  activePeriod
}: {
  user: SessionUser;
  groups: GroupSummary[];
  kpm: Kpm[];
  initialReports: ReportSummary[];
  initialYear: number;
  initialMonth: number;
  activePeriod: ActivePeriod;
}) {
  const router = useRouter();
  const [year, setYear] = useState(String(initialYear));
  const [month, setMonth] = useState(String(initialMonth));
  const [kecamatanFilter, setKecamatanFilter] = useState("SEMUA");
  const [pendampingFilter, setPendampingFilter] = useState("SEMUA");
  const [showArchived, setShowArchived] = useState(false);
  const [groupId, setGroupId] = useState(0);
  const [formModal, setFormModal] = useState(false);
  const [meetingDate, setMeetingDate] = useState("");
  const [moduleName, setModuleName] = useState(p2k2Materials[0].module);
  const [sessionName, setSessionName] = useState(p2k2Materials[0].sessions[0]);
  const [presentIds, setPresentIds] = useState<number[]>([]);
  const [attendanceNotes, setAttendanceNotes] = useState<Record<number, string>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [dragTarget, setDragTarget] = useState<"photo" | "pdf" | null>(null);
  const [confirmSave, setConfirmSave] = useState<"DRAFT" | "TERKIRIM" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ReportSummary | null>(null);
  const [detailReport, setDetailReport] = useState<ReportSummary | null>(null);
  const [detailAttendance, setDetailAttendance] = useState<{ kpmId: number; status: "HADIR" | "TIDAK_HADIR"; note?: string }[]>([]);
  const [existingPhoto, setExistingPhoto] = useState("");
  const [existingPdf, setExistingPdf] = useState("");
  const [reports, setReports] = useState(initialReports);
  const [preview, setPreview] = useState<{ type: "image" | "pdf"; url: string; title: string } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingReport, setLoadingReport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const todayIso = toDateInputValue(today);
  const yearOptions = useMemo(() => {
    return [...new Set([initialYear, currentYear, 2026, 2025, 2024])]
      .filter((item) => item <= currentYear)
      .sort((a, b) => b - a);
  }, [currentYear, initialYear]);
  const monthOptions = useMemo(() => months
    .map((name, index) => ({ name, value: index + 1 }))
    .filter((item) => Number(year) < currentYear || (Number(year) === currentYear && item.value <= currentMonth)), [currentMonth, currentYear, year]);
  const selectedMonthStart = `${year}-${month.padStart(2, "0")}-01`;
  const selectedMonthEnd = getMonthEnd(Number(year), Number(month));
  const maxMeetingDate = selectedMonthEnd > todayIso ? todayIso : selectedMonthEnd;

  const kecamatanOptions = useMemo(() => uniqueSorted(groups.map((group) => group.kecamatan)), [groups]);
  const pendampingOptions = useMemo(() => uniqueSorted(groups
    .filter((group) => kecamatanFilter === "SEMUA" || sameText(group.kecamatan, kecamatanFilter))
    .map((group) => group.pendamping)), [groups, kecamatanFilter]);
  const filteredGroups = useMemo(() => groups.filter((group) => {
    if (!showArchived && group.archived) return false;
    const inKecamatan = user.role !== "ADMIN" || kecamatanFilter === "SEMUA" || sameText(group.kecamatan, kecamatanFilter);
    const inPendamping = user.role !== "ADMIN" || pendampingFilter === "SEMUA" || sameText(group.pendamping, pendampingFilter);
    return inKecamatan && inPendamping;
  }), [groups, kecamatanFilter, pendampingFilter, showArchived, user.role]);
  const currentGroup = filteredGroups.find((group) => group.id === groupId) ?? filteredGroups[0];
  const activeKpm = useMemo(() => uniqueKpmByNik(kpm.filter((row) => row.tahun === activePeriod.year && row.tahap === activePeriod.stage)), [activePeriod.stage, activePeriod.year, kpm]);
  const members = useMemo(() => {
    if (!currentGroup) return [];
    return activeKpm
      .filter((row) => currentGroup.memberIds.includes(row.id) || currentGroup.memberNiks.includes(row.nik))
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [activeKpm, currentGroup]);
  const currentSessions = p2k2Materials.find((item) => item.module === moduleName)?.sessions ?? [];
  const monthReports = reports.filter((report) => report.year === Number(year) && report.month === Number(month));
  const visibleMonthReports = monthReports.filter((report) => filteredGroups.some((group) => group.id === report.groupId));
  const draftCount = visibleMonthReports.filter((report) => report.status === "DRAFT").length;
  const sentCount = visibleMonthReports.filter((report) => report.status === "TERKIRIM").length;
  const groupsWithoutReport = filteredGroups.filter((group) => !visibleMonthReports.some((report) => report.groupId === group.id));

  useEffect(() => {
    setPresentIds(members.map((member) => member.id));
  }, [members]);

  useEffect(() => {
    if (!monthOptions.some((item) => item.value === Number(month))) {
      setMonth(String(monthOptions[monthOptions.length - 1]?.value ?? currentMonth));
    }
  }, [currentMonth, month, monthOptions]);

  useEffect(() => {
    if (!meetingDate) return;
    if (meetingDate < selectedMonthStart || meetingDate > maxMeetingDate) {
      setMeetingDate("");
    }
  }, [maxMeetingDate, meetingDate, selectedMonthStart]);

  useEffect(() => {
    if (!filteredGroups.some((group) => group.id === groupId)) {
      setGroupId(0);
    }
  }, [filteredGroups, groupId]);

  useEffect(() => {
    async function loadReport() {
      if (!formModal || !groupId) return;
      setLoadingReport(true);
      setError("");
      setMessage("");
      const res = await fetch(`/api/p2k2/reports?groupId=${groupId}&year=${year}&month=${month}`);
      const json = await readJson(res);
      setLoadingReport(false);
      if (!res.ok) {
        setError(json.message ?? "Gagal membaca laporan");
        return;
      }
      const report = json.report;
      setMeetingDate(report?.meetingDate ?? "");
      setModuleName(report?.moduleName ?? p2k2Materials[0].module);
      const nextModule = report?.moduleName ?? p2k2Materials[0].module;
      const sessions = p2k2Materials.find((item) => item.module === nextModule)?.sessions ?? p2k2Materials[0].sessions;
      setSessionName(report?.sessionName ?? sessions[0]);
      setExistingPhoto(report?.photoPath ?? "");
      setExistingPdf(report?.pdfPath ?? "");
      setPhoto(null);
      setPdf(null);
      if (json.attendance?.length) {
        const present = json.attendance.filter((item: any) => item.status === "HADIR").map((item: any) => Number(item.kpmId));
        setPresentIds(present);
        setAttendanceNotes(Object.fromEntries(json.attendance.map((item: any) => [Number(item.kpmId), String(item.note ?? "")])));
      } else {
        setPresentIds(members.map((member) => member.id));
        setAttendanceNotes({});
      }
    }
    loadReport();
  }, [formModal, groupId, members, month, year]);

  function togglePresent(id: number, checked: boolean) {
    setPresentIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  }

  async function choosePhoto(file?: File | null) {
    if (!file) return;
    setError("");
    try {
      const compressed = await compressImage(file);
      if (compressed.size > 500 * 1024) {
        setError("Foto masih lebih dari 500 KB. Coba gunakan foto dengan resolusi lebih kecil.");
        return;
      }
      setPhoto(compressed);
    } catch {
      setError("Foto gagal dikompres.");
    }
  }

  function choosePdf(file?: File | null) {
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf") {
      setError("File absensi harus PDF.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("PDF absensi maksimal 1 MB. Silakan kompres PDF terlebih dahulu.");
      return;
    }
    setPdf(file);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>, target: "photo" | "pdf") {
    event.preventDefault();
    setDragTarget(null);
    const file = event.dataTransfer.files?.[0];
    if (target === "photo") choosePhoto(file);
    if (target === "pdf") choosePdf(file);
  }

  async function save(status: "DRAFT" | "TERKIRIM") {
    setConfirmSave(null);
    setSaving(true);
    setError("");
    setMessage("");
    const body = new FormData();
    body.append("groupId", String(groupId));
    body.append("year", year);
    body.append("month", month);
    body.append("meetingDate", meetingDate);
    body.append("moduleName", moduleName);
    body.append("sessionName", sessionName);
    body.append("status", status);
    body.append("attendance", JSON.stringify(members.map((member) => ({
      kpmId: member.id,
      nik: member.nik,
      nama: member.nama,
      hadir: presentIds.includes(member.id),
      note: attendanceNotes[member.id] ?? ""
    }))));
    if (photo) body.append("photo", photo);
    if (pdf) body.append("pdf", pdf);

    const res = await fetch("/api/p2k2/reports", { method: "POST", body });
    const json = await readJson(res);
    setSaving(false);
    if (!res.ok) {
      setError(json.message ?? "Gagal menyimpan laporan");
      return;
    }
    const nextReport: ReportSummary = {
      id: Number(json.id),
      groupId,
      groupName: currentGroup?.name ?? "",
      pendamping: user.name,
      kecamatan: currentGroup?.kecamatan ?? user.district ?? "",
      year: Number(year),
      month: Number(month),
      meetingDate,
      moduleName,
      sessionName,
      status,
      photoPath: json.photoPath ?? existingPhoto,
      pdfPath: json.pdfPath ?? existingPdf,
      hadir: presentIds.length,
      tidakHadir: Math.max(members.length - presentIds.length, 0)
    };
    setReports((current) => {
      const others = current.filter((report) => !(report.groupId === groupId && report.year === Number(year) && report.month === Number(month)));
      return [...others, nextReport];
    });
    setExistingPhoto(nextReport.photoPath ?? "");
    setExistingPdf(nextReport.pdfPath ?? "");
    setDetailAttendance(members.map((member) => ({ kpmId: member.id, status: presentIds.includes(member.id) ? "HADIR" : "TIDAK_HADIR", note: attendanceNotes[member.id] ?? "" })));
    setMessage(status === "TERKIRIM" ? "Laporan berhasil dikirim." : "Draft laporan berhasil disimpan.");
  }

  async function openDetail(report: ReportSummary) {
    setGroupId(report.groupId);
    setDetailReport(report);
    setDetailAttendance([]);
    const res = await fetch(`/api/p2k2/reports?groupId=${report.groupId}&year=${report.year}&month=${report.month}`);
    const json = await readJson(res);
    if (res.ok) setDetailAttendance(json.attendance ?? []);
  }

  async function deleteReport() {
    if (!confirmDelete) return;
    setDeleting(true);
    setError("");
    const res = await fetch(`/api/p2k2/reports?groupId=${confirmDelete.groupId}&year=${confirmDelete.year}&month=${confirmDelete.month}`, { method: "DELETE" });
    const json = await readJson(res);
    setDeleting(false);
    if (!res.ok) {
      setError(json.message ?? "Gagal menghapus laporan");
      return;
    }
    setReports((current) => current.filter((report) => report.id !== confirmDelete.id));
    if (detailReport?.id === confirmDelete.id) setDetailReport(null);
    if (groupId === confirmDelete.groupId) {
      setExistingPhoto("");
      setExistingPdf("");
      setPhoto(null);
      setPdf(null);
    }
    setConfirmDelete(null);
    setMessage("Laporan berhasil dihapus.");
  }

  function openForm(group: GroupSummary) {
    setGroupId(group.id);
    setFormModal(true);
    setError("");
    setMessage("");
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Jumlah Kelompok" value={filteredGroups.length} />
        <Stat label="Laporan Terkirim" value={sentCount} tone="emerald" />
        <Stat label="Draft" value={draftCount} tone="amber" />
        <Stat label="Belum Dibuat" value={Math.max(filteredGroups.length - visibleMonthReports.length, 0)} tone="rose" />
      </section>

      <section className="rounded-2xl border border-border bg-white p-3 shadow-soft sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[120px_150px_repeat(2,minmax(180px,1fr))]">
          <label className="text-sm font-semibold">
            Tahun
            <select value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              {yearOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Bulan
            <select value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              {monthOptions.map((item) => <option key={item.value} value={item.value}>{item.name}</option>)}
            </select>
          </label>
          {user.role === "ADMIN" ? (
            <>
              <label className="text-sm font-semibold">
                Kecamatan
                <select value={kecamatanFilter} onChange={(event) => { setKecamatanFilter(event.target.value); setPendampingFilter("SEMUA"); }} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
                  <option value="SEMUA">SEMUA KECAMATAN</option>
                  {kecamatanOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Nama Pendamping
                <select value={pendampingFilter} onChange={(event) => setPendampingFilter(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
                  <option value="SEMUA">SEMUA PENDAMPING</option>
                  {pendampingOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </>
          ) : null}
        </div>
        <label className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="h-4 w-4 accent-primary" />
          Tampilkan Arsip
        </label>
        {user.role === "PENDAMPING" ? <p className="mt-3 text-sm text-muted-foreground">Pendamping: <span className="font-bold text-slate-900">{user.name}</span> - Kecamatan {user.district}</p> : null}
      </section>

      <section className="rounded-2xl border border-border bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Pilih Kelompok</h2>
          <p className="text-sm text-muted-foreground">Pilih kelompok terlebih dahulu untuk membuka form laporan P2K2.</p>
        </div>

        <div className="grid gap-2">
          {groupsWithoutReport.map((group) => {
            return (
              <div key={group.id} className="grid gap-2 rounded-xl border border-border p-3 text-sm md:grid-cols-[minmax(0,1fr)_120px] md:items-center">
                <div>
                  <p className="font-bold">{group.name}</p>
                  <p className="text-xs text-muted-foreground">{group.pendamping} - {group.kecamatan} - {group.memberCount} KPM{group.archived ? " - Arsip" : ""}</p>
                </div>
                <button onClick={() => openForm(group)} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white">
                  Isi Laporan
                </button>
              </div>
            );
          })}
          {!groupsWithoutReport.length ? <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">Semua kelompok sudah memiliki laporan bulan ini.</p> : null}
        </div>
      </section>

      {formModal ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-3 sm:p-4" onPointerDown={() => setFormModal(false)}>
          <section className="mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-soft sm:max-h-[calc(100dvh-2rem)]" onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-bold">Form Laporan {currentGroup?.name ?? "-"}</h2>
                <p className="text-sm text-muted-foreground">{members.length} KPM dalam kelompok pada periode aktif Tahun {activePeriod.year} Tahap {activePeriod.stage}. Default semua hadir, hilangkan centang untuk yang tidak hadir.</p>
              </div>
              <button onClick={() => setFormModal(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {loadingReport ? <span className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat laporan...</span> : null}

              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm font-semibold">
                  Tanggal Pertemuan
                  <input type="date" value={meetingDate} min={selectedMonthStart} max={maxMeetingDate} onChange={(event) => setMeetingDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border px-3" />
                </label>
                <label className="text-sm font-semibold">
                  Materi
                  <select value={moduleName} onChange={(event) => {
                    setModuleName(event.target.value);
                    setSessionName(p2k2Materials.find((item) => item.module === event.target.value)?.sessions[0] ?? "");
                  }} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
                    {p2k2Materials.map((item) => <option key={item.module}>{item.module}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Sesi
                  <select value={sessionName} onChange={(event) => setSessionName(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
                    {currentSessions.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragTarget("photo");
                  }}
                  onDragLeave={() => setDragTarget(null)}
                  onDrop={(event) => handleDrop(event, "photo")}
                  className={`rounded-xl border-2 border-dashed p-4 text-sm transition ${dragTarget === "photo" ? "border-primary bg-primary/5" : "border-border bg-slate-50"}`}
                >
                  <span className="inline-flex items-center gap-2 font-bold"><ImageIcon className="h-4 w-4" /> Foto P2K2</span>
                  <input type="file" accept="image/*" onChange={(event) => choosePhoto(event.target.files?.[0])} className="mt-3 block w-full text-sm" />
                  <p className="mt-2 text-xs text-muted-foreground">{photo ? `${photo.name} (${formatSize(photo.size)})` : existingPhoto ? "Foto sudah tersimpan. Drag & drop untuk mengganti." : "Drag & drop foto atau pilih file. Foto dikompres otomatis maksimal 500 KB."}</p>
                </label>
                <label
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragTarget("pdf");
                  }}
                  onDragLeave={() => setDragTarget(null)}
                  onDrop={(event) => handleDrop(event, "pdf")}
                  className={`rounded-xl border-2 border-dashed p-4 text-sm transition ${dragTarget === "pdf" ? "border-primary bg-primary/5" : "border-border bg-slate-50"}`}
                >
                  <span className="inline-flex items-center gap-2 font-bold"><FileText className="h-4 w-4" /> PDF Absensi</span>
                  <input type="file" accept="application/pdf" onChange={(event) => choosePdf(event.target.files?.[0])} className="mt-3 block w-full text-sm" />
                  <p className="mt-2 text-xs text-muted-foreground">{pdf ? `${pdf.name} (${formatSize(pdf.size)})` : existingPdf ? "PDF absensi sudah tersimpan. Drag & drop untuk mengganti." : "Drag & drop PDF atau pilih file. Maksimal 1 MB."}</p>
                </label>
              </div>

              <div className="mt-4 overflow-auto rounded-xl border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-border px-3 py-2 text-left">Hadir</th>
                      <th className="border-b border-border px-3 py-2 text-left">No</th>
                      <th className="border-b border-border px-3 py-2 text-left">Nama</th>
                      <th className="border-b border-border px-3 py-2 text-left">NIK</th>
                      <th className="border-b border-border px-3 py-2 text-left">Alamat</th>
                      <th className="border-b border-border px-3 py-2 text-left">Catatan/Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member, index) => (
                      <tr key={member.id} className={presentIds.includes(member.id) ? "bg-white" : "bg-rose-50"}>
                        <td className="border-b border-border px-3 py-2"><input type="checkbox" checked={presentIds.includes(member.id)} onChange={(event) => togglePresent(member.id, event.target.checked)} /></td>
                        <td className="border-b border-border px-3 py-2">{index + 1}</td>
                        <td className="border-b border-border px-3 py-2 font-semibold">{member.nama}</td>
                        <td className="border-b border-border px-3 py-2"><MaskedNik nik={member.nik} /></td>
                        <td className="border-b border-border px-3 py-2">{member.alamat}</td>
                        <td className="border-b border-border px-3 py-2">
                          <input
                            value={attendanceNotes[member.id] ?? ""}
                            onChange={(event) => setAttendanceNotes((current) => ({ ...current, [member.id]: event.target.value }))}
                            placeholder="Opsional"
                            className="h-9 min-w-48 rounded-lg border border-border px-3 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
              {message ? <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{message}</p> : null}
            </div>
            <div className="shrink-0 border-t border-border p-4 sm:p-5">
              <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
                <button disabled={saving} onClick={() => setFormModal(false)} className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold disabled:opacity-50">
                  Tutup
                </button>
                <button disabled={saving || !groupId} onClick={() => setConfirmSave("DRAFT")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold disabled:opacity-50">
                  <Save className="h-4 w-4" /> Simpan Draft
                </button>
                <button disabled={saving || !groupId} onClick={() => setConfirmSave("TERKIRIM")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Simpan & Kirim
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-white p-5 shadow-soft">
        <h2 className="mb-3 text-lg font-bold">Rekap Laporan Bulan Ini</h2>
        <div className="grid gap-2">
          {filteredGroups.map((group) => {
            const report = visibleMonthReports.find((item) => item.groupId === group.id);
            return (
              <div key={group.id} className="grid gap-2 rounded-xl border border-border p-3 text-sm md:grid-cols-[minmax(0,1fr)_110px_105px_minmax(210px,auto)] md:items-center">
                <div>
                  <p className="font-bold">{group.name}</p>
                  <p className="text-xs text-muted-foreground">{group.kecamatan} - {group.memberCount} KPM{group.archived ? " - Arsip" : ""}</p>
                </div>
                <span className={`w-fit rounded-full px-2 py-1 text-xs font-bold ${report?.status === "TERKIRIM" ? "bg-emerald-50 text-emerald-700" : report?.status === "DRAFT" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                  {report?.status ?? "BELUM DIBUAT"}
                </span>
                <span>{report?.meetingDate ?? "-"}</span>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> {report ? `${report.hadir} hadir, ${report.tidakHadir} tidak` : "-"}</span>
                  <span className="flex shrink-0 flex-wrap justify-end gap-2">
                    {report ? <button onClick={() => openDetail(report)} className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">Lihat</button> : null}
                    {report ? <button onClick={() => openForm(group)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white">Edit</button> : null}
                    {report ? <button onClick={() => setConfirmDelete(report)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50">Hapus</button> : null}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {confirmSave ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-3 sm:grid sm:place-items-center sm:p-4" onPointerDown={() => setConfirmSave(null)}>
          <section className="mx-auto w-full max-w-md rounded-2xl bg-white p-4 shadow-soft sm:p-5" onPointerDown={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-bold">Konfirmasi Laporan</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {confirmSave === "TERKIRIM"
                ? "Kirim laporan P2K2 bulan ini? Pastikan tanggal, materi, kehadiran, foto, dan PDF absensi sudah benar."
                : "Simpan laporan sebagai draft? Data masih bisa dilengkapi dan dikirim nanti."}
            </p>
            <div className="mt-5 grid gap-2 sm:flex sm:justify-end">
              <button disabled={saving} onClick={() => setConfirmSave(null)} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-60">Batal</button>
              <button disabled={saving} onClick={() => save(confirmSave)} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "Menyimpan..." : "Ya, lanjutkan"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-3 sm:grid sm:place-items-center sm:p-4" onPointerDown={() => setConfirmDelete(null)}>
          <section className="mx-auto w-full max-w-md rounded-2xl bg-white p-4 shadow-soft sm:p-5" onPointerDown={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-bold">Hapus Laporan</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Hapus laporan <span className="font-bold text-slate-900">{confirmDelete.groupName}</span> bulan {months[confirmDelete.month - 1]} {confirmDelete.year}? Kelompok ini akan muncul lagi di Pilih Kelompok.
            </p>
            <div className="mt-5 grid gap-2 sm:flex sm:justify-end">
              <button disabled={deleting} onClick={() => setConfirmDelete(null)} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-60">Batal</button>
              <button disabled={deleting} onClick={deleteReport} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Hapus
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {detailReport ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-3 sm:grid sm:place-items-center sm:p-4" onPointerDown={() => setDetailReport(null)}>
          <section className="mx-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-soft sm:max-h-[calc(100dvh-2rem)] sm:p-5" onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Detail Laporan P2K2</h2>
                <p className="text-sm text-muted-foreground">{detailReport.groupName} - {months[detailReport.month - 1]} {detailReport.year}</p>
              </div>
              <button onClick={() => setDetailReport(null)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold">Tutup</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Info label="Tanggal" value={detailReport.meetingDate ?? "-"} />
              <Info label="Status" value={detailReport.status} />
              <Info label="Materi" value={detailReport.moduleName ?? "-"} />
              <Info label="Sesi" value={detailReport.sessionName ?? "-"} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border p-3">
                <p className="mb-2 text-sm font-bold">Foto P2K2</p>
                {detailReport.photoPath ? (
                  <button
                    type="button"
                    onClick={() => setPreview({ type: "image", url: p2k2FileUrl(detailReport.photoPath!), title: "Foto P2K2" })}
                    className="group block w-full overflow-hidden rounded-lg border border-border bg-slate-50"
                  >
                    <img src={p2k2FileUrl(detailReport.photoPath)} alt="Foto P2K2" className="max-h-72 w-full object-contain transition group-hover:scale-[1.02]" />
                    <span className="block border-t border-border bg-white px-3 py-2 text-xs font-bold text-primary">Klik untuk memperbesar</span>
                  </button>
                ) : <p className="text-sm text-muted-foreground">Foto belum tersedia.</p>}
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="mb-2 text-sm font-bold">PDF Absensi</p>
                {detailReport.pdfPath ? (
                  <button
                    type="button"
                    onClick={() => setPreview({ type: "pdf", url: p2k2FileUrl(detailReport.pdfPath!), title: "PDF Absensi" })}
                    className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
                  >
                    Lihat PDF Absensi
                  </button>
                ) : <p className="text-sm text-muted-foreground">PDF belum tersedia.</p>}
              </div>
            </div>
            <div className="mt-4 overflow-auto rounded-xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["No", "Nama", "NIK", "Status", "Catatan/Keterangan"].map((head) => <th key={head} className="border-b border-border px-3 py-2 text-left text-xs font-bold uppercase text-slate-600">{head}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, index) => {
                    const attendance = detailAttendance.find((item) => Number(item.kpmId) === member.id)?.status ?? "HADIR";
                    return (
                      <tr key={member.id} className={attendance === "HADIR" ? "bg-white" : "bg-rose-50"}>
                        <td className="border-b border-border px-3 py-2">{index + 1}</td>
                        <td className="border-b border-border px-3 py-2 font-semibold">{member.nama}</td>
                        <td className="border-b border-border px-3 py-2"><MaskedNik nik={member.nik} /></td>
                        <td className="border-b border-border px-3 py-2">{attendance === "HADIR" ? "Hadir" : "Tidak Hadir"}</td>
                        <td className="border-b border-border px-3 py-2">{detailAttendance.find((item) => Number(item.kpmId) === member.id)?.note || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {preview ? (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 p-3 sm:p-5" onPointerDown={() => setPreview(null)}>
          <section className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-soft" onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="text-base font-bold text-slate-900">{preview.title}</h2>
              <button onClick={() => setPreview(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-700 hover:bg-slate-50" aria-label="Tutup preview">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 bg-slate-100 p-2 sm:p-4">
              {preview.type === "image" ? (
                <div className="grid h-full place-items-center overflow-auto">
                  <img src={preview.url} alt={preview.title} className="max-h-full max-w-full rounded-lg object-contain shadow-soft" />
                </div>
              ) : (
                <iframe src={preview.url} title={preview.title} className="h-full w-full rounded-lg border border-border bg-white" />
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Stat({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "emerald" | "amber" | "rose" }) {
  const colors = {
    slate: "bg-white text-slate-900",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700"
  };
  return (
    <div className={`rounded-2xl border border-border p-4 shadow-soft ${colors[tone]}`}>
      <p className="text-xs font-bold uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value.toLocaleString("id-ID")}</p>
    </div>
  );
}

const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthEnd(year: number, month: number) {
  const lastDate = new Date(year, month, 0);
  return toDateInputValue(lastDate);
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function sameText(left: string, right: string) {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

function uniqueKpmByNik(rows: Kpm[]) {
  const map = new Map<string, Kpm>();
  for (const row of rows) {
    if (!map.has(row.nik)) map.set(row.nik, row);
  }
  return [...map.values()];
}

function formatSize(size: number) {
  return `${Math.round(size / 1024)} KB`;
}

function p2k2FileUrl(filePath: string) {
  return `/api/p2k2/file?path=${encodeURIComponent(filePath)}`;
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

async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas tidak tersedia");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let quality = 0.82;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > 500 * 1024 && quality > 0.45) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Gagal kompres foto")), "image/jpeg", quality);
  });
}
