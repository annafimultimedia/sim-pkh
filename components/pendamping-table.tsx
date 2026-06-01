"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Edit3, KeyRound, Loader2, Trash2, Upload, X, XCircle } from "lucide-react";
import { DataTable } from "./data-table";
import { DistrictOption, Pendamping } from "@/lib/types";

type RegencyOption = { id: string; name: string };

export function PendampingTable({
  rows,
  districts,
  regencies,
  defaultRegencyId = "3509"
}: {
  rows: Pendamping[];
  districts: DistrictOption[];
  regencies: RegencyOption[];
  defaultRegencyId?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [localRows, setLocalRows] = useState(rows);
  const [selected, setSelected] = useState<number[]>([]);
  const [kabupaten, setKabupaten] = useState(defaultRegencyId);
  const [kecamatan, setKecamatan] = useState("SEMUA");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadModal, setUploadModal] = useState<{ open: boolean; status: "idle" | "processing" | "success" | "error"; title: string; message: string; details?: string[] }>({
    open: false,
    status: "idle",
    title: "",
    message: ""
  });
  const [editing, setEditing] = useState<Pendamping | null>(null);
  const [confirmMove, setConfirmMove] = useState(false);
  const [resetTarget, setResetTarget] = useState<Pendamping | null>(null);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);
  const [form, setForm] = useState({ nik: "", nip: "", nama: "", districtId: "" });
  const regencyLabel = (name: string) => name.replace(/^KABUPATEN\s+/i, "KAB. ");

  const districtOptions = useMemo(() => districts.filter((district) => kabupaten === "SEMUA" || district.regencyId === kabupaten), [kabupaten, districts]);
  const selectedMoveDistrict = useMemo(() => districts.find((district) => district.id === form.districtId), [districts, form.districtId]);
  const filteredRows = useMemo(() => {
    return localRows.filter((row) => (kabupaten === "SEMUA" || row.regencyId === kabupaten) && (kecamatan === "SEMUA" || row.districtId === kecamatan));
  }, [kabupaten, kecamatan, localRows]);
  const filteredIds = filteredRows.map((row) => row.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.includes(id));

  async function importFile(file?: File) {
    if (!file) return;
    setLoading(true);
    setMessage("");
    setUploadModal({
      open: true,
      status: "processing",
      title: "Import sedang diproses",
      message: "File XLSX sedang dibaca dan divalidasi dengan master wilayah. Mohon tunggu sebentar."
    });
    const body = new FormData();
    body.append("file", file);
    body.append("regencyId", kabupaten === "SEMUA" ? defaultRegencyId : kabupaten);
    const res = await fetch("/api/pendamping/import", { method: "POST", body });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(json.message ?? "Import gagal");
      setUploadModal({
        open: true,
        status: "error",
        title: "Import gagal",
        message: json.message ?? "File tidak berhasil diimport.",
        details: json.errors ?? []
      });
      return;
    }
    const summary = `Import selesai: ${json.imported} baru, ${json.updated} update, ${json.skipped} dilewati.`;
    setMessage(`${summary}${json.errors?.length ? " " + json.errors.slice(0, 3).join(" | ") : ""}`);
    setUploadModal({
      open: true,
      status: "success",
      title: "Import selesai",
      message: summary,
      details: json.errors ?? []
    });
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  function openEdit(row: Pendamping) {
    setEditing(row);
    setForm({ nik: row.nik, nip: row.nip, nama: row.nama, districtId: row.districtId ?? "" });
    setMessage("");
  }

  async function saveEdit(confirmedMove = false) {
    if (!editing) return;
    if (!confirmedMove && editing.districtId && form.districtId && editing.districtId !== form.districtId) {
      setConfirmMove(true);
      return;
    }
    setLoading(true);
    setMessage("");
    const res = await fetch(`/api/pendamping/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, confirmMove: confirmedMove })
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setErrorModal({ title: "Update Pendamping Gagal", message: json.message ?? "Update gagal" });
      return;
    }
    setConfirmMove(false);
    const district = districts.find((item) => item.id === form.districtId);
    setLocalRows((current) => current.map((row) => row.id === editing.id ? {
      ...row,
      nik: form.nik,
      nip: form.nip,
      nama: form.nama,
      districtId: district?.id ?? form.districtId,
      regencyId: district?.regencyId ?? row.regencyId,
      kecamatan: district?.name ?? row.kecamatan,
      kabupaten: district?.regencyName ?? row.kabupaten,
      kpmCount: confirmedMove && editing.districtId !== form.districtId ? 0 : row.kpmCount
    } : row));
    setEditing(null);
    setMessage("Data pendamping berhasil diperbarui.");
    router.refresh();
  }

  async function remove(row: Pendamping) {
    const ok = window.confirm(`Nonaktifkan pendamping ${row.nama}? User tidak bisa login sampai diaktifkan kembali.`);
    if (!ok) return;
    await setActiveStatus([row.id], false);
  }

  async function setActiveStatus(ids: number[], isActive: boolean) {
    if (!ids.length) {
      setMessage("Pilih minimal satu pendamping.");
      return;
    }
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/pendamping/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, isActive })
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(json.message ?? "Update status gagal");
      return;
    }
    setLocalRows((current) => current.map((item) => ids.includes(item.id) ? { ...item, isActive } : item));
    setSelected((current) => current.filter((id) => !ids.includes(id)));
    setMessage(`${json.updated ?? ids.length} pendamping berhasil ${isActive ? "diaktifkan" : "dinonaktifkan"}.`);
    router.refresh();
  }

  async function resetPassword() {
    if (!resetTarget) return;
    setLoading(true);
    setMessage("");
    const res = await fetch(`/api/pendamping/${resetTarget.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset-password" })
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(json.message ?? "Reset password gagal");
      return;
    }
    setMessage(`Password ${resetTarget.nama} berhasil direset ke ${json.defaultPassword ?? "pkh123"}.`);
    setResetTarget(null);
    router.refresh();
  }

  function toggleSelected(id: number, checked: boolean) {
    setSelected((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  }

  function toggleSelectAll(checked: boolean) {
    setSelected((current) => checked ? [...new Set([...current, ...filteredIds])] : current.filter((id) => !filteredIds.includes(id)));
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <label className="text-sm font-semibold">
              Kabupaten
              <select value={kabupaten} onChange={(e) => { setKabupaten(e.target.value); setKecamatan("SEMUA"); }} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3 text-sm">
                <option value="SEMUA">SEMUA KABUPATEN</option>
                {regencies.map((item) => <option key={item.id} value={item.id}>{regencyLabel(item.name)}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Nama Kecamatan
              <select value={kecamatan} onChange={(e) => setKecamatan(e.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3 text-sm">
                <option value="SEMUA">SEMUA KECAMATAN</option>
                {districtOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setActiveStatus(selected, true)} disabled={loading || selected.length === 0} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
              Aktifkan ({selected.length})
            </button>
            <button onClick={() => setActiveStatus(selected, false)} disabled={loading || selected.length === 0} className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
              Nonaktifkan ({selected.length})
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">
              <Upload className="h-4 w-4" /> Import Pendamping
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Default kabupaten: KAB. JEMBER (ID 3509). Template XLSX: NIK, NIP, Nama, Kecamatan. Search box tetap tersedia di tabel.</p>
        {message && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{message}</p>}
      </section>

      <DataTable
        rows={filteredRows as any[]}
        filename="data-pendamping"
        columns={[
          {
            key: "select",
            header: <input aria-label="Pilih semua pendamping" type="checkbox" checked={allFilteredSelected} onChange={(e) => toggleSelectAll(e.target.checked)} />,
            render: (row: Pendamping) => <input aria-label={`Pilih ${row.nama}`} type="checkbox" checked={selected.includes(row.id)} onChange={(e) => toggleSelected(row.id, e.target.checked)} />
          },
          { key: "nik", header: "NIK" },
          { key: "nip", header: "NIP" },
          { key: "nama", header: "Nama" },
          { key: "kecamatan", header: "Kecamatan Tugas" },
          { key: "kabupaten", header: "Kabupaten" },
          {
            key: "isActive",
            header: "Status User",
            render: (row: Pendamping) => row.isActive
              ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Aktif</span>
              : <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">Nonaktif</span>
          },
          { key: "kpmCount", header: "KPM" },
          {
            key: "aksi",
            header: "Aksi",
            render: (row: Pendamping) => (
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(row)} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={() => setResetTarget(row)} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <KeyRound className="h-3.5 w-3.5" /> Reset
                </button>
                {row.isActive ? (
                  <button onClick={() => remove(row)} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
                    <Trash2 className="h-3.5 w-3.5" /> Nonaktif
                  </button>
                ) : (
                  <button onClick={() => setActiveStatus([row.id], true)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    Aktifkan
                  </button>
                )}
              </div>
            )
          }
        ] as any[]}
      />

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <section className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Edit Pendamping</h2>
                <p className="text-sm text-muted-foreground">Pindah kecamatan akan ditolak bila pendamping masih memiliki KPM.</p>
              </div>
              <button onClick={() => { setConfirmMove(false); setEditing(null); }} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">NIK<input value={form.nik} onChange={(e) => setForm((f) => ({ ...f, nik: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border px-3" /></label>
              <label className="text-sm font-semibold">NIP<input value={form.nip} onChange={(e) => setForm((f) => ({ ...f, nip: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border px-3" /></label>
              <label className="text-sm font-semibold sm:col-span-2">Nama<input value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border px-3" /></label>
              <label className="text-sm font-semibold sm:col-span-2">
                Kecamatan Tugas
                <select value={form.districtId} onChange={(e) => setForm((f) => ({ ...f, districtId: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
                  <option value="">Pilih kecamatan</option>
                  {districts.filter((district) => kabupaten === "SEMUA" || district.regencyId === kabupaten).map((district) => (
                    <option key={district.id} value={district.id}>{district.name} - {district.regencyName}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setConfirmMove(false); setEditing(null); }} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Batal</button>
              <button onClick={() => saveEdit(false)} disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Simpan</button>
            </div>
          </section>
        </div>
      )}

      {confirmMove && editing ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/40 p-4">
          <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft">
            <h2 className="text-lg font-bold">Konfirmasi Pindah Tugas</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Anda yakin memindahkan <span className="font-semibold text-slate-900">{editing.nama}</span> ke Kecamatan <span className="font-semibold text-slate-900">{selectedMoveDistrict?.name ?? "-"}</span>?
            </p>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Jika pendamping masih memiliki KPM pada periode aktif, mapping KPM tersebut akan otomatis dilepas sehingga KPM menjadi belum punya pendamping.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={loading} onClick={() => setConfirmMove(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60">Batal</button>
              <button disabled={loading} onClick={() => saveEdit(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Menyimpan..." : "Ya, Pindahkan"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {errorModal ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
          <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{errorModal.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{errorModal.message}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setErrorModal(null)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Tutup</button>
            </div>
          </section>
        </div>
      ) : null}

      {resetTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Reset Password?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reset password <span className="font-semibold text-slate-900">{resetTarget.nama}</span> ke password default <span className="font-semibold text-slate-900">pkh123</span>?
                </p>
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Sesi login pendamping ini akan diputus dan user perlu login ulang.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={loading} onClick={() => setResetTarget(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60">Batal</button>
              <button disabled={loading} onClick={resetPassword} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Memproses..." : "Ya, Reset"}</button>
            </div>
          </section>
        </div>
      )}

      {uploadModal.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                uploadModal.status === "processing" ? "bg-sky-50 text-sky-700" : uploadModal.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}>
                {uploadModal.status === "processing" && <Loader2 className="h-5 w-5 animate-spin" />}
                {uploadModal.status === "success" && <CheckCircle2 className="h-5 w-5" />}
                {uploadModal.status === "error" && <XCircle className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold">{uploadModal.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{uploadModal.message}</p>
                {!!uploadModal.details?.length && (
                  <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                    {uploadModal.details.slice(0, 10).map((detail, index) => <p key={index}>{detail}</p>)}
                    {uploadModal.details.length > 10 && <p>...dan {uploadModal.details.length - 10} catatan lain.</p>}
                  </div>
                )}
              </div>
            </div>
            {uploadModal.status !== "processing" && (
              <div className="mt-5 flex justify-end">
                <button onClick={() => setUploadModal((modal) => ({ ...modal, open: false }))} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Tutup</button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
