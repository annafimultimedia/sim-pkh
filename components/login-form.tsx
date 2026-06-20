"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BookOpen, Eye, EyeOff, HeartPulse, KeyRound, Loader2, UserRound, UsersRound } from "lucide-react";

const featureItems = [
  {
    label: "Pemberdayaan Keluarga",
    icon: UsersRound,
    className: "from-blue-600 to-cyan-500"
  },
  {
    label: "Kesehatan & Gizi",
    icon: HeartPulse,
    className: "from-emerald-500 to-teal-500"
  },
  {
    label: "Edukasi & Literasi",
    icon: BookOpen,
    className: "from-indigo-500 to-blue-500"
  }
];

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login() {
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        setError("Username atau password tidak sesuai.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server. Silakan coba kembali.");
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-sky-100 text-slate-950">
      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage: "url('/images/login-background.webp')",
          backgroundPosition: "38% bottom"
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_48%,rgba(255,255,255,0.2),rgba(255,255,255,0)_34%),linear-gradient(90deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.06)_42%,rgba(8,145,178,0.18)_100%)]" />
      <div className="absolute inset-y-0 right-0 hidden w-[54%] bg-gradient-to-l from-cyan-400/28 via-cyan-100/14 to-transparent lg:block" />
      <div className="absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-white/55 via-white/22 to-transparent lg:hidden" />

      <section className="relative z-10 flex min-h-screen flex-col gap-7 px-5 py-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:px-16 xl:px-24">
        <div className="order-2 flex items-end lg:order-1 lg:min-h-0">
          <div className="mb-2 max-w-[660px] lg:mb-8">
            <h1 className="text-[34px] font-black leading-tight text-blue-700 drop-shadow-[0_2px_0_rgba(255,255,255,0.95)] [text-shadow:0_2px_0_rgba(255,255,255,0.95),0_0_18px_rgba(255,255,255,0.9)] sm:text-[48px] lg:text-[56px]">
              Bersama Keluarga,
              <br />
              Membangun Indonesia
            </h1>
            <p className="mt-4 max-w-[560px] text-base font-semibold leading-7 text-slate-700 [text-shadow:0_1px_0_rgba(255,255,255,0.95),0_0_14px_rgba(255,255,255,0.9)] sm:text-xl">
              Bersama keluarga, kita wujudkan keluarga berdaya, sehat dan sejahtera.
            </p>

            <div className="mt-7 grid max-w-[620px] grid-cols-1 gap-3 sm:grid-cols-3">
              {featureItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${item.className} text-white shadow-[0_12px_24px_rgba(14,116,144,0.22)] ring-2 ring-white/85`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-bold leading-tight text-slate-900 [text-shadow:0_1px_0_rgba(255,255,255,0.95),0_0_12px_rgba(255,255,255,0.9)]">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="order-1 flex items-start justify-center lg:order-2 lg:items-center lg:justify-end">
          <section className="w-full max-w-[430px] rounded-[24px] border border-white bg-white px-6 py-7 shadow-[0_24px_72px_rgba(15,68,112,0.28)] sm:px-8 lg:bg-white/56 lg:px-9 lg:py-9 lg:backdrop-blur-xl">
            <div className="mb-7 grid place-items-center text-center">
              <div className="rounded-2xl bg-white px-5 py-3 shadow-[0_10px_28px_rgba(15,68,112,0.12)] lg:bg-transparent lg:p-0 lg:shadow-none">
                <Image src="/images/pkh-logo.png" alt="PKH" width={420} height={217} priority className="h-auto w-[190px] max-w-full object-contain" />
              </div>
              <h2 className="mt-7 text-2xl font-extrabold text-slate-950">
                Selamat Datang di <span className="bg-gradient-to-r from-blue-700 via-sky-500 to-emerald-500 bg-clip-text text-transparent">SIM-PKH</span>
              </h2>
              <p className="mt-3 text-sm font-bold text-slate-700 sm:text-base">Silakan masuk untuk melanjutkan ke dashboard</p>
            </div>

            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-950">Username</span>
                <span className="relative block">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <input
                    name="username"
                    placeholder="Masukkan username"
                    value={username}
                    disabled={loading}
                    onChange={(event) => setUsername(event.target.value)}
                    className="h-[52px] w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm font-semibold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-sky-400 focus:ring-4 focus:ring-sky-300/25 disabled:cursor-wait disabled:bg-slate-50"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-950">Password</span>
                <span className="relative block">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <input
                    name="password"
                    placeholder="Masukkan password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    disabled={loading}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !loading) login();
                    }}
                    className="h-[52px] w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-12 text-sm font-semibold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-sky-400 focus:ring-4 focus:ring-sky-300/25 disabled:cursor-wait disabled:bg-slate-50"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPassword((show) => !show)} className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-white/70">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </span>
              </label>

              {error && <p className="rounded-xl bg-rose-50/90 px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm">{error}</p>}

              <button type="button" onClick={login} disabled={loading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 text-base font-bold text-white shadow-[0_16px_30px_rgba(37,99,235,0.28)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-75">
                {loading ? <><Loader2 className="h-5 w-5 animate-spin" />Memproses...</> : "Masuk"}
              </button>
            </div>

            <p className="mt-8 text-center text-sm font-semibold text-slate-500">
              &copy; 2026 
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
