import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf"
};

export async function GET(request: Request) {
  await getSession();
  const url = new URL(request.url);
  const rawPath = String(url.searchParams.get("path") ?? "");
  if (!rawPath) return NextResponse.json({ message: "Path file wajib diisi" }, { status: 400 });

  const normalized = rawPath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!normalized.startsWith("uploads/p2k2/") || normalized.includes("..")) {
    return NextResponse.json({ message: "Path file tidak valid" }, { status: 400 });
  }

  const root = path.join(process.cwd(), "public");
  const fullPath = path.resolve(root, normalized);
  if (!fullPath.startsWith(path.resolve(root))) {
    return NextResponse.json({ message: "Path file tidak valid" }, { status: 400 });
  }

  try {
    const file = await readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    return new Response(file, {
      headers: {
        "Content-Type": contentTypes[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=60"
      }
    });
  } catch {
    return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });
  }
}
