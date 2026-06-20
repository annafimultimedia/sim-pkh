"use client";

import { DragEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud, X, XCircle } from "lucide-react";
import { DataTable } from "./data-table";
import { DistrictOption, SessionUser, VillageOption } from "@/lib/types";

type ArtRow = {
  noKk: string;
  nik: string;
  nama: string;
  komponen: string;
  dtsenJenjang: string;
  dtsenSekolah: string;
  dtsenKip: string;
  dtsenMsg: string;
  dapodikJenjang: string;
  dapodikSekolah: string;
  dapodikKip: string;
  dapodikMsg: string;
  alamat: string;
  rt: string;
  rw: string;
  desa: string;
  kecamatan: string;
  kabupaten: string;
  pendamping: string;
  status: string;
  periode: string;
  statusFinalClosing: string;
};

export function ArtClient({ rows, user, districts, villages }: { rows: ArtRow[]; user: SessionUser; districts: DistrictOption[]; villages: VillageOption[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const districtNameMap = useMemo(() => buildNameMap(districts.map((item) => item.name)), [districts]);
  const villageNameMap = useMemo(() => buildNameMap(villages.map((item) => item.name)), [villages]);
  const normalizedRows = useMemo(() => rows.map((row) => ({
    ...row,
    desa: canonicalName(row.desa, villageNameMap),
    kecamatan: canonicalName(row.kecamatan, districtNameMap)
  })), [districtNameMap, rows, villageNameMap]);
  const userDistrict = canonicalName(user.district || "", districtNameMap);
  const [kabupaten, setKabupaten] = useState("SEMUA");
  const [kecamatan, setKecamatan] = useState(user.role === "PENDAMPING" ? userDistrict || "SEMUA" : "SEMUA");
  const [desa, setDesa] = useState("SEMUA");
  const [statusFc, setStatusFc] = useState("SEMUA");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; status: "processing" | "success" | "error"; title: string; message: string }>({ open: false, status: "processing", title: "", message: "" });

  const kabupatenOptions = useMemo(() => uniqueSorted(normalizedRows.map((row) => row.kabupaten)), [normalizedRows]);
  const kecamatanOptions = useMemo(() => {
    if (user.role === "PENDAMPING") return uniqueSorted([userDistrict, ...normalizedRows.map((row) => row.kecamatan)]);
    return uniqueSorted(normalizedRows.filter((row) => kabupaten === "SEMUA" || sameText(row.kabupaten, kabupaten)).map((row) => row.kecamatan));
  }, [kabupaten, normalizedRows, user.role, userDistrict]);
  const desaOptions = useMemo(() => {
    return uniqueSorted(normalizedRows.filter((row) => (kecamatan === "SEMUA" || sameText(row.kecamatan, kecamatan))).map((row) => row.desa));
  }, [kecamatan, normalizedRows]);
  const statusFcOptions = useMemo(() => uniqueSorted(normalizedRows.map((row) => row.statusFinalClosing)), [normalizedRows]);

  const filteredRows = useMemo(() => normalizedRows.filter((row) => {
    const inKabupaten = user.role === "PENDAMPING" || kabupaten === "SEMUA" || sameText(row.kabupaten, kabupaten);
    const inKecamatan = kecamatan === "SEMUA" || sameText(row.kecamatan, kecamatan);
    const inDesa = desa === "SEMUA" || sameText(row.desa, desa);
    const inStatusFc = statusFc === "SEMUA" || sameText(row.statusFinalClosing, statusFc);
    return inKabupaten && inKecamatan && inDesa && inStatusFc;
  }).sort(compareArtRows), [desa, kabupaten, kecamatan, normalizedRows, statusFc, user.role]);

  const matched = filteredRows.filter((row) => !!row.pendamping).length;
  const unmatched = filteredRows.length - matched;
  const totalKk = new Set(filteredRows.map((row) => row.noKk).filter(Boolean)).size;
  const unmatchedKk = new Set(filteredRows.filter((row) => !row.pendamping).map((row) => row.noKk).filter(Boolean)).size;
  const kkToneMap = useMemo(() => {
    const map = new Map<string, number>();
    let tone = 0;
    for (const row of filteredRows) {
      if (!map.has(row.noKk)) {
        map.set(row.noKk, tone);
        tone = tone === 0 ? 1 : 0;
      }
    }
    return map;
  }, [filteredRows]);

  function selectFile(nextFile?: File | null) {
    if (!nextFile) return;
    setFile(nextFile);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  }

  async function importArt() {
    if (!file) return;
    setConfirmImport(false);
    setModal({ open: true, status: "processing", title: "Import ART diproses", message: "File ART sedang divalidasi, dicocokkan dengan Final Closing, lalu disimpan." });
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/import/art", { method: "POST", body });
    const json = await readJson(res);
    if (!res.ok) {
      setModal({ open: true, status: "error", title: "Import ART gagal", message: json.message ?? "File ART gagal diimport." });
      return;
    }
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setModal({
      open: true,
      status: "success",
      title: "Import ART berhasil",
      message: `${json.total} ART diproses. ${json.matched} baris cocok dengan Final Closing dan ${json.unmatched} baris belum cocok.`
    });
    router.refresh();
  }

  const columns = [
    { key: "noKk", header: "NO KK" },
    { key: "nik", header: "NIK", maskNik: true },
    { key: "nama", header: "NAMA" },
    { key: "komponen", header: "KOMPONEN" },
    { key: "pendamping", header: "PENDAMPING", render: (row: ArtRow) => row.pendamping || <span className="font-semibold text-amber-700">Belum cocok</span> },
    { key: "statusFinalClosing", header: "STATUS FC" },
    { key: "dtsenJenjang", header: "DTSEN JENJANG" },
    { key: "dtsenSekolah", header: "DTSEN SEKOLAH" },
    { key: "dtsenKip", header: "DTSEN KIP" },
    { key: "dtsenMsg", header: "DTSEN MSG" },
    { key: "dapodikJenjang", header: "DAPODIK JENJANG" },
    { key: "dapodikSekolah", header: "DAPODIK SEKOLAH" },
    { key: "dapodikKip", header: "DAPODIK KIP" },
    { key: "dapodikMsg", header: "DAPODIK MSG" },
    { key: "alamat", header: "ALAMAT" },
    { key: "rt", header: "RT" },
    { key: "rw", header: "RW" },
    { key: "desa", header: "DESA" },
    { key: "kecamatan", header: "KECAMATAN" },
    { key: "kabupaten", header: "KABUPATEN" },
    { key: "status", header: "STATUS" },
    { key: "periode", header: "PERIODE" }
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold">Import Data ART</h2>
            <p className="text-sm text-muted-foreground">
              {user.role === "PENDAMPING"
                ? `File ART akan dibatasi untuk Kecamatan ${user.district || "tugas Anda"}.`
                : "Format mengikuti file komponen ART. No KK otomatis dicocokkan dengan Final Closing untuk mengambil nama pendamping."}
            </p>
          </div>
        </div>
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`grid cursor-pointer place-items-center rounded-xl border-2 border-dashed p-8 text-center transition ${dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:bg-muted/50"}`}
        >
          <UploadCloud className="mb-2 h-8 w-8 text-primary" />
          <span className="text-sm font-semibold">{file ? file.name : "Drag & drop file Excel ART atau klik untuk memilih"}</span>
          <span className="text-xs text-muted-foreground">.xlsx / .xls</span>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} />
        </label>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Data dicocokkan dengan Final Closing periode aktif. Data yang tidak cocok tetap disimpan dan diberi status belum cocok.</p>
          <button onClick={() => file ? setConfirmImport(true) : setModal({ open: true, status: "error", title: "File belum dipilih", message: "Pilih file Excel ART terlebih dahulu." })} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white">
            Validasi & Import ART
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-end gap-3">
          {user.role === "ADMIN" ? (
            <label className="text-sm font-semibold">
              Kabupaten
              <select value={kabupaten} onChange={(event) => { setKabupaten(event.target.value); setKecamatan("SEMUA"); setDesa("SEMUA"); }} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
                <option value="SEMUA">SEMUA KABUPATEN</option>
                {kabupatenOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          ) : null}
          <label className="text-sm font-semibold">
            Kecamatan
            <select value={kecamatan} disabled={user.role === "PENDAMPING"} onChange={(event) => { setKecamatan(event.target.value); setDesa("SEMUA"); }} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3 disabled:bg-slate-100 disabled:text-slate-600">
              {user.role === "ADMIN" ? <option value="SEMUA">SEMUA KECAMATAN</option> : null}
              {kecamatanOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Desa
            <select value={desa} onChange={(event) => setDesa(event.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
              <option value="SEMUA">SEMUA DESA</option>
              {desaOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Status FC
            <select value={statusFc} onChange={(event) => setStatusFc(event.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
              <option value="SEMUA">SEMUA STATUS</option>
              {statusFcOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <div className="text-sm text-muted-foreground">
            Tampil: <span className="font-bold text-slate-900">{filteredRows.length}</span> ART,
            <span className="ml-1 font-bold text-slate-900">{totalKk}</span> No KK,
            cocok FC: <span className="font-bold text-emerald-700">{matched}</span> ART,
            belum cocok: <span className="font-bold text-amber-700">{unmatched}</span> ART,
            belum cocok KK: <span className="font-bold text-amber-700">{unmatchedKk}</span>
          </div>
        </div>
      </section>

      <DataTable
        rows={filteredRows as any[]}
        columns={columns as any[]}
        filename="data-art"
        rowClassName={(row) => {
          const art = row as unknown as ArtRow;
          const tone = kkToneMap.get(art.noKk) ?? 0;
          return tone === 0 ? "bg-white" : "bg-emerald-50/45";
        }}
      />

      {confirmImport ? (
        <div className="fixed inset-0 z-[500] grid place-items-center bg-slate-950/40 p-4">
          <section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Yakin Import Data ART?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  File <span className="font-semibold text-slate-900">{file?.name}</span> akan disimpan ke database. Baris dengan No KK yang sama akan diperbarui, dan No KK yang tidak ada di Final Closing periode aktif akan ditandai belum cocok.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmImport(false)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold"><X className="h-4 w-4" /> Batal</button>
              <button onClick={importArt} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white">Ya, Import</button>
            </div>
          </section>
        </div>
      ) : null}

      {modal.open ? (
        <div className="fixed inset-0 z-[510] grid place-items-center bg-slate-950/40 p-4">
          <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft">
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
            {modal.status !== "processing" ? (
              <div className="mt-5 flex justify-end">
                <button onClick={() => setModal((state) => ({ ...state, open: false }))} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Tutup</button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function uniqueSorted(values: string[]) {
  const map = new Map<string, string>();
  for (const value of values) {
    const label = value?.trim();
    if (!label) continue;
    const key = placeKey(label);
    if (!map.has(key)) map.set(key, label);
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b));
}

function sameText(left: string, right: string) {
  return placeKey(left) === placeKey(right);
}

function compareArtRows(a: ArtRow, b: ArtRow) {
  return a.kecamatan.localeCompare(b.kecamatan) ||
    a.desa.localeCompare(b.desa) ||
    a.noKk.localeCompare(b.noKk) ||
    componentOrder(a.komponen) - componentOrder(b.komponen) ||
    a.nama.localeCompare(b.nama);
}

function componentOrder(value: string) {
  return sameText(value, "PENGURUS") ? 0 : 1;
}

function buildNameMap(values: string[]) {
  const map = new Map<string, string>();
  for (const value of values) {
    const label = value?.trim();
    if (label) map.set(placeKey(label), label);
  }
  return map;
}

function canonicalName(value: string, nameMap: Map<string, string>) {
  const label = value?.trim();
  if (!label) return "";
  return nameMap.get(placeKey(label)) ?? label;
}

function placeKey(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\b(KEC|KECAMATAN|DESA|DS|KEL|KELURAHAN)\b\.?/g, "")
    .replace(/[.,/\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
