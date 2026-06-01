import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureSuratArchivesTable } from "@/lib/data";
import { query } from "@/lib/db";

const maxFileSize = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getSession();
  if (!["ADMIN", "PENDAMPING"].includes(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  await ensureSuratArchivesTable();

  const form = await request.formData();
  const tanggalSurat = String(form.get("tanggalSurat") ?? "");
  const tanggalDiterima = String(form.get("tanggalDiterima") ?? "") || new Date().toISOString().slice(0, 10);
  const nomorSurat = String(form.get("nomorSurat") ?? "").trim();
  const pengirim = String(form.get("pengirim") ?? "").trim() || user.name;
  const perihal = String(form.get("perihal") ?? "").trim();
  const kategori = String(form.get("kategori") ?? "").trim() || "Surat Masuk";
  const catatan = String(form.get("catatan") ?? "").trim();
  const file = form.get("file");

  if (!tanggalSurat || !perihal) {
    return NextResponse.json({ message: "Tanggal surat dan perihal wajib diisi" }, { status: 400 });
  }

  let filePath: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > maxFileSize) return NextResponse.json({ message: "Lampiran maksimal 5 MB" }, { status: 400 });
    const saved = await saveSuratFile(file);
    filePath = saved.url;
    fileName = file.name;
    fileSize = saved.size;
  }

  await query(
    `INSERT INTO surat_archives
     (tanggal_surat, tanggal_diterima, nomor_surat, pengirim, perihal, kategori, catatan, file_path, file_name, file_size, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tanggalSurat, tanggalDiterima, nomorSurat || null, pengirim, perihal, kategori || null, catatan || null, filePath, fileName, fileSize, user.id]
  );
  await query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'CREATE', 'surat_archives', ?)", [user.id, `Tambah arsip surat: ${perihal}`]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getSession();
  if (!["ADMIN", "PENDAMPING"].includes(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  await ensureSuratArchivesTable();

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ message: "ID surat wajib diisi" }, { status: 400 });

  const rows = await query<{ id: number; created_by: number; perihal: string }>("SELECT id, created_by, perihal FROM surat_archives WHERE id = ? LIMIT 1", [id]);
  const row = rows[0];
  if (!row) return NextResponse.json({ message: "Surat tidak ditemukan" }, { status: 404 });
  if (user.role !== "ADMIN" && row.created_by !== user.id) return NextResponse.json({ message: "Anda hanya bisa menghapus surat yang Anda input" }, { status: 403 });

  await query("DELETE FROM surat_archives WHERE id = ?", [id]);
  await query("INSERT INTO activity_logs (user_id, action, entity, entity_id, description) VALUES (?, 'DELETE', 'surat_archives', ?, ?)", [user.id, String(id), `Hapus arsip surat: ${row.perihal}`]);
  return NextResponse.json({ ok: true });
}

async function saveSuratFile(file: File) {
  const now = new Date();
  const year = String(now.getFullYear());
  const dir = path.join(process.cwd(), "public", "uploads", "surat", year);
  await mkdir(dir, { recursive: true });
  const ext = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, "") || ".dat";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const fullPath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);
  return { url: `/uploads/surat/${year}/${filename}`, size: buffer.length };
}
