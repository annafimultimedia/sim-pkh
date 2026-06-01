"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { DataTable } from "./data-table";
import { SessionUser } from "@/lib/types";

type SuratRow = {
  id: number;
  tanggalSurat: string;
  tanggalDiterima: string;
  nomorSurat: string;
  pengirim: string;
  perihal: string;
  kategori: string;
  catatan: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  dibuatOleh: string;
  createdBy: number;
  dibuatPada: string;
};

const inputClass = "h-10 w-full rounded-lg border border-border px-3 text-sm";

export function SuratClient({ rows, user }: { rows: SuratRow[]; user: SessionUser }) {
  const router = useRouter();
  const [localRows, setLocalRows] = useState(rows);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<SuratRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuratRow | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [form, setForm] = useState({
    tanggalSurat: today(),
    perihal: "",
    catatan: ""
  });
  const [file, setFile] = useState<File | null>(null);

  const totalLampiran = useMemo(() => localRows.filter((row) => row.filePath).length, [localRows]);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  async function save() {
    setLoading(true);
    setMessage("");
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    if (file) body.append("file", file);
    const res = await fetch("/api/surat", { method: "POST", body });
    const json = await readJson(res);
    setLoading(false);
    if (!res.ok) {
      setMessage(json.message ?? "Gagal menyimpan surat");
      return;
    }
    setModal(false);
    setForm({ tanggalSurat: today(), perihal: "", catatan: "" });
    setFile(null);
    router.refresh();
  }

  async function remove(row: SuratRow) {
    setLoading(true);
    setMessage("");
    const res = await fetch(`/api/surat?id=${row.id}`, { method: "DELETE" });
    const json = await readJson(res);
    setLoading(false);
    if (!res.ok) {
      setMessage(json.message ?? "Gagal menghapus surat");
      return;
    }
    setDeleteTarget(null);
    setLocalRows((current) => current.filter((item) => item.id !== row.id));
    router.refresh();
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDraggingFile(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) setFile(droppedFile);
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center rounded-2xl border border-border bg-white p-4 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Total Surat" value={localRows.length.toLocaleString("id-ID")} />
          <Info label="Dengan Lampiran" value={totalLampiran.toLocaleString("id-ID")} />
        </div>
        <button onClick={() => setModal(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" /> Tambah Surat
        </button>
      </section>

      {message ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{message}</p> : null}

      <DataTable
        rows={localRows as any[]}
        filename="arsip-surat"
        searchPlaceholder="Search NAMA SURAT"
        columns={[
          { key: "tanggalDiterima", header: "Tgl Diterima" },
          { key: "tanggalSurat", header: "Tgl Surat" },
          { key: "perihal", header: "Perihal" },
          { key: "dibuatOleh", header: "Input Oleh" },
          { key: "filePath", header: "Lampiran", render: (row: SuratRow) => row.filePath
            ? <button onClick={() => setPreview(row)} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"><FileText className="h-3.5 w-3.5" /> Lihat</button>
            : <span className="text-xs text-muted-foreground">-</span> },
          { key: "aksi", header: "Aksi", render: (row: SuratRow) => user.role === "ADMIN" || row.createdBy === user.id
            ? <button onClick={() => setDeleteTarget(row)} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700"><Trash2 className="h-3.5 w-3.5" /> Hapus</button>
            : <span className="text-xs text-muted-foreground">-</span> }
        ] as any[]}
      />

      {modal ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-3 sm:grid sm:place-items-center sm:p-4" onPointerDown={() => setModal(false)}>
          <section className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-4 shadow-soft sm:p-5" onPointerDown={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Tambah Arsip Surat</h2>
                <p className="text-sm text-muted-foreground">Isi data surat masuk dan lampiran bila ada.</p>
              </div>
              <button onClick={() => setModal(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3">
              <Field label="Tanggal Surat"><input type="date" value={form.tanggalSurat} onChange={(e) => setForm((state) => ({ ...state, tanggalSurat: e.target.value }))} className={inputClass} /></Field>
              <Field label="Perihal"><input value={form.perihal} onChange={(e) => setForm((state) => ({ ...state, perihal: e.target.value }))} className={inputClass} /></Field>
              <label className="text-sm font-semibold">
                Catatan
                <textarea value={form.catatan} onChange={(e) => setForm((state) => ({ ...state, catatan: e.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </label>
              <label
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed p-4 text-sm transition ${isDraggingFile ? "border-primary bg-primary/5" : "border-border bg-slate-50"}`}
              >
                <span className="inline-flex items-center gap-2 font-bold"><UploadCloud className="h-4 w-4" /> Upload Lampiran Surat</span>
                <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-3 block w-full text-sm" />
                <p className="mt-2 text-xs text-muted-foreground">{file ? `${file.name} (${formatSize(file.size)})` : "Klik pilih file atau tarik file ke area ini. Maksimal 5 MB."}</p>
              </label>
            </div>
            {message ? <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{message}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={loading} onClick={() => setModal(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60">Batal</button>
              <button disabled={loading || !form.tanggalSurat || !form.perihal} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-3 sm:grid sm:place-items-center sm:p-4" onPointerDown={() => setDeleteTarget(null)}>
          <section className="mx-auto w-full max-w-md rounded-2xl bg-white p-4 shadow-soft sm:p-5" onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Hapus Arsip Surat?</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Arsip surat <span className="font-bold text-slate-900">{deleteTarget.perihal}</span> akan dihapus dari daftar.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:flex sm:justify-end">
              <button disabled={loading} onClick={() => setDeleteTarget(null)} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-slate-700 disabled:opacity-60">Batal</button>
              <button disabled={loading} onClick={() => remove(deleteTarget)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Ya, Hapus
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {preview ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 sm:grid sm:place-items-center sm:p-4" onPointerDown={() => setPreview(null)}>
          <section className="mx-auto flex h-[88vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-soft" onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{preview.perihal}</h2>
                <p className="truncate text-sm text-muted-foreground">{preview.fileName || "Lampiran surat"}</p>
              </div>
              <button onClick={() => setPreview(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 bg-slate-100 p-3">
              <iframe src={preview.filePath} title={`Lampiran ${preview.perihal}`} className="h-full w-full rounded-xl border border-border bg-white" />
            </div>
            <div className="flex justify-end gap-2 border-t border-border p-3">
              <a href={preview.filePath} download={preview.fileName || true} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Unduh</a>
              <button onClick={() => setPreview(null)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Tutup</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm font-semibold">{label}<div className="mt-1">{children}</div></label>;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatSize(size: number) {
  return `${Math.round(size / 1024)} KB`;
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
