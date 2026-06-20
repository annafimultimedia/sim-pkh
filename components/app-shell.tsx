"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpenCheck,
  ArchiveRestore,
  Camera,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileSpreadsheet,
  FileText,
  FileCheck2,
  HeartPulse,
  HardDrive,
  MonitorCog,
  Home,
  HandCoins,
  Layers3,
  KeyRound,
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
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivePeriod, AppNotification, SessionUser } from "@/lib/types";
import type { PendampingMenuKey } from "@/lib/menu-access";

type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  admin?: boolean;
  pendampingKey?: PendampingMenuKey;
};

const groups: { title: string; items: MenuItem[] }[] = [
  {
    title: "",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/tracking", label: "Tracking & Komparasi", icon: BarChart3, pendampingKey: "tracking" }
    ]
  },
  {
    title: "Manajemen Data",
    items: [
      { href: "/final-closing", label: "Data Final Closing", icon: Table2, pendampingKey: "final-closing" },
      { href: "/art", label: "Data ART", icon: Database, pendampingKey: "art" },
      { href: "/wilayah", label: "Master Wilayah", icon: Map, admin: true },
      { href: "/pendamping", label: "Data Pendamping", icon: Users, admin: true }
    ]
  },
  {
    title: "Operasional Pendamping (P2K2)",
    items: [
      { href: "/kelompok", label: "Manajemen Kelompok", icon: Layers3, pendampingKey: "kelompok" },
      { href: "/absensi", label: "Cetak Absensi", icon: ClipboardList, pendampingKey: "absensi" },
      { href: "/laporan-p2k2", label: "Laporan P2K2", icon: FileCheck2, pendampingKey: "laporan-p2k2" },
      { href: "/rekap-p2k2", label: "Rekap P2K2", icon: ClipboardCheck, pendampingKey: "rekap-p2k2" }
    ]
  },
  {
    title: "Penyaluran",
    items: [
      { href: "/rekon", label: "Rekon", icon: HandCoins, pendampingKey: "rekon" }
    ]
  },
  {
    title: "Verifikasi",
    items: [
      { href: "/verifikasi-kesehatan", label: "Verifikasi Kesehatan", icon: HeartPulse, pendampingKey: "verifikasi-kesehatan" }
    ]
  },
  {
    title: "Arsip Surat",
    items: [
      { href: "/surat", label: "Surat-surat", icon: FileText, pendampingKey: "surat" }
    ]
  },
  {
    title: "Admin",
    items: [
      { href: "/import", label: "Import Center", icon: UploadCloud, admin: true },
      { href: "/users", label: "Manajemen User", icon: Shield, admin: true },
      { href: "/hak-akses", label: "Hak Akses Menu", icon: KeyRound, admin: true },
      { href: "/logs", label: "Log Aktivitas", icon: Activity, admin: true },
      { href: "/server-monitor", label: "Pantauan Server", icon: MonitorCog, admin: true },
      { href: "/storage", label: "Monitoring File", icon: HardDrive, admin: true },
      { href: "/backup", label: "Backup & Restore", icon: ArchiveRestore, admin: true },
      { href: "/settings", label: "Pengaturan", icon: Settings }
    ]
  }
];

