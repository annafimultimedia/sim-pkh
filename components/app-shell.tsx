"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  ArchiveRestore,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileSpreadsheet,
  FileText,
  FileCheck2,
  HardDrive,
  Home,
  HandCoins,
  Layers3,
  LogOut,
  Map,
  Menu,
  Settings,
  Shield,
  Table2,
  UploadCloud,
  Users,
  X
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivePeriod, SessionUser } from "@/lib/types";

const groups = [
  {
    title: "",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/tracking", label: "Tracking & Komparasi", icon: BarChart3 }
    ]
  },
  {
    title: "Manajemen Data",
    items: [
      { href: "/final-closing", label: "Data Final Closing", icon: Table2 },
      { href: "/art", label: "Data ART", icon: Database },
      { href: "/wilayah", label: "Master Wilayah", icon: Map, admin: true },
      { href: "/pendamping", label: "Data Pendamping", icon: Users, admin: true }
    ]
  },
  {
    title: "Operasional Pendamping (P2K2)",
    items: [
      { href: "/kelompok", label: "Manajemen Kelompok", icon: Layers3 },
      { href: "/absensi", label: "Cetak Absensi", icon: ClipboardList },
      { href: "/laporan-p2k2", label: "Laporan P2K2", icon: FileCheck2 },
      { href: "/rekap-p2k2", label: "Rekap Kehadiran P2K2", icon: ClipboardCheck }
    ]
  },
  {
    title: "Penyaluran",
    items: [
      { href: "/rekon", label: "Rekon", icon: HandCoins }
    ]
  },
  {
    title: "Arsip Surat",
    items: [
      { href: "/surat", label: "Surat-surat", icon: FileText }
    ]
  },
  {
    title: "Admin",
    items: [
      { href: "/import", label: "Import Center", icon: UploadCloud, admin: true },
      { href: "/users", label: "Manajemen User", icon: Shield, admin: true },
      { href: "/logs", label: "Log Aktivitas", icon: Activity, admin: true },
      { href: "/storage", label: "Monitoring File", icon: HardDrive, admin: true },
      { href: "/backup", label: "Backup & Restore", icon: ArchiveRestore, admin: true },
      { href: "/settings", label: "Pengaturan", icon: Settings }
    ]
  }
];

export function AppShell({ user, activePeriod, children }: { user: SessionUser; activePeriod: ActivePeriod; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const idleTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const idleWarningRef = useRef(false);
  const lastHeartbeatRef = useRef(0);
  const [profilePhotoSrc, setProfilePhotoSrc] = useState(user.photoPath ?? "");

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.setItem("sim_pkh_logout", String(Date.now()));
    router.push("/login");
    router.refresh();
  }, [router]);

  const sendHeartbeat = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastHeartbeatRef.current < 15 * 1000) return;
    lastHeartbeatRef.current = now;
    fetch("/api/auth/heartbeat", { method: "POST" }).catch(() => {});
  }, []);

  const continueSession = useCallback((notifyServer = true) => {
    idleWarningRef.current = false;
    setIdleWarning(false);
    setCountdown(10);
    if (notifyServer) sendHeartbeat(true);
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      setIdleWarning(true);
      setCountdown(10);
    }, 60 * 60 * 1000);
  }, [sendHeartbeat]);

  useEffect(() => {
    function handleProfilePhotoUpdate(event: Event) {
      const detail = (event as CustomEvent<{ photoPath?: string }>).detail;
      setProfilePhotoSrc(detail?.photoPath ? `${detail.photoPath}?v=${Date.now()}` : "");
    }

    window.addEventListener("sim_pkh_profile_photo_updated", handleProfilePhotoUpdate);
    return () => window.removeEventListener("sim_pkh_profile_photo_updated", handleProfilePhotoUpdate);
  }, []);

  useEffect(() => {
    if (user.photoPath && !profilePhotoSrc) {
      setProfilePhotoSrc(user.photoPath);
    }
  }, [profilePhotoSrc, user.photoPath]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === "sim_pkh_logout") {
        router.push("/login");
        router.refresh();
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [router]);

  useEffect(() => {
    idleWarningRef.current = idleWarning;
  }, [idleWarning]);

  useEffect(() => {
    function activity() {
      if (!idleWarningRef.current) {
        continueSession(false);
        sendHeartbeat();
      }
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        continueSession(false);
        sendHeartbeat(true);
      }
    }

    continueSession();
    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }));
    window.addEventListener("focus", activity);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      events.forEach((event) => window.removeEventListener(event, activity));
      window.removeEventListener("focus", activity);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    };
  }, [continueSession, sendHeartbeat]);

  useEffect(() => {
    if (!idleWarning) return;
    idleWarningRef.current = true;
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(countdownTimerRef.current ?? undefined);
          logout();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    };
  }, [idleWarning, logout]);

  useEffect(() => {
    if (user.role !== "ADMIN") return;
    fetch("/api/backup", { method: "PUT" }).catch(() => {});
    const timer = window.setInterval(() => {
      fetch("/api/backup", { method: "PUT" }).catch(() => {});
    }, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [user.role]);

  const sidebar = (
    <aside className="flex h-full w-[276px] flex-col border-r border-border glass">
      <div className="flex h-16 items-center gap-3 border-b border-border/60 px-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white">
          <BookOpenCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">SIM-PKH Kabupaten</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">PKH Management</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {groups.map((group) => {
          const items = group.items.filter((item) => !item.admin || user.role === "ADMIN");
          return (
            <div key={group.title || "main"} className="mb-4">
              {group.title && <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{group.title}</p>}
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        active ? "bg-primary/10 text-primary shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950"
                      }`}
                    >
                      <span className={`grid h-8 w-8 place-items-center rounded-lg ${active ? "bg-primary/10" : "bg-muted/70"}`}>
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-border/60 p-4 text-[11px] text-muted-foreground">&copy; 2026 SIM-PKH v1.0</div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onPointerDown={() => setOpen(false)}>
          <div className="relative h-full w-[276px]" onPointerDown={(event) => event.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border glass px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-sm font-bold">{user.regency}</p>
              <p className="text-xs text-muted-foreground">{user.role === "ADMIN" ? "Admin Kabupaten" : `Pendamping Kecamatan ${user.district}`}</p>
            </div>
            <span className="inline-flex rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200 sm:px-3 sm:py-1.5 sm:text-xs">
              <span className="sm:hidden">{activePeriod.year} T{activePeriod.stage}</span>
              <span className="hidden sm:inline">Periode Aktif: {activePeriod.year} Tahap {activePeriod.stage}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary ring-1 ring-border">
              {profilePhotoSrc ? <img src={profilePhotoSrc} alt={user.name} className="h-full w-full object-cover" /> : user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.username}</p>
            </div>
            <button onClick={logout} className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-white text-slate-600 hover:text-red-600" title="Keluar">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
      {idleWarning ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft">
            <h2 className="text-lg font-bold">Sesi Hampir Berakhir</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tidak ada aktivitas selama 1 jam. Sistem akan logout otomatis dalam <span className="font-bold text-rose-600">{countdown}</span> detik.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={logout} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold">Logout</button>
              <button onClick={() => continueSession()} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white">Lanjutkan</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export const PrimaryButton = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...props} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-soft hover:bg-emerald-800 ${props.className ?? ""}`}>
    {children}
  </button>
);
