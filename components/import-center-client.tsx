"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, FileSpreadsheet, Loader2, Trash2, UploadCloud, XCircle } from "lucide-react";
import { DataTable } from "./data-table";
import { ActivePeriod, DistrictOption } from "@/lib/types";

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

export function ImportCenterClient({ districts, logs, activePeriod }: { districts: DistrictOption[]; logs: ImportLog[]; activePeriod: ActivePeriod }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const districtBoxRef = useRef<HTMLLabelElement>(null);
  const [year, setYear] = useState(String(activePeriod.year));
  const [stage, setStage] = useState(String(activePeriod.stage));
  const [districtText, setDistrictText] = useState("");
  const [districtOpen, setDistrictOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [modal, setModal] = useState<{ open: boolean; status: "processing" | "success" | "error"; title: string; message: string }>({
    open: false,
    status: "processing",
    title: "",
    message: ""
  });
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    function closeDropdown(event: MouseEvent) {
      if (districtBoxRef.current && !districtBoxRef.current.contains(event.target as Node)) {
        setDistrictOpen(false);
      }
    }
    document.addEventListener("mousedown", closeDropdown);
    return () => document.removeEventListener("mousedown", closeDropdown);
  }, []);

  const selectedDistrict = useMemo(() => {
    const q = districtText.trim().toUpperCase();
    return districts.find((district) => district.name.toUpperCase() === q || `${district.name} - ${district.regencyName}`.toUpperCase() === q);
  }, [districtText, districts]);
  const yearOptions = useMemo(() => [...new Set([activePeriod.year, 2026, 2025, 2024])].sort((a, b) => b - a), [activePeriod.year]);
  const filteredDistricts = useMemo(() => {
    const q = districtText.trim().toUpperCase();
    if (!q) return districts;
    return districts.filter((district) => district.name.toUpperCase().includes(q));
  }, [districtText, districts]);

  async function submit() {
    if (!file) {
      setModal({ open: true, status: "error", title: "File belum dipilih", message: "Pilih file Excel Final Closing terlebih dahulu." });
      return;
    }
    if (!selectedDistrict) {
      setModal({ open: true, status: "error", title: "Kecamatan belum dipilih", message: "Ketik dan pilih nama kecamatan dari daftar master wilayah sebelum import." });
      return;
    }
    setModal({ open: true, status: "processing", title: "Import sedang diproses", message: "File Final Closing sedang divalidasi dan disimpan ke database. Mohon tunggu." });
    const body = new FormData();
    body.append("file", file);
    body.append("year", year);
    body.append("stage", stage);
    body.append("districtId", selectedDistrict.id);
    const res = await fetch("/api/import/final-closing", { method: "POST", body });
    const json = await res.json();
    if (!res.ok) {
      setModal({ open: true, status: "error", title: "Import gagal", message: json.message ?? "File gagal diimport." });
      return;
    }
    setFile(null);
    setDistrictText("");
    if (fileRef.current) fileRef.current.value = "";
    setModal({ open: true, status: "success", title: "Import berhasil", message: `${json.imported} data baru dan ${json.updated ?? 0} data update berhasil diproses untuk Kecamatan ${json.district}, Tahun ${year} Tahap ${stage}. ${json.carriedPendamping ?? 0} NIK otomatis mengikuti pendamping dari tahap sebelumnya.` });
    router.refresh();
  }

  async function clearFinalClosing() {
    setConfirmClear(false);
    setModal({ open: true, status: "processing", title: "Mengosongkan data", message: "Semua data Final Closing sedang dihapus. Mohon tunggu." });
    const res = await fetch("/api/import/final-closing/clear", { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setModal({ open: true, status: "error", title: "Gagal mengosongkan data", message: json.message ?? "Terjadi kesalahan saat menghapus data." });
      return;
    }
    setModal({ open: true, status: "success", title: "Data dikosongkan", message: "Semua data Final Closing berhasil dihapus." });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold">Import Final Closing</h2>
            <p className="text-sm text-muted-foreground">Tahun dan tahap otomatis mengikuti periode aktif. Satu tahun/tahap dapat menerima beberapa file.</p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-4">
          <label className="text-sm font-semibold">
            Tahun
            <select value={year} onChange={(e) => setYear(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              {yearOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Tahap
            <select value={stage} onChange={(e) => setStage(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
              {[1, 2, 3, 4].map((item) => <option key={item} value={item}>Tahap {item}</option>)}
            </select>
          </label>
          <label ref={districtBoxRef} className="relative text-sm font-semibold lg:col-span-2">
            Nama Kecamatan
            <div className="relative mt-1">
              <input
                value={districtText}
                onFocus={() => setDistrictOpen(true)}
                onChange={(e) => {
                  setDistrictText(e.target.value);
                  setDistrictOpen(true);
                }}
                placeholder="Ketik nama kecamatan, misal KENCONG"
                className="h-10 w-full rounded-lg border border-border bg-white px-3 pr-10 outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button type="button" onClick={() => setDistrictOpen((open) => !open)} className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-md hover:bg-muted">
                <ChevronDown className="h-4 w-4" />
              </button>
              {districtOpen && (
                <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-white p-1 shadow-soft">
                  {filteredDistricts.length ? filteredDistricts.map((district) => (
                    <button
                      type="button"
                      key={district.id}
                      onClick={() => {
                        setDistrictText(district.name);
                        setDistrictOpen(false);
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="font-semibold">{district.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{district.regencyName}</span>
                    </button>
                  )) : (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Kecamatan tidak ditemukan</p>
                  )}
                </div>
              )}
            </div>
          </label>
        </div>
        <label className="mt-4 grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-5 text-center hover:bg-muted/50 sm:p-8">
          <UploadCloud className="mb-2 h-8 w-8 text-primary" />
          <span className="text-sm font-semibold">{file ? file.name : "Pilih file Excel Final Closing"}</span>
          <span className="text-xs text-muted-foreground">.xlsx / .xls</span>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <button onClick={submit} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-soft hover:bg-emerald-800">
            Validasi & Import Final Closing
          </button>
          <button onClick={() => setConfirmClear(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white shadow-soft hover:bg-rose-700">
            <Trash2 className="h-4 w-4" /> Kosongkan Data
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Log Import Final Closing</h2>
        <DataTable
          rows={logs as any[]}
          filename="log-import-final-closing"
          columns={[
            { key: "waktu", header: "Waktu" },
            { key: "jenis", header: "Jenis" },
            { key: "tahun", header: "Tahun" },
            { key: "tahap", header: "Tahap" },
            { key: "kecamatan", header: "Kecamatan" },
            { key: "file", header: "File" },
            { key: "jumlahData", header: "Jumlah Data" },
            { key: "diuploadOleh", header: "Upload Oleh" }
          ]}
        />
      </section>

      {modal.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-3 sm:grid sm:place-items-center sm:p-4">
          <section className="mx-auto w-full max-w-md rounded-2xl bg-white p-4 shadow-soft sm:p-5">
            <div className="flex items-start gap-3">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${modal.status === "processing" ? "bg-sky-50 text-sky-700" : modal.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {modal.status === "processing" && <Loader2 className="h-5 w-5 animate-spin" />}
                {modal.status === "success" && <CheckCircle2 className="h-5 w-5" />}
                {modal.status === "error" && <XCircle className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-lg font-bold">{modal.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{modal.message}</p>
              </div>
            </div>
            {modal.status !== "processing" && (
              <div className="mt-5 flex justify-end">
                <button onClick={() => setModal((state) => ({ ...state, open: false }))} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Tutup</button>
              </div>
            )}
          </section>
        </div>
      )}

      {confirmClear && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-3 sm:grid sm:place-items-center sm:p-4">
          <section className="mx-auto w-full max-w-md rounded-2xl bg-white p-4 shadow-soft sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Kosongkan Data Final Closing?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Semua data KPM Final Closing, batch import Final Closing, dan anggota kelompok yang terkait KPM akan dihapus. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:flex sm:justify-end">
              <button onClick={() => setConfirmClear(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Batal</button>
              <button onClick={clearFinalClosing} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Ya, Kosongkan</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
