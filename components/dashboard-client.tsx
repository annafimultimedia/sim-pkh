"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, FileCheck2, HandCoins, Layers3, Loader2, Plus, RefreshCw, Users, X } from "lucide-react";
import { DeadlineTask, DistrictOption } from "@/lib/types";

type OnlineUser = {
  id: number;
  name: string;
  username: string;
  role: string;
  district: string | null;
  lastSeenAt: string;
};

export function DashboardClient({ data, onlineUsers = [], isAdmin = false, tasks = [], districts = [] }: { data: any; onlineUsers?: OnlineUser[]; isAdmin?: boolean; tasks?: DeadlineTask[]; districts?: DistrictOption[] }) {
  const router = useRouter();
  const [liveOnlineUsers, setLiveOnlineUsers] = useState(onlineUsers);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [taskRows, setTaskRows] = useState(tasks);
  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<DeadlineTask | null>(null);
  const [taskWidgetMode, setTaskWidgetMode] = useState<"open" | "minimized" | "closed">("open");
  const [popupOpen, setPopupOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", dueDate: "", targetRole: "ALL", districtId: "" });
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    async function loadOnlineUsers(showLoading = false) {
      if (showLoading) setLoadingOnline(true);
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        const json = await res.json();
        if (res.ok && Array.isArray(json.onlineUsers)) setLiveOnlineUsers(json.onlineUsers);
      } finally {
        if (showLoading) setLoadingOnline(false);
      }
    }

    const timer = window.setInterval(() => loadOnlineUsers(), 15 * 1000);
    loadOnlineUsers(true);
    return () => window.clearInterval(timer);
  }, [isAdmin]);

  const urgentTasks = taskRows.filter((task) => !task.completed && daysUntil(task.dueDate) <= 3);

  useEffect(() => {
    if (!urgentTasks.length) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem("sim_pkh_tasks_hidden_until") === todayKey) return;
    setPopupOpen(true);
  }, [urgentTasks.length]);

  const cards = [
    { label: "Total KPM", value: data.totalKpm.toLocaleString("id-ID"), icon: Users, color: "bg-emerald-50 text-emerald-700" },
    { label: "Jumlah Kelompok", value: data.groupCount.toLocaleString("id-ID"), icon: Layers3, color: "bg-amber-50 text-amber-700" },
    { label: data.mappedLabel ?? "KPM Termapping", value: data.mapped.toLocaleString("id-ID"), icon: CheckCircle2, color: "bg-sky-50 text-sky-700" },
    { label: "Belum Termapping", value: data.unmapped.toLocaleString("id-ID"), icon: AlertTriangle, color: "bg-rose-50 text-rose-700" }
  ];
  const alerts = data.alerts ?? {};

  async function deleteTask(task: DeadlineTask) {
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setTaskRows((current) => current.filter((item) => item.id !== task.id));
  }

  async function createTask() {
    if (!newTask.title.trim() || !newTask.dueDate) return;
    setSavingTask(true);
    try {
      const res = await fetch(editingTask ? `/api/tasks/${editingTask.id}` : "/api/tasks", {
        method: editingTask ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask)
      });
      if (!res.ok) return;
      const json = await res.json();
      if (editingTask) {
        const district = districts.find((item) => item.id === newTask.districtId);
        setTaskRows((current) => current
          .map((item) => item.id === editingTask.id ? {
            ...item,
            title: newTask.title.trim(),
            description: newTask.description.trim(),
            dueDate: newTask.dueDate,
            targetRole: newTask.targetRole as DeadlineTask["targetRole"],
            districtId: newTask.districtId,
            districtName: district?.name ?? ""
          } : item)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
      } else if (json.task) {
        setTaskRows((current) => [...current, json.task].sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
      }
      setTaskModal(false);
      setEditingTask(null);
      setNewTask({ title: "", description: "", dueDate: "", targetRole: "ALL", districtId: "" });
    } finally {
      setSavingTask(false);
    }
  }

  function openNewTaskModal() {
    setEditingTask(null);
    setNewTask({ title: "", description: "", dueDate: "", targetRole: "ALL", districtId: "" });
    setTaskModal(true);
  }

  function openEditTaskModal(task: DeadlineTask) {
    setEditingTask(task);
    setNewTask({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      targetRole: task.targetRole,
      districtId: task.districtId
    });
    setTaskModal(true);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <div className={`grid h-11 w-11 place-items-center rounded-xl ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{card.value}</p>
            </div>
          );
        })}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">Monitoring P2K2 Bulan Ini</h2>
              <p className="mt-1 text-sm text-muted-foreground">Monitoring laporan bulan {monthName(alerts.p2k2Month)} untuk kelompok periode aktif.</p>
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <ClipboardCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Laporan Terkirim" value={alerts.p2k2Terkirim ?? 0} tone="emerald" />
            <MiniStat label="Draft" value={alerts.p2k2Draft ?? 0} tone="amber" />
            <MiniStat label="Belum Dibuat" value={alerts.p2k2BelumDibuat ?? 0} tone="rose" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">Monitoring Rekon Tahap Aktif</h2>
              <p className="mt-1 text-sm text-muted-foreground">Pantauan status transaksi KPM.</p>
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-50 text-sky-700">
              <HandCoins className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <MiniStat label="Total Rekon" value={alerts.rekonTotal ?? 0} tone="slate" />
            <MiniStat label="Belum Transaksi" value={alerts.rekonBelumTransaksi ?? 0} tone="rose" />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-2xl border border-border bg-white p-5 shadow-soft">
          <h2 className="text-base font-bold">Monitoring Data KPM Berdasarkan Tahap</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer>
              <BarChart data={data.byStage}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="tahap" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" radius={[8, 8, 0, 0]} fill="#087f5b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-white p-5 shadow-soft">
          <h2 className="text-base font-bold">Quick Alert Status KPM</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.byStatus} dataKey="value" nameKey="name" innerRadius={62} outerRadius={105} paddingAngle={4}>
                  {data.byStatus.map((_: any, i: number) => (
                    <Cell key={i} fill={statusPieColor(i)} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="rounded-2xl border border-border bg-white p-5 shadow-soft">
        <h2 className="text-base font-bold">Total KPM per Kecamatan/Desa Tugas</h2>
        <p className="mt-1 text-sm text-muted-foreground">Rekap mengikuti periode aktif: Tahun {data.activePeriod?.year ?? "-"} Tahap {data.activePeriod?.stage ?? "-"}</p>
        <div className="mt-4 h-72">
          <ResponsiveContainer>
            <BarChart data={data.byDistrict}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      {isAdmin ? (
        <section className="rounded-2xl border border-border bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">User Online</h2>
              <p className="mt-1 text-sm text-muted-foreground">Akun yang aktif memakai web dalam 2 menit terakhir.</p>
            </div>
            <div className="flex items-center gap-2">
              {loadingOnline ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">{liveOnlineUsers.length} online</span>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-border px-3 py-2 text-left">Nama</th>
                  <th className="border-b border-border px-3 py-2 text-left">Username</th>
                  <th className="border-b border-border px-3 py-2 text-left">Role</th>
                  <th className="border-b border-border px-3 py-2 text-left">Kecamatan</th>
                  <th className="border-b border-border px-3 py-2 text-left">Terakhir Aktif</th>
                </tr>
              </thead>
              <tbody>
                {liveOnlineUsers.length ? liveOnlineUsers.map((item) => (
                  <tr key={item.id}>
                    <td className="border-b border-border px-3 py-2 font-semibold">{item.name}</td>
                    <td className="border-b border-border px-3 py-2">{item.username}</td>
                    <td className="border-b border-border px-3 py-2">{item.role}</td>
                    <td className="border-b border-border px-3 py-2">{item.district ?? "-"}</td>
                    <td className="border-b border-border px-3 py-2">{item.lastSeenAt}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Belum ada user online.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {popupOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-3 sm:grid sm:place-items-center sm:p-4">
          <section className="mx-auto w-full max-w-lg rounded-2xl bg-white p-4 shadow-soft sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Tugas Mendekati Deadline</h2>
                <p className="mt-1 text-sm text-muted-foreground">{urgentTasks.length} tugas perlu diperhatikan.</p>
              </div>
              <button onClick={() => setPopupOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 space-y-2">
              {urgentTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="rounded-xl border border-border px-3 py-2">
                  <p className="font-bold">{task.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{dueLabel(daysUntil(task.dueDate))} - {formatDate(task.dueDate)}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <button onClick={() => setPopupOpen(false)} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold">Tutup</button>
              <button onClick={() => {
                localStorage.setItem("sim_pkh_tasks_hidden_until", new Date().toISOString().slice(0, 10));
                setPopupOpen(false);
              }} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white">Jangan tampilkan hari ini</button>
            </div>
          </section>
        </div>
      ) : null}
      {taskModal ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-3 sm:grid sm:place-items-center sm:p-4">
          <section className="mx-auto w-full max-w-lg rounded-2xl bg-white p-4 shadow-soft sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{editingTask ? "Ubah Tugas Deadline" : "Tambah Tugas Deadline"}</h2>
              <button onClick={() => { setTaskModal(false); setEditingTask(null); }} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="text-sm font-semibold">
                Nama Tugas
                <input value={newTask.title} onChange={(event) => setNewTask((state) => ({ ...state, title: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border px-3" />
              </label>
              <label className="text-sm font-semibold">
                Deadline
                <input type="date" value={newTask.dueDate} onChange={(event) => setNewTask((state) => ({ ...state, dueDate: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border px-3" />
              </label>
              <label className="text-sm font-semibold">
                Target
                <select value={newTask.targetRole} onChange={(event) => setNewTask((state) => ({ ...state, targetRole: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
                  <option value="ALL">Semua User</option>
                  <option value="ADMIN">Admin</option>
                  <option value="PENDAMPING">Pendamping</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Kecamatan Target
                <select value={newTask.districtId} onChange={(event) => setNewTask((state) => ({ ...state, districtId: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3">
                  <option value="">Semua Kecamatan</option>
                  {districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Catatan
                <textarea value={newTask.description} onChange={(event) => setNewTask((state) => ({ ...state, description: event.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border border-border px-3 py-2" />
              </label>
            </div>
            <div className="mt-5 grid gap-2 sm:flex sm:justify-end">
              <button onClick={() => { setTaskModal(false); setEditingTask(null); }} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold">Batal</button>
              <button onClick={createTask} disabled={savingTask || !newTask.title.trim() || !newTask.dueDate} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">
                {savingTask ? "Menyimpan..." : editingTask ? "Simpan Perubahan" : "Simpan"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {taskWidgetMode === "minimized" ? (
        <button
          onClick={() => setTaskWidgetMode("open")}
          className="fixed bottom-3 right-3 z-40 inline-flex h-11 items-center gap-2 rounded-full border border-border bg-white/95 px-3 text-xs font-bold text-slate-800 shadow-2xl backdrop-blur sm:bottom-5 sm:right-5 sm:h-12 sm:px-4 sm:text-sm"
        >
          <CalendarClock className="h-4 w-4 text-sky-700" />
          Deadline
          {urgentTasks.length ? <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] text-white">{urgentTasks.length}</span> : null}
        </button>
      ) : null}
      {taskWidgetMode === "open" ? (
        <section className="fixed bottom-3 right-3 z-40 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border bg-white/95 p-3 shadow-2xl backdrop-blur sm:bottom-5 sm:right-5 sm:w-[calc(100vw-2rem)] sm:max-w-sm sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2 sm:gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700 sm:h-10 sm:w-10">
                <CalendarClock className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold sm:text-base">Tugas & Deadline</h2>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {isAdmin ? (
                <button onClick={openNewTaskModal} className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white" title="Tambah Tugas">
                  <Plus className="h-4 w-4" />
                </button>
              ) : null}
              <button onClick={() => setTaskWidgetMode("minimized")} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white text-slate-700 hover:bg-muted" title="Minimize">
                <span className="text-lg font-bold leading-none">-</span>
              </button>
              <button onClick={() => setTaskWidgetMode("closed")} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white text-slate-700 hover:bg-muted" title="Tutup">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-3 max-h-[34vh] overflow-y-auto pr-1 sm:mt-4 sm:max-h-[48vh]">
            {taskRows.length ? (
              <div className="relative space-y-1">
                {taskRows.slice(0, 3).map((task, index) => (
                  <TimelineTaskItem
                    key={task.id}
                    task={task}
                    index={index}
                    isLast={index === Math.min(taskRows.length, 3) - 1}
                    isAdmin={isAdmin}
                    compact
                    onEdit={openEditTaskModal}
                    onDelete={deleteTask}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Belum ada tugas deadline.</div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TimelineTaskItem({ task, index, isLast, isAdmin, compact = false, onEdit, onDelete }: { task: DeadlineTask; index: number; isLast: boolean; isAdmin: boolean; compact?: boolean; onEdit: (task: DeadlineTask) => void; onDelete: (task: DeadlineTask) => void }) {
  const Icon = task.completed ? CheckCircle2 : daysUntil(task.dueDate) <= 0 ? AlertTriangle : index % 3 === 0 ? ClipboardCheck : index % 3 === 1 ? FileCheck2 : RefreshCw;
  const remaining = daysUntil(task.dueDate);
  return (
    <div className={`relative grid grid-cols-[40px_minmax(0,1fr)] gap-3 ${compact ? "pb-3" : "pb-4"} last:pb-0`}>
      {!isLast ? <span className="absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-px bg-slate-200" /> : null}
      <div className={`relative z-10 grid h-9 w-9 place-items-center rounded-xl text-white shadow-sm sm:h-10 sm:w-10 ${taskIconClass(task, index)}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className={`min-w-0 rounded-xl border px-2.5 sm:px-3 ${taskCardClass(task)} ${compact ? "py-2" : "py-3"}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 sm:text-base">{task.title}</p>
            <p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">Deadline: {formatDateRange(task.dueDate)}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">Sisa waktu: {dueLabel(remaining)}</p>
          </div>
          <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold sm:px-3 sm:text-xs ${taskToneClass(task)}`}>{dueLabel(remaining)}</span>
        </div>
        {!compact && task.description ? <p className="mt-2 text-sm text-muted-foreground">{task.description}</p> : null}
        {isAdmin ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500">{taskTargetLabel(task)}</span>
            <button onClick={() => onEdit(task)} className="h-8 rounded-lg border border-border px-3 text-xs font-bold text-slate-700 hover:bg-muted">Ubah</button>
            <button onClick={() => onDelete(task)} className="h-8 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50">Hapus</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "slate" | "emerald" | "amber" | "rose" }) {
  const colors = {
    slate: "bg-slate-50 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700"
  };
  return (
    <div className={`rounded-xl px-3 py-3 ${colors[tone]}`}>
      <p className="text-xl font-bold">{Number(value ?? 0).toLocaleString("id-ID")}</p>
      <p className="mt-1 text-[11px] font-bold uppercase leading-tight">{label}</p>
    </div>
  );
}

function monthName(value: number | string | undefined) {
  const month = Number(value);
  const names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return names[month - 1] ?? "-";
}

function statusPieColor(index: number) {
  const hue = (index * 137.508 + 152) % 360;
  return `hsl(${hue.toFixed(1)} 72% 43%)`;
}

function daysUntil(date: string) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const due = new Date(`${date}T00:00:00`).getTime();
  return Math.round((due - start) / 86400000);
}

function dueLabel(days: number) {
  if (days < 0) return `Lewat ${Math.abs(days)} hari`;
  if (days === 0) return "Hari ini";
  if (days === 1) return "Besok";
  return `${days} hari lagi`;
}

function taskToneClass(task: DeadlineTask) {
  const days = daysUntil(task.dueDate);
  if (task.completed) return "bg-emerald-50 text-emerald-700";
  if (days < 0) return "bg-rose-50 text-rose-700";
  if (days <= 3) return "bg-amber-50 text-amber-800";
  return "bg-sky-50 text-sky-700";
}

function taskTargetLabel(task: DeadlineTask) {
  const role = task.targetRole === "ALL" ? "Semua user" : task.targetRole === "ADMIN" ? "Admin" : "Pendamping";
  return task.districtName ? `${role} - ${task.districtName}` : role;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatDateRange(value: string) {
  return formatDate(value);
}

function taskIconClass(task: DeadlineTask, index: number) {
  if (task.completed) return "bg-emerald-500";
  const days = daysUntil(task.dueDate);
  if (days < 0) return "bg-rose-600";
  if (days <= 3) return "bg-amber-500";
  return ["bg-sky-500", "bg-violet-500", "bg-cyan-500"][index % 3];
}

function taskCardClass(task: DeadlineTask) {
  const days = daysUntil(task.dueDate);
  if (days < 0) return "border-rose-200 bg-rose-50/80";
  if (days === 0) return "border-red-200 bg-red-50/85";
  if (days <= 3) return "border-amber-200 bg-amber-50/85";
  return "border-sky-100 bg-sky-50/45";
}
