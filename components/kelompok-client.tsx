"use client";

import { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers3, Loader2, Plus, RefreshCw, Trash2, UserCheck, UserX, X } from "lucide-react";
import { DataTable } from "./data-table";
import { MaskedNik } from "./masked-nik";
import { ActivePeriod, DistrictOption, GroupSummary, Kpm, SessionUser } from "@/lib/types";

export function KelompokClient({ kpm, groups, user, districts, activePeriod }: { kpm: Kpm[]; groups: GroupSummary[]; user: SessionUser; districts: DistrictOption[]; activePeriod: ActivePeriod }) {
  if (user.role === "ADMIN") return <AdminKelompok groups={groups} kpm={kpm} activePeriod={activePeriod} />;
  return <PendampingKelompok kpm={kpm} groups={groups} user={user} districts={districts} activePeriod={activePeriod} />;
}

function StatCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: "primary" | "emerald" | "amber" }) {
  const styles = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700"
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-soft">
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${styles[tone]}`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function AdminKelompok({ groups, kpm, activePeriod }: { groups: GroupSummary[]; kpm: Kpm[]; activePeriod: ActivePeriod }) {
  const router = useRouter();
  const [kecamatan, setKecamatan] = useState("SEMUA");
  const [pendamping, setPendamping] = useState("SEMUA");
  const [showArchived, setShowArchived] = useState(false);
  const [localGroups, setLocalGroups] = useState(groups);
  const [active, setActive] = useState(groups[0]?.id ?? 0);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<GroupSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    setLocalGroups(groups);
  }, [groups]);
  const kecamatanOptions = useMemo(() => [...new Set(localGroups.map((row) => row.kecamatan).filter(Boolean))].sort(), [localGroups]);
  const pendampingOptions = useMemo(() => [...new Set(localGroups.map((row) => row.pendamping).filter(Boolean))].sort(), [localGroups]);
  const rows = localGroups.filter((row) => (showArchived || !row.archived) && (kecamatan === "SEMUA" || row.kecamatan === kecamatan) && (pendamping === "SEMUA" || row.pendamping === pendamping));
  const activeKpm = useMemo(() => kpm.filter((row) => row.tahun === activePeriod.year && row.tahap === activePeriod.stage), [activePeriod.stage, activePeriod.year, kpm]);
  const groupedNikSet = useMemo(() => new Set(localGroups.flatMap((group) => group.memberNiks)), [localGroups]);
  const groupedKpmCount = activeKpm.filter((row) => groupedNikSet.has(row.nik)).length;
  const ungroupedKpmCount = Math.max(activeKpm.length - groupedKpmCount, 0);
  const current = localGroups.find((group) => group.id === active);
  const groupMembers = current ? activeKpm.filter((row) => current.memberIds.includes(row.id) || current.memberNiks.includes(row.nik)) : [];

  function openGroupModal(group: GroupSummary) {
    setActive(group.id);
    setShowGroupModal(true);
  }

  async function deleteGroup() {
    if (!deleteGroupTarget) return;
    const target = deleteGroupTarget;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/kelompok/${target.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message ?? "Gagal menghapus kelompok");
      const next = localGroups.filter((group) => group.id !== target.id);
      setLocalGroups(next);
      if (active === target.id) setActive(next[0]?.id ?? 0);
      setDeleteGroupTarget(null);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal menghapus kelompok");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function syncActiveGroups() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await fetch("/api/kelompok/sync-active", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Gagal sinkronisasi kelompok");
      setSyncMessage(`Sinkron selesai: ${json.matched ?? 0} KPM cocok, ${json.missing ?? 0} tidak ditemukan di periode aktif.`);
      router.refresh();
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Gagal sinkronisasi kelompok");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard icon={<Layers3 className="h-5 w-5" />} label="Jumlah Kelompok" value={localGroups.length} tone="primary" />
        <StatCard icon={<UserCheck className="h-5 w-5" />} label="KPM Masuk Kelompok" value={groupedKpmCount} tone="emerald" />
        <StatCard icon={<UserX className="h-5 w-5" />} label="KPM Belum Masuk" value={ungroupedKpmCount} tone="amber" />
      </section>
      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-white p-3 shadow-soft sm:p-4 [&>label]:w-full [&>label]:sm:w-auto [&_select]:w-full">
        <label className="text-sm font-semibold">
          Kecamatan
          <select value={kecamatan} onChange={(e) => setKecamatan(e.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
            <option>SEMUA</option>
            {kecamatanOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Nama Pendamping
          <select value={pendamping} onChange={(e) => setPendamping(e.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
            <option>SEMUA</option>
            {pendampingOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button onClick={syncActiveGroups} disabled={syncing} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sinkronkan Periode Aktif
        </button>
        <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="h-4 w-4 accent-primary" />
          Tampilkan Arsip
        </label>
        <div className="w-full text-sm text-muted-foreground sm:w-auto">Kelompok tampil: <span className="font-bold text-slate-900">{rows.length}</span></div>
      </section>
      {syncMessage ? <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">{syncMessage}</p> : null}
      <DataTable rows={rows as any[]} filename="rekap-kelompok" columns={[
        { key: "name", header: "Nama Kelompok", render: (row: GroupSummary) => <button onClick={() => openGroupModal(row)} className="font-semibold text-primary underline-offset-2 hover:underline">{row.name}</button> },
        { key: "memberCount", header: "Jumlah KPM" },
        { key: "pendamping", header: "Nama Pendamping" },
        { key: "kecamatan", header: "Kecamatan" },
        { key: "archived", header: "Status", render: (row: GroupSummary) => row.archived ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">Arsip</span> : <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Aktif</span> },
        { key: "year", header: "Tahun" },
        { key: "stage", header: "Tahap" },
        { key: "aksi", header: "Aksi", render: (row: GroupSummary) => <button onClick={() => setDeleteGroupTarget(row)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-50 px-3 text-xs font-semibold text-rose-700"><Trash2 className="h-3.5 w-3.5" /> Hapus</button> }
      ] as any[]} />
      {showGroupModal && current ? (
        <div className="fixed inset-0 z-[500] overflow-y-auto bg-slate-950/40 p-3 sm:p-4">
          <div className="mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div className="min-w-0">
                <h3 className="break-words text-lg font-bold text-slate-900">KPM di Kelompok {current.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{groupMembers.length} KPM sudah masuk kelompok ini.</p>
              </div>
              <button onClick={() => setShowGroupModal(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-white hover:bg-slate-50" aria-label="Tutup"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
              <DataTable rows={groupMembers as any[]} filename="anggota-kelompok-admin" columns={[
                { key: "nama", header: "Nama Penerima" },
                { key: "nik", header: "NIK", render: (row: Kpm) => <MaskedNik nik={row.nik} /> },
                { key: "noKk", header: "No KK" },
                { key: "alamat", header: "Alamat", render: (row: Kpm) => formatKpmAddress(row) },
                { key: "rt", header: "RT" },
                { key: "rw", header: "RW" },
                { key: "kelurahan", header: "Desa" },
                { key: "kecamatan", header: "Kecamatan" },
                { key: "pendamping", header: "Pendamping" }
              ] as any[]} />
            </div>
          </div>
        </div>
      ) : null}
      {deleteGroupTarget ? (
        <ConfirmModal
          title="Hapus Kelompok?"
          message={`Hapus kelompok ${deleteGroupTarget.name}? Semua KPM di kelompok ini akan dikeluarkan dan menjadi belum masuk kelompok.`}
          loading={submitting}
          onCancel={() => setDeleteGroupTarget(null)}
          onConfirm={deleteGroup}
        />
      ) : null}
    </div>
  );
}

function PendampingKelompok({ kpm, groups, user, districts, activePeriod }: { kpm: Kpm[]; groups: GroupSummary[]; user: SessionUser; districts: DistrictOption[]; activePeriod: ActivePeriod }) {
  const router = useRouter();
  const assignedDistrictName = districts.find((item) => item.id === user.districtId)?.name || user.district || "SEMUA";
  const [name, setName] = useState("");
  const [active, setActive] = useState(groups[0]?.id ?? 0);
  const [localGroups, setLocalGroups] = useState(groups);
  const [showArchived, setShowArchived] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showKpmModal, setShowKpmModal] = useState(false);
  const [modalKecamatan, setModalKecamatan] = useState(assignedDistrictName);
  const [modalDesa, setModalDesa] = useState("SEMUA");
  const [modalMappingStatus, setModalMappingStatus] = useState("SEMUA");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [visibleModalRows, setVisibleModalRows] = useState<Kpm[]>([]);
  const [confirmBatch, setConfirmBatch] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Kpm | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<GroupSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [infoModal, setInfoModal] = useState<{ title: string; message: string; tone?: "success" | "warning" | "danger" } | null>(null);

  useEffect(() => {
    setLocalGroups(groups);
  }, [groups]);
  const current = localGroups.find((group) => group.id === active);
  const visibleGroups = useMemo(() => localGroups.filter((group) => showArchived || !group.archived), [localGroups, showArchived]);
  const activeKpm = useMemo(() => kpm.filter((row) => row.tahun === activePeriod.year && row.tahap === activePeriod.stage), [activePeriod.stage, activePeriod.year, kpm]);
  const kecamatanOptions = useMemo(() => {
    const fromKpm = [...new Set(activeKpm.map((row) => row.kecamatan).filter(Boolean))].sort();
    return uniqueStrings([assignedDistrictName, ...fromKpm]);
  }, [activeKpm, assignedDistrictName]);
  const desaOptions = useMemo(() => {
    if (modalKecamatan === "SEMUA") return [];
    return [...new Set(activeKpm.filter((row) => sameText(row.kecamatan, modalKecamatan)).map((row) => row.kelurahan).filter(Boolean))].sort();
  }, [activeKpm, modalKecamatan]);
  const groupMembers = current ? activeKpm.filter((row) => isKpmInGroup(row, current)) : [];
  const activeGroups = useMemo(() => localGroups.filter((group) => !group.archived), [localGroups]);
  const groupedKpmCount = activeKpm.filter((row) => activeGroups.some((group) => isKpmInGroup(row, group))).length;
  const ungroupedKpmCount = Math.max(activeKpm.length - groupedKpmCount, 0);
  const modalRows = activeKpm.filter((row) => {
    const isMapped = activeGroups.some((group) => isKpmInGroup(row, group));
    return (modalKecamatan === "SEMUA" || sameText(row.kecamatan, modalKecamatan)) &&
      (modalDesa === "SEMUA" || sameText(row.kelurahan, modalDesa)) &&
      (modalMappingStatus === "SEMUA" || (modalMappingStatus === "SUDAH" ? isMapped : !isMapped));
  });
  const visibleModalIds = visibleModalRows.map((row) => row.id);
  const allVisibleSelected = visibleModalIds.length > 0 && visibleModalIds.every((id) => selectedIds.includes(id));
  const selectedRows = activeKpm.filter((row) => selectedIds.includes(row.id));
  const handleVisibleModalRowsChange = useCallback((items: Record<string, unknown>[]) => {
    setVisibleModalRows(items as Kpm[]);
  }, []);

  async function addGroup() {
    const cleanName = name.trim();
    if (!cleanName) {
      setInfoModal({ title: "Nama Kelompok Belum Diisi", message: "Isi nama kelompok terlebih dahulu sebelum klik tombol Buat.", tone: "warning" });
      return;
    }
    const res = await fetch("/api/kelompok", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cleanName, year: activePeriod.year, stage: activePeriod.stage })
    });
    const json = await res.json();
    if (!res.ok) {
      setInfoModal({ title: "Gagal Membuat Kelompok", message: json.message ?? "Gagal membuat kelompok.", tone: "danger" });
      return;
    }
    const newGroup: GroupSummary = { id: json.id, name: cleanName, year: activePeriod.year, stage: activePeriod.stage, pendampingId: 0, pendamping: "", kecamatan: kecamatanOptions[0] ?? "", memberCount: 0, memberIds: [], memberNiks: [] };
    setLocalGroups((list) => [newGroup, ...list]);
    setActive(json.id);
    setName("");
    setInfoModal({ title: "Kelompok Berhasil Dibuat", message: `Kelompok ${cleanName} berhasil ditambahkan.`, tone: "success" });
    router.refresh();
  }

  function openMappingModal(group: GroupSummary) {
    setActive(group.id);
    setSelectedIds([]);
    setConfirmBatch(false);
    setShowKpmModal(true);
  }

  function openGroupModal(group: GroupSummary) {
    setActive(group.id);
    setShowGroupModal(true);
  }

  function toggleSelected(id: number, checked: boolean) {
    setSelectedIds((list) => checked ? [...new Set([...list, id])] : list.filter((item) => item !== id));
  }

  function toggleVisibleSelected(checked: boolean) {
    setSelectedIds((list) => {
      if (checked) return [...new Set([...list, ...visibleModalIds])];
      return list.filter((id) => !visibleModalIds.includes(id));
    });
  }

  async function applyBatchMapping() {
    if (!current || selectedRows.length === 0) return;
    setSubmitting(true);
    const targets = selectedRows;
    try {
      const res = await fetch(`/api/kelompok/${current.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checked: true,
          items: targets.map((row) => ({ kpmId: row.id, kpmNik: row.nik }))
        })
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Gagal mapping KPM");
      setLocalGroups((list) => list.map((group) => {
        const isCurrent = group.id === current.id;
        const targetNiks = targets.map((row) => row.nik);
        const targetIds = targets.map((row) => row.id);
        let memberIds = group.memberIds.filter((id) => !targetIds.includes(id));
        let memberNiks = group.memberNiks.filter((nik) => !targetNiks.includes(nik));
        if (isCurrent) {
          memberIds = [...new Set([...memberIds, ...targetIds])];
          memberNiks = [...new Set([...memberNiks, ...targetNiks])];
        }
        return { ...group, memberIds, memberNiks, memberCount: memberNiks.length };
      }));
      setSelectedIds([]);
      setConfirmBatch(false);
      setShowKpmModal(false);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal mapping KPM");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function removeMember() {
    if (!current || !removeTarget) return;
    const target = removeTarget;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/kelompok/${current.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpmId: target.id, kpmNik: target.nik, checked: false })
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Gagal mengeluarkan KPM");
      setLocalGroups((list) => list.map((group) => {
        if (group.id !== current.id) return group;
        const memberIds = group.memberIds.filter((id) => id !== target.id);
        const memberNiks = group.memberNiks.filter((nik) => nik !== target.nik);
        return { ...group, memberIds, memberNiks, memberCount: memberNiks.length };
      }));
      setRemoveTarget(null);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal mengeluarkan KPM");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteGroup() {
    if (!deleteGroupTarget) return;
    const target = deleteGroupTarget;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/kelompok/${target.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message ?? "Gagal menghapus kelompok");
      const next = localGroups.filter((group) => group.id !== target.id);
      setLocalGroups(next);
      if (active === target.id) setActive(next[0]?.id ?? 0);
      setDeleteGroupTarget(null);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal menghapus kelompok");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function syncActiveGroups() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await fetch("/api/kelompok/sync-active", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Gagal sinkronisasi kelompok");
      setSyncMessage(`Sinkron selesai: ${json.matched ?? 0} KPM cocok, ${json.missing ?? 0} tidak ditemukan di periode aktif.`);
      router.refresh();
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Gagal sinkronisasi kelompok");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-white p-3 shadow-soft sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-2 sm:flex">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kelompok baru" className="h-10 min-w-0 rounded-lg border border-border px-3 text-sm" />
            <button onClick={addGroup} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Buat</button>
            <button onClick={syncActiveGroups} disabled={syncing} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sinkron
            </button>
            <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="h-4 w-4 accent-primary" />
              Tampilkan Arsip
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-primary/10 px-4 py-3">
              <p className="text-xs font-semibold text-primary">Jumlah Kelompok</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{localGroups.length}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-700">KPM Masuk Kelompok</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{groupedKpmCount}</p>
            </div>
            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700">KPM Belum Masuk</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{ungroupedKpmCount}</p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Kecamatan tugas: <span className="font-bold text-slate-900">{kecamatanOptions.join(", ") || "-"}</span> - Periode aktif: <span className="font-bold text-slate-900">Tahun {activePeriod.year} Tahap {activePeriod.stage}</span></p>
        {syncMessage ? <p className="mt-3 rounded-xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">{syncMessage}</p> : null}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Rekap Kelompok Saya</h2>
        <DataTable rows={visibleGroups as any[]} filename="rekap-kelompok-saya" searchPlaceholder="Search Nama saja" columns={[
          { key: "name", header: "Nama Kelompok", render: (row: GroupSummary) => <button onClick={() => openGroupModal(row)} className="font-semibold text-primary underline-offset-2 hover:underline">{row.name}</button> },
          { key: "memberCount", header: "Jumlah KPM" },
          { key: "year", header: "Tahun" },
          { key: "stage", header: "Tahap" },
          { key: "archived", header: "Status", render: (row: GroupSummary) => row.archived ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">Arsip</span> : <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Aktif</span> },
          { key: "aksi", header: "Aksi", render: (row: GroupSummary) => <button onClick={() => setDeleteGroupTarget(row)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-50 px-3 text-xs font-semibold text-rose-700"><Trash2 className="h-3.5 w-3.5" /> Hapus Kelompok</button> }
        ] as any[]} />
      </section>

      {showGroupModal && current ? (
        <div className="fixed inset-0 z-[500] overflow-y-auto bg-slate-950/40 p-3 sm:p-4">
          <div className="mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">KPM di Kelompok {current.name}</h3>
                <p className="text-sm text-muted-foreground">{groupMembers.length} KPM sudah masuk kelompok ini.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openMappingModal(current)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Tambah KPM</button>
                <button onClick={() => setShowGroupModal(false)} className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-white hover:bg-slate-50"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <DataTable rows={groupMembers as any[]} filename="anggota-kelompok" columns={[
                { key: "nama", header: "Nama Penerima" },
                { key: "nik", header: "NIK", render: (row: Kpm) => <MaskedNik nik={row.nik} /> },
                { key: "noKk", header: "No KK" },
                { key: "alamat", header: "Alamat", render: (row: Kpm) => formatKpmAddress(row) },
                { key: "rt", header: "RT" },
                { key: "rw", header: "RW" },
                { key: "kelurahan", header: "Desa" },
                { key: "kecamatan", header: "Kecamatan" },
                { key: "aksi", header: "Aksi", render: (row: Kpm) => <button onClick={() => setRemoveTarget(row)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-50 px-3 text-xs font-semibold text-rose-700"><Trash2 className="h-3.5 w-3.5" /> Hapus</button> }
              ] as any[]} />
            </div>
          </div>
        </div>
      ) : null}

      {showKpmModal && current ? (
        <div className="fixed inset-0 z-[510] overflow-y-auto bg-slate-950/40 p-3 sm:p-4">
          <div className="mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Tambah KPM ke {current.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedIds.length} KPM dipilih</p>
              </div>
              <button onClick={() => setShowKpmModal(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-wrap items-end gap-3 border-b border-border p-3 sm:p-4 [&>label]:w-full [&>label]:sm:w-auto [&_select]:w-full">
              <label className="text-sm font-semibold">
                Kecamatan
                <select value={modalKecamatan} disabled onChange={(e) => { setModalKecamatan(e.target.value); setModalDesa("SEMUA"); }} className="mt-1 block h-10 rounded-lg border border-border bg-slate-100 px-3 text-slate-700">
                  {kecamatanOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Desa
                <select value={modalDesa} disabled={modalKecamatan === "SEMUA"} onChange={(e) => setModalDesa(e.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3 disabled:bg-slate-100">
                  <option>SEMUA</option>
                  {desaOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Status Kelompok
                <select value={modalMappingStatus} onChange={(e) => setModalMappingStatus(e.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
                  <option value="SEMUA">Semua</option>
                  <option value="BELUM">Belum Mapping</option>
                  <option value="SUDAH">Sudah Mapping</option>
                </select>
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <DataTable rows={modalRows as any[]} filename="kpm-dampingan" onVisibleRowsChange={handleVisibleModalRowsChange} columns={[
                { key: "nama", header: (
                  <label className="flex min-w-[220px] items-center gap-2">
                    <input type="checkbox" checked={allVisibleSelected} onChange={(e) => toggleVisibleSelected(e.target.checked)} />
                    <span>Nama Penerima</span>
                  </label>
                ), render: (row: Kpm) => (
                  <label className="flex min-w-[220px] items-center gap-2">
                    <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={(e) => toggleSelected(row.id, e.target.checked)} />
                    <span className="font-semibold text-slate-900">{row.nama}</span>
                  </label>
                ) },
                { key: "nik", header: "NIK", render: (row: Kpm) => <MaskedNik nik={row.nik} /> },
                { key: "noKk", header: "No KK" },
                { key: "alamat", header: "Alamat", render: (row: Kpm) => formatKpmAddress(row) },
                { key: "rt", header: "RT" },
                { key: "rw", header: "RW" },
                { key: "kelurahan", header: "Desa" },
                { key: "kecamatan", header: "Kecamatan" },
                { key: "statusKelompok", header: "Status Kelompok", render: (row: Kpm) => {
                  const owner = localGroups.find((group) => isKpmInGroup(row, group));
                  if (!owner) return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Belum masuk</span>;
                  if (owner.id === current.id) return <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Sudah di kelompok ini</span>;
                  return <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">{`Di ${owner.name}`}</span>;
                } }
              ] as any[]} />
            </div>
            <div className="grid gap-2 border-t border-border p-3 sm:flex sm:justify-end sm:p-4">
              <button onClick={() => setShowKpmModal(false)} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold">Tutup</button>
              <button disabled={selectedIds.length === 0} onClick={() => setConfirmBatch(true)} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">Mapping Kelompok</button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmBatch && current ? (
        <ConfirmModal
          title="Konfirmasi Mapping"
          message={`Mapping ${selectedRows.length} KPM ke kelompok ${current.name}? Jika ada KPM yang sudah masuk kelompok lain, data akan dipindahkan ke kelompok ini.`}
          loading={submitting}
          onCancel={() => setConfirmBatch(false)}
          onConfirm={applyBatchMapping}
        />
      ) : null}

      {removeTarget && current ? (
        <ConfirmModal
          title="Keluarkan KPM?"
          message={`Keluarkan ${removeTarget.nama} dari kelompok ${current.name}? Setelah dikeluarkan, KPM belum masuk kelompok.`}
          loading={submitting}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={removeMember}
        />
      ) : null}

      {deleteGroupTarget ? (
        <ConfirmModal
          title="Hapus Kelompok?"
          message={`Hapus kelompok ${deleteGroupTarget.name}? Semua KPM di kelompok ini akan dikeluarkan dan menjadi belum masuk kelompok.`}
          loading={submitting}
          onCancel={() => setDeleteGroupTarget(null)}
          onConfirm={deleteGroup}
        />
      ) : null}
      {infoModal ? (
        <InfoModal
          title={infoModal.title}
          message={infoModal.message}
          tone={infoModal.tone ?? "success"}
          onClose={() => setInfoModal(null)}
        />
      ) : null}
    </div>
  );
}

function isKpmInGroup(row: Kpm, group: GroupSummary) {
  return group.memberIds.includes(row.id) || group.memberNiks.some((nik) => normalizeNik(nik) === normalizeNik(row.nik));
}

function ConfirmModal({ title, message, loading, onCancel, onConfirm }: { title: string; message: string; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[520] grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button disabled={loading} onClick={onCancel} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-slate-700 disabled:opacity-60">Batal</button>
          <button disabled={loading} onClick={onConfirm} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-75">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Memproses...</> : "Ya, lanjutkan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoModal({ title, message, tone, onClose }: { title: string; message: string; tone: "success" | "warning" | "danger"; onClose: () => void }) {
  const toneClass = {
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700"
  }[tone];

  return (
    <div className="fixed inset-0 z-[530] grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneClass}`}>
            {tone === "success" ? <UserCheck className="h-5 w-5" /> : <AlertIcon />}
          </div>
          <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white">Oke</button>
        </div>
      </div>
    </div>
  );
}

function AlertIcon() {
  return <span className="text-lg font-black leading-none">!</span>;
}

function sameText(left: string, right: string) {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

function normalizeNik(value: string) {
  return value.trim();
}

function uniqueStrings(values: string[]) {
  const uniqueValues = new Map<string, string>();

  for (const value of values) {
    const cleanValue = value.trim();
    const normalizedValue = cleanValue.toLocaleUpperCase("id-ID");
    if (cleanValue && !uniqueValues.has(normalizedValue)) {
      uniqueValues.set(normalizedValue, cleanValue);
    }
  }

  return [...uniqueValues.values()].sort((a, b) => a.localeCompare(b, "id-ID"));
}

function formatKpmAddress(row: Kpm) {
  return row.alamatFc || "-";
}