export function AppShell({ user, activePeriod, appName, allowedMenuKeys, notifications, children }: { user: SessionUser; activePeriod: ActivePeriod; appName: string; allowedMenuKeys: PendampingMenuKey[]; notifications: AppNotification[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const idleTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const idleWarningRef = useRef(false);
  const lastHeartbeatRef = useRef(0);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const [profilePhotoSrc, setProfilePhotoSrc] = useState(user.photoPath ?? "");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => notifications.filter((item) => item.isRead).map((item) => item.id));
  const unreadNotifications = notifications.filter((item) => !readNotificationIds.includes(item.id));
  const notificationCount = unreadNotifications.length;
  const hasNewNotification = unreadNotifications.length > 0;
  const notificationStorageKey = `sim_pkh_read_notifications_${user.id}`;

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
    try {
      const saved = localStorage.getItem(notificationStorageKey);
      const cachedIds = saved ? JSON.parse(saved) : [];
      const serverIds = notifications.filter((item) => item.isRead).map((item) => item.id);
      const mergedIds = [...new Set([...(Array.isArray(cachedIds) ? cachedIds : []), ...serverIds])].slice(-100);
      setReadNotificationIds(mergedIds);
      localStorage.setItem(notificationStorageKey, JSON.stringify(mergedIds));
      if (mergedIds.some((id) => !serverIds.includes(id))) {
        fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: mergedIds })
        }).catch(() => {});
      }
    } catch {
      setReadNotificationIds(notifications.filter((item) => item.isRead).map((item) => item.id));
    }
  }, [notificationStorageKey, notifications]);

  async function markNotificationRead(id: string) {
    setReadNotificationIds((current) => {
      const next = [...new Set([...current, id])].slice(-80);
      localStorage.setItem(notificationStorageKey, JSON.stringify(next));
      return next;
    });
    setNotificationMenuOpen(false);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
        keepalive: true
      });
    } catch {}
  }

  async function openNotification(item: AppNotification) {
    await markNotificationRead(item.id);
    router.push(item.href);
  }

  useEffect(() => {
    if (user.photoPath && !profilePhotoSrc) {
      setProfilePhotoSrc(user.photoPath);
    }
  }, [profilePhotoSrc, user.photoPath]);

  useEffect(() => {
    function closeProfileMenu(event: PointerEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (!notificationMenuRef.current?.contains(event.target as Node)) {
        setNotificationMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeProfileMenu);
    return () => document.removeEventListener("pointerdown", closeProfileMenu);
  }, []);

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
          <p className="truncate text-sm font-bold">{appName}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">PKH Management</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {groups.map((group) => {
          const items = group.items.filter((item) => {
            if (item.admin) return user.role === "ADMIN";
            if (user.role === "ADMIN" || !item.pendampingKey) return true;
            return allowedMenuKeys.includes(item.pendampingKey as PendampingMenuKey);
          });
          if (!items.length) return null;
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
      <div className="border-t border-border/60 p-4 text-[11px] text-muted-foreground">&copy; 2026 {appName} v1.0</div>
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
        <header className="relative z-[300] flex h-16 items-center justify-between gap-2 border-b border-border glass px-2 sm:px-4 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button className="grid h-9 w-9 shrink-0 place-items-center rounded-xl hover:bg-muted lg:hidden sm:h-10 sm:w-10" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 max-w-[118px] sm:max-w-none">
              <p className="truncate text-xs font-bold leading-4 sm:text-sm">{user.regency}</p>
              <p className="truncate text-[10px] leading-4 text-muted-foreground sm:hidden">{user.role === "ADMIN" ? "Admin Kabupaten" : `Kec. ${user.district}`}</p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{user.role === "ADMIN" ? "Admin Kabupaten" : `Pendamping Kecamatan ${user.district}`}</p>
            </div>
            <span className="inline-flex shrink-0 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200 sm:px-3 sm:py-1.5 sm:text-xs">
              <span className="sm:hidden">{activePeriod.year} T{activePeriod.stage}</span>
              <span className="hidden sm:inline">Periode Aktif: {activePeriod.year} Tahap {activePeriod.stage}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div ref={notificationMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setNotificationMenuOpen((current) => !current)}
                className={`relative grid h-9 w-9 place-items-center rounded-xl border border-border bg-white text-slate-600 hover:text-primary sm:h-10 sm:w-10 ${hasNewNotification ? "animate-pulse ring-2 ring-emerald-100" : ""}`}
                title="Notifikasi"
              >
                <Bell className="h-4 w-4" />
                {hasNewNotification ? (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  </span>
                ) : null}
                {notificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {notificationCount}
                  </span>
                ) : null}
              </button>
              {notificationMenuOpen ? (
                <div className="fixed left-2 right-2 top-[4.35rem] z-[400] rounded-xl border border-border bg-white p-2 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[min(22rem,calc(100vw-2rem))]">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <p className="text-sm font-bold text-slate-900">Notifikasi</p>
                    <span className="text-xs font-semibold text-muted-foreground">{notificationCount.toLocaleString("id-ID")} baru</span>
                  </div>
                  <div className="max-h-[55vh] overscroll-contain overflow-y-auto py-2 sm:max-h-96">
                    {notifications.length ? notifications.map((item) => {
                      const isRead = readNotificationIds.includes(item.id);
                      return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => void openNotification(item)}
                        className={`block w-full rounded-lg px-3 py-2.5 text-left hover:bg-muted ${isRead ? "opacity-70" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${isRead ? "bg-slate-300" : notificationToneClass(item.tone)}`} />
                          <span className="min-w-0">
                            <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-900">
                              <span className="min-w-0 flex-1">{item.title}</span>
                              {item.isNew && !isRead ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 ring-1 ring-emerald-100">Baru</span> : null}
                              {isRead ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">Dibaca</span> : null}
                              {item.count ? <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{item.count.toLocaleString("id-ID")}</span> : null}
                            </span>
                            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                          </span>
                        </div>
                      </button>
                    );}) : (
                      <div className="px-3 py-8 text-center text-sm text-muted-foreground">Tidak ada notifikasi.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((current) => !current)}
                className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary ring-1 ring-border transition hover:ring-primary sm:h-10 sm:w-10"
                title="Profil"
              >
                {profilePhotoSrc ? <img src={profilePhotoSrc} alt={user.name} className="h-full w-full object-cover" /> : user.name.slice(0, 1).toUpperCase()}
              </button>
              {profileMenuOpen ? (
                <div className="absolute right-0 top-12 z-30 w-52 rounded-xl border border-border bg-white p-2 text-sm shadow-soft">
                  <Link href="/settings?focus=photo" onClick={() => setProfileMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-muted">
                    <Camera className="h-4 w-4 text-primary" />
                    Ganti Foto
                  </Link>
                  <Link href="/settings?focus=password" onClick={() => setProfileMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-muted">
                    <KeyRound className="h-4 w-4 text-primary" />
                    Ganti Password
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.username}</p>
            </div>
            <button onClick={logout} className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-white text-slate-600 hover:text-red-600 sm:h-10 sm:w-10" title="Keluar">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
      {idleWarning ? (
        <div className="fixed inset-0 z-[600] grid place-items-center bg-slate-950/40 p-4">
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

function notificationToneClass(tone: AppNotification["tone"]) {
  if (tone === "danger") return "bg-rose-500";
  if (tone === "warning") return "bg-amber-500";
  if (tone === "success") return "bg-emerald-500";
  return "bg-sky-500";
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
