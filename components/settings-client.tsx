"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActivePeriod, SessionUser } from "@/lib/types";
import { PrimaryButton } from "./app-shell";

export function SettingsClient({ activePeriod, appName, user }: { activePeriod: ActivePeriod; appName: string; user: SessionUser }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const photoSectionRef = useRef<HTMLDivElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(user.name);
  const [systemName, setSystemName] = useState(appName);
  const [year, setYear] = useState(String(activePeriod.year));
  const [stage, setStage] = useState(String(activePeriod.stage));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(user.photoPath ?? "");
  const [photoSource, setPhotoSource] = useState("");
  const [cropZoom, setCropZoom] = useState(1.08);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasProfileChange = name.trim() !== user.name.trim() || password.length > 0 || confirmPassword.length > 0 || !!photo || !!photoSource;
  const hasSystemChange = systemName.trim() !== appName.trim();
  const hasPeriodChange = year !== String(activePeriod.year) || stage !== String(activePeriod.stage);
  const hasChanges = user.role === "PENDAMPING" ? hasProfileChange : hasProfileChange || hasPeriodChange || hasSystemChange;

  const confirmText = useMemo(() => {
    const changes = [];
    if (name.trim() !== user.name.trim()) changes.push("nama");
    if (password) changes.push("password");
    if (user.role === "ADMIN" && hasSystemChange) changes.push("nama aplikasi");
    if (user.role === "ADMIN" && hasPeriodChange) changes.push("periode aktif");
    return changes.length ? changes.join(", ") : "data";
  }, [hasPeriodChange, hasSystemChange, name, password, user.name, user.role]);

  useEffect(() => {
    const focus = searchParams.get("focus");
    if (focus === "photo") {
      photoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (focus === "password") {
      passwordInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      passwordInputRef.current?.focus();
    }
  }, [searchParams]);

  function requestSave() {
    setMessage("");
    setError("");
    if (!hasChanges) {
      setError("Belum ada perubahan yang perlu disimpan.");
      return;
    }
    if (!name.trim()) {
      setError(user.role === "PENDAMPING" ? "Nama pendamping wajib diisi." : "Nama admin wajib diisi.");
      return;
    }
    if (user.role === "ADMIN" && !systemName.trim()) {
      setError("Nama aplikasi wajib diisi.");
      return;
    }
    if (password || confirmPassword) {
      if (password.length < 6) {
        setError("Password baru minimal 6 karakter.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Konfirmasi password tidak sama.");
        return;
      }
    }
    setConfirmOpen(true);
  }

  async function choosePhoto(file?: File | null) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Foto profil harus berupa gambar.");
      return;
    }
    try {
      const sourceUrl = URL.createObjectURL(file);
      setPhotoSource(sourceUrl);
      setPhotoPreview(sourceUrl);
      setPhoto(null);
      setCropZoom(1.08);
      setCropX(50);
      setCropY(50);
    } catch {
      setError("Foto profil gagal diproses.");
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (user.role === "ADMIN" && (hasPeriodChange || hasSystemChange)) {
        const periodRes = await fetch("/api/settings/active-period", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year, stage, appName: systemName.trim() })
        });
        const periodJson = await readJson(periodRes);
        if (!periodRes.ok) throw new Error(periodJson.message ?? "Gagal menyimpan periode aktif");
      }

      if (hasProfileChange) {
        const body = new FormData();
        body.append("name", name.trim());
        if (password) body.append("password", password);
        let croppedPhoto = photo;
        if (photoSource) {
          croppedPhoto = await cropProfilePhoto(photoSource, cropZoom, cropX, cropY);
        }
        if (croppedPhoto) body.append("photo", croppedPhoto);
        const profileRes = await fetch("/api/settings/profile", {
          method: "PUT",
          body
        });
        const profileJson = await readJson(profileRes);
        if (!profileRes.ok) throw new Error(profileJson.message ?? "Gagal menyimpan data akun");
        if (profileJson.photoPath) {
          const finalPhoto = `${profileJson.photoPath}?v=${Date.now()}`;
          setPhotoPreview(finalPhoto);
          window.dispatchEvent(new CustomEvent("sim_pkh_profile_photo_updated", { detail: { photoPath: profileJson.photoPath } }));
        }
      }

      setPassword("");
      setConfirmPassword("");
      setPhoto(null);
      setPhotoSource("");
      setConfirmOpen(false);
      setMessage("Perubahan berhasil disimpan.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="max-w-3xl rounded-2xl border border-border bg-white p-4 shadow-soft sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div ref={photoSectionRef} className="sm:col-span-2 flex flex-col gap-3 rounded-xl border border-border bg-slate-50 p-4 sm:flex-row sm:items-center">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-xl font-bold text-primary ring-2 ring-white">
              {photoPreview ? <img src={photoPreview} alt="Foto profil" className="h-full w-full object-cover" style={photoSource ? { objectPosition: `${cropX}% ${cropY}%`, transform: `scale(${cropZoom})` } : undefined} /> : user.name.slice(0, 1).toUpperCase()}
            </div>
            <label className="text-sm font-medium">
              Foto Profil {user.role === "PENDAMPING" ? "Pendamping" : "Admin"}
              <input type="file" accept="image/*" onChange={(event) => choosePhoto(event.target.files?.[0])} className="mt-2 block w-full text-sm" />
              <span className="mt-1 block text-xs text-muted-foreground">Foto dikompres otomatis, maksimal 1 MB.</span>
            </label>
          </div>
          {photoSource ? (
            <div className="sm:col-span-2 rounded-xl border border-border bg-white p-4">
              <div className="grid gap-4 md:grid-cols-[180px_1fr] md:items-center">
                <div className="mx-auto h-40 w-40 overflow-hidden rounded-full bg-slate-100 ring-4 ring-white shadow-soft">
                  <img src={photoSource} alt="Crop foto profil" className="h-full w-full object-cover" style={{ objectPosition: `${cropX}% ${cropY}%`, transform: `scale(${cropZoom})` }} />
                </div>
                <div className="grid gap-3">
                  <label className="text-sm font-semibold">
                    Zoom
                    <input type="range" min="1" max="2" step="0.01" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} className="mt-1 w-full" />
                  </label>
                  <label className="text-sm font-semibold">
                    Geser Horizontal
                    <input type="range" min="0" max="100" value={cropX} onChange={(event) => setCropX(Number(event.target.value))} className="mt-1 w-full" />
                  </label>
                  <label className="text-sm font-semibold">
                    Geser Vertikal
                    <input type="range" min="0" max="100" value={cropY} onChange={(event) => setCropY(Number(event.target.value))} className="mt-1 w-full" />
                  </label>
                  <p className="text-xs text-muted-foreground">Atur sampai wajah pas di lingkaran. Hasil simpan akan mengikuti preview ini.</p>
                </div>
              </div>
            </div>
          ) : null}
          {user.role === "PENDAMPING" ? (
            <>
              <label className="text-sm font-medium sm:col-span-2">
                Nama Pendamping
                <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border px-3" />
              </label>
            </>
          ) : (
            <>
              <label className="text-sm font-medium sm:col-span-2">
                Nama Admin
                <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border px-3" />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Nama Aplikasi
                <input value={systemName} onChange={(event) => setSystemName(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border px-3" />
                <span className="mt-1 block text-xs text-muted-foreground">Nama ini tampil di sidebar dan nama aplikasi saat dipasang di mobile.</span>
              </label>
              <label className="text-sm font-medium">
                Tahun Aktif
                <input value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border px-3" />
              </label>
              <label className="text-sm font-medium">
                Tahap Aktif
                <select value={stage} onChange={(event) => setStage(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
                  {[1, 2, 3, 4].map((item) => <option key={item} value={item}>Tahap {item}</option>)}
                </select>
              </label>
            </>
          )}
          <label className="text-sm font-medium">
            Password Baru
            <input ref={passwordInputRef} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border px-3" />
          </label>
          <label className="text-sm font-medium">
            Konfirmasi Password
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border px-3" />
          </label>
        </div>
        {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
        {message && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p>}
        <PrimaryButton onClick={requestSave} className="mt-5 w-full sm:w-auto" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Perubahan"}</PrimaryButton>
      </section>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[500] overflow-y-auto bg-slate-950/40 p-3 sm:grid sm:place-items-center sm:p-4" onPointerDown={() => setConfirmOpen(false)}>
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl sm:p-5" onPointerDown={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Konfirmasi Perubahan</h2>
            <p className="mt-3 text-sm text-slate-600">Apakah Anda yakin melakukan perubahan pada {confirmText}?</p>
            <div className="mt-5 grid gap-2 sm:flex sm:justify-end">
              <button disabled={saving} onClick={() => setConfirmOpen(false)} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-slate-700 disabled:opacity-60">Batal</button>
              <button disabled={saving} onClick={save} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Menyimpan..." : "Ya, simpan"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

async function cropProfilePhoto(sourceUrl: string, zoom: number, positionX: number, positionY: number) {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  const size = 720;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas tidak tersedia");

  const coverScale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * zoom;
  const drawWidth = image.naturalWidth * coverScale;
  const drawHeight = image.naturalHeight * coverScale;
  const maxOffsetX = Math.max(drawWidth - size, 0);
  const maxOffsetY = Math.max(drawHeight - size, 0);
  const dx = -maxOffsetX * (positionX / 100);
  const dy = -maxOffsetY * (positionY / 100);

  context.drawImage(image, dx, dy, drawWidth, drawHeight);

  let quality = 0.82;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > 1024 * 1024 && quality > 0.45) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }
  return new File([blob], "profile.jpg", { type: "image/jpeg" });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gagal membaca foto"));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Gagal kompres foto")), "image/jpeg", quality);
  });
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
