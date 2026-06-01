import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { ensureProfilePhotoColumn, getSession, setSession } from "@/lib/auth";
import { query } from "@/lib/db";

const maxProfilePhotoSize = 1024 * 1024;

export async function PUT(request: Request) {
  try {
    const user = await getSession();
    await ensureProfilePhotoColumn();

    const contentType = request.headers.get("content-type") ?? "";
    const form = contentType.includes("multipart/form-data") ? await request.formData() : null;
    const body = form ? null : await request.json();
    const name = String((form ? form.get("name") : body.name) ?? user.name).trim();
    const password = (form ? form.get("password") : body.password) ? String((form ? form.get("password") : body.password) ?? "") : "";
    const photo = form?.get("photo");

    if (!name) return NextResponse.json({ message: "Nama wajib diisi" }, { status: 400 });
    if (password && password.length < 6) return NextResponse.json({ message: "Password minimal 6 karakter" }, { status: 400 });

    const updates = ["name = ?"];
    const params: (string | number | boolean | Date | null)[] = [name];
    if (password) {
      updates.push("password_hash = ?");
      params.push(await bcrypt.hash(password, 10));
    }
    let photoPath = user.photoPath ?? null;
    if (photo instanceof File && photo.size > 0) {
      if (!photo.type.startsWith("image/")) return NextResponse.json({ message: "Foto profil harus berupa gambar" }, { status: 400 });
      if (photo.size > maxProfilePhotoSize) return NextResponse.json({ message: "Foto profil maksimal 1 MB" }, { status: 400 });
      const saved = await saveProfilePhoto(photo, user.id);
      photoPath = saved.url;
      updates.push("profile_photo_path = ?");
      params.push(photoPath);
    }
    params.push(user.id);

    await query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
    if (user.role === "PENDAMPING") {
      await query("UPDATE pendamping_profiles SET name = ? WHERE user_id = ?", [name, user.id]);
    }
    await query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'UPDATE', 'users', ?)", [user.id, password ? "Update profil dan password akun" : "Update profil akun"]);

    await setSession({ ...user, name, photoPath: photoPath ?? undefined });
    return NextResponse.json({ ok: true, photoPath });
  } catch (error) {
    console.error("Gagal update profil pengaturan", error);
    return NextResponse.json({ message: "Gagal menyimpan perubahan profil. Periksa koneksi database atau data akun." }, { status: 500 });
  }
}

async function saveProfilePhoto(file: File, userId: number) {
  const dir = path.join(process.cwd(), "public", "uploads", "profiles");
  await mkdir(dir, { recursive: true });
  const filename = `user-${userId}.jpg`;
  const fullPath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);
  return {
    url: `/uploads/profiles/${filename}`,
    size: buffer.length
  };
}
