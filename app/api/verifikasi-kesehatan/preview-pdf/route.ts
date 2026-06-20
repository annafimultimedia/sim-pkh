import { mkdir, readFile, readdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessMenu } from "@/lib/menu-access";

const previewDir = path.join(process.cwd(), "storage", "health-card-previews");
const maxPdfSize = 25 * 1024 * 1024;
const maxAgeMs = 60 * 60 * 1000;

export async function POST(request: Request) {
  const user = await getSession();
  if (!(await canAccessMenu(user, "verifikasi-kesehatan"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  const filename = sanitizeFilename(String(form.get("filename") ?? "LEMBAR KONTROL KESEHATAN.pdf"));
  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ message: "Preview harus berupa PDF" }, { status: 400 });
  }
  if (file.size > maxPdfSize) {
    return NextResponse.json({ message: "Ukuran preview PDF terlalu besar" }, { status: 400 });
  }

  await mkdir(previewDir, { recursive: true });
  await cleanupExpiredPreviews();
  const id = randomUUID();
  await Promise.all([
    writeFile(path.join(previewDir, `${id}.pdf`), Buffer.from(await file.arrayBuffer())),
    writeFile(path.join(previewDir, `${id}.json`), JSON.stringify({ filename }), "utf8")
  ]);

  return NextResponse.json({ url: `/api/verifikasi-kesehatan/preview-pdf?id=${id}` });
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!(await canAccessMenu(user, "verifikasi-kesehatan"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const id = String(new URL(request.url).searchParams.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ message: "Preview tidak valid" }, { status: 400 });
  }

  try {
    const [pdf, metadata] = await Promise.all([
      readFile(path.join(previewDir, `${id}.pdf`)),
      readFile(path.join(previewDir, `${id}.json`), "utf8")
    ]);
    const filename = sanitizeFilename(JSON.parse(metadata).filename);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${asciiFilename(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch {
    return NextResponse.json({ message: "Preview tidak ditemukan atau sudah kedaluwarsa" }, { status: 404 });
  }
}

async function cleanupExpiredPreviews() {
  const files = await readdir(previewDir).catch(() => []);
  const now = Date.now();
  await Promise.all(files.map(async (name) => {
    const fullPath = path.join(previewDir, name);
    const info = await stat(fullPath).catch(() => null);
    if (info && now - info.mtimeMs > maxAgeMs) await unlink(fullPath).catch(() => {});
  }));
}

function sanitizeFilename(value: string) {
  const clean = value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
}

function asciiFilename(value: string) {
  return value.replace(/[^\x20-\x7E]/g, "").replace(/"/g, "'");
}
