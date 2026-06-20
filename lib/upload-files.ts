import { unlink } from "fs/promises";
import path from "path";

export async function deletePublicUpload(filePath: string | null | undefined, allowedPrefix: string) {
  if (!filePath) return false;

  const normalized = filePath.replace(/^\/+/, "").replace(/\\/g, "/");
  const prefix = allowedPrefix.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!normalized.startsWith(prefix) || normalized.includes("..")) return false;

  const publicRoot = path.resolve(process.cwd(), "public");
  const fullPath = path.resolve(publicRoot, normalized);
  if (!fullPath.startsWith(publicRoot)) return false;

  try {
    await unlink(fullPath);
    return true;
  } catch (error: any) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
