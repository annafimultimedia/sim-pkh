"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Printer } from "lucide-react";
import { ActivePeriod, GroupSummary, Kpm, Pendamping, SessionUser } from "@/lib/types";

type GroupMeta = GroupSummary & {
  members: Kpm[];
  desa: string;
};

export function AbsensiClient({ rows, groups, pendamping: pendampingList, user, activePeriod }: { rows: Kpm[]; groups: GroupSummary[]; pendamping: Pendamping[]; user: SessionUser; activePeriod: ActivePeriod }) {
  const activeRows = useMemo(() => uniqueKpmByNik(rows.filter((row) => row.tahun === activePeriod.year && row.tahap === activePeriod.stage)), [activePeriod.stage, activePeriod.year, rows]);
  const groupMetas = useMemo(() => groups.map((group) => {
    const members = activeRows
      .filter((row) => group.memberIds.includes(row.id) || group.memberNiks.includes(row.nik))
      .sort((a, b) => a.nama.localeCompare(b.nama));
    const desaList = uniqueSorted(members.map((row) => row.kelurahan));
    return {
      ...group,
      members,
      desa: desaList.length === 0 ? "-" : desaList.length === 1 ? desaList[0] : desaList.join(", ")
    };
  }), [activeRows, groups]);

  const [kecamatan, setKecamatan] = useState(user.role === "PENDAMPING" ? (user.district || groupMetas[0]?.kecamatan || "SEMUA") : "SEMUA");
  const [pendampingFilter, setPendampingFilter] = useState("SEMUA");
  const [desa, setDesa] = useState("SEMUA");
  const [groupId, setGroupId] = useState(groupMetas[0]?.id ?? 0);

  const kecamatanOptions = useMemo(() => uniqueSorted(groupMetas.map((group) => group.kecamatan)), [groupMetas]);
  const pendampingOptions = useMemo(() => uniqueSorted(groupMetas
    .filter((group) => kecamatan === "SEMUA" || sameText(group.kecamatan, kecamatan))
    .map((group) => group.pendamping)), [groupMetas, kecamatan]);
  const desaOptions = useMemo(() => uniqueSorted(groupMetas.flatMap((group) => group.members.map((member) => member.kelurahan))), [groupMetas]);

  const filteredGroups = useMemo(() => {
    return groupMetas.filter((group) => {
      const inKecamatan = kecamatan === "SEMUA" || sameText(group.kecamatan, kecamatan);
      const inPendamping = pendampingFilter === "SEMUA" || sameText(group.pendamping, pendampingFilter);
      const inDesa = desa === "SEMUA" || group.members.some((member) => sameText(member.kelurahan, desa));
      return inKecamatan && inPendamping && inDesa;
    });
  }, [desa, groupMetas, kecamatan, pendampingFilter]);

  const selectedGroup = filteredGroups.find((group) => group.id === groupId) ?? filteredGroups[0];
  const members = selectedGroup?.members ?? [];
  const selectedDesa = selectedGroup?.desa ?? "-";
  const selectedKecamatan = selectedGroup?.kecamatan || user.district || "-";
  const selectedPendamping = selectedGroup?.pendamping || user.name || "-";
  const selectedPendampingProfile = selectedGroup
    ? pendampingList.find((item) => item.id === selectedGroup.pendampingId) ?? pendampingList.find((item) => sameText(item.nama, selectedPendamping))
    : undefined;
  const selectedNip = user.role === "PENDAMPING" ? user.nip || selectedPendampingProfile?.nip : selectedPendampingProfile?.nip;
  const pdfTitle = selectedGroup ? `Absensi ${selectedKecamatan}_${selectedGroup.name}` : "Absensi P2K2";

  function printDocument(title = pdfTitle) {
    const previousTitle = document.title;
    document.title = sanitizeFilename(title);
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 500);
  }

  function changeFilter(next: { kecamatan?: string; pendamping?: string; desa?: string }) {
    const nextKecamatan = next.kecamatan ?? kecamatan;
    let nextPendamping = next.pendamping ?? pendampingFilter;
    const nextDesa = next.desa ?? desa;
    const groupsInKecamatan = groupMetas.filter((group) => nextKecamatan === "SEMUA" || sameText(group.kecamatan, nextKecamatan));
    if (next.kecamatan !== undefined && next.pendamping === undefined) {
      nextPendamping = "SEMUA";
    } else if (nextPendamping !== "SEMUA" && !groupsInKecamatan.some((group) => sameText(group.pendamping, nextPendamping))) {
      nextPendamping = "SEMUA";
    }
    const nextGroups = groupMetas.filter((group) => {
      const inKecamatan = nextKecamatan === "SEMUA" || sameText(group.kecamatan, nextKecamatan);
      const inPendamping = nextPendamping === "SEMUA" || sameText(group.pendamping, nextPendamping);
      const inDesa = nextDesa === "SEMUA" || group.members.some((member) => sameText(member.kelurahan, nextDesa));
      return inKecamatan && inPendamping && inDesa;
    });
    setKecamatan(nextKecamatan);
    setPendampingFilter(nextPendamping);
    setDesa(nextDesa);
    setGroupId(nextGroups[0]?.id ?? 0);
  }

  return (
    <div className="space-y-5">
      <section className="no-print rounded-2xl border border-border bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">
            Kecamatan
            <select
              value={kecamatan}
              disabled={user.role === "PENDAMPING"}
              onChange={(event) => changeFilter({ kecamatan: event.target.value })}
              className="mt-1 block h-10 min-w-44 rounded-lg border border-border bg-white px-3 disabled:bg-slate-100 disabled:text-slate-600"
            >
              {user.role === "ADMIN" ? <option value="SEMUA">SEMUA KECAMATAN</option> : null}
              {kecamatanOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {user.role === "ADMIN" ? (
            <label className="text-sm font-semibold">
              Pendamping
              <select value={pendampingFilter} onChange={(event) => changeFilter({ pendamping: event.target.value })} className="mt-1 block h-10 min-w-56 rounded-lg border border-border bg-white px-3">
                <option value="SEMUA">SEMUA PENDAMPING</option>
                {pendampingOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          ) : (
            <label className="text-sm font-semibold">
              Desa Tugas
              <select value={desa} onChange={(event) => changeFilter({ desa: event.target.value })} className="mt-1 block h-10 min-w-48 rounded-lg border border-border bg-white px-3">
                <option value="SEMUA">SEMUA DESA</option>
                {desaOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          )}
          <label className="min-w-64 flex-1 text-sm font-semibold">
            Nama Kelompok
            <select value={selectedGroup?.id ?? 0} onChange={(event) => setGroupId(Number(event.target.value))} className="mt-1 block h-10 w-full rounded-lg border border-border bg-white px-3">
              {filteredGroups.length === 0 ? <option value={0}>Kelompok tidak tersedia</option> : null}
              {filteredGroups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.memberCount} KPM)</option>)}
            </select>
          </label>
          <button onClick={() => printDocument()} disabled={!selectedGroup} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">
            <Printer className="h-4 w-4" /> Cetak
          </button>
          <button onClick={() => printDocument()} disabled={!selectedGroup} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">
            <Download className="h-4 w-4" /> Simpan PDF
          </button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Preview menampilkan <span className="font-bold text-slate-900">{members.length}</span> KPM dari kelompok terpilih pada Tahun {activePeriod.year} Tahap {activePeriod.stage}.
        </p>
      </section>

      <section className="print-sheet mx-auto min-h-[297mm] w-[210mm] max-w-full rounded-xl border border-border bg-white p-4 shadow-soft">
        {selectedGroup ? (
          <>
            <div className="text-center">
              <h1 className="text-xl font-bold uppercase">Daftar Hadir Pertemuan P2K2</h1>
              <p className="font-semibold">KPM Program Keluarga Harapan (PKH)</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] font-semibold">
              <InfoLine label="Nama Kelompok" value={selectedGroup.name} />
              <InfoLine label="Nama Pendamping" value={selectedPendamping} alignRight />
              <InfoLine label="Nama Desa" value={selectedDesa} />
              <InfoLine label="Nama Kecamatan" value={selectedKecamatan} />
            </div>
            <table className="mt-3 w-full table-fixed border-collapse text-[9px] leading-[1.08]">
              <colgroup>
                <col className="w-8" />
                <col className="w-[18%]" />
                <col className="w-[14%]" />
                <col />
                <col className="w-8" />
                <col className="w-8" />
                <col className="w-[15%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-100">
                  {["No", "Nama", "NIK", "Alamat", "RT", "RW", "Tanda Tangan", "Ket"].map((heading) => <th key={heading} className="whitespace-nowrap border border-slate-500 px-1 py-0.5 text-center font-bold">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="border border-slate-500 p-4 text-center text-slate-500">Belum ada KPM di kelompok ini.</td>
                  </tr>
                ) : members.map((row, index) => (
                  <tr key={`${row.id}-${row.nik}`}>
                    <td className="whitespace-nowrap border border-slate-500 px-1 py-0.5 text-center align-middle">{index + 1}</td>
                    <td className="truncate whitespace-nowrap border border-slate-500 px-1 py-0.5 align-middle font-semibold">{row.nama}</td>
                    <td className="whitespace-nowrap border border-slate-500 px-1 py-0.5 align-middle">{row.nik}</td>
                    <td className="truncate whitespace-nowrap border border-slate-500 px-1 py-0.5 align-middle">{formatKpmAddress(row)}</td>
                    <td className="whitespace-nowrap border border-slate-500 px-1 py-0.5 text-center align-middle">{row.rt}</td>
                    <td className="whitespace-nowrap border border-slate-500 px-1 py-0.5 text-center align-middle">{row.rw}</td>
                    <td className="h-7 whitespace-nowrap border border-slate-500 px-1 py-0.5 align-top">
                      <span className={`block w-1/2 ${index % 2 === 0 ? "text-left" : "ml-auto text-left"}`}>{index + 1}.</span>
                    </td>
                    <td className="whitespace-nowrap border border-slate-500 px-1 py-0.5 align-middle"></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-6 ml-auto w-72 text-center text-xs">
              <p>{selectedKecamatan}, ........................................ 2026</p>
              <p className="mt-1">Mengetahui, Pendamping PKH</p>
              <div className="h-16" />
              <p className="break-words font-bold underline">{selectedPendamping}</p>
              <p>NIP. {selectedNip || "-"}</p>
            </div>
          </>
        ) : (
          <div className="grid min-h-[520px] place-items-center text-center text-slate-500">
            <div>
              <FileText className="mx-auto h-10 w-10" />
              <p className="mt-3 font-semibold">Belum ada kelompok yang bisa dipreview.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function InfoLine({ label, value, alignRight = false }: { label: string; value: string; alignRight?: boolean }) {
  return (
    <div className={`grid min-w-0 grid-cols-[130px_minmax(0,1fr)] gap-2 ${alignRight ? "print-info-right" : ""}`}>
      <span>{label}</span>
      <span className="min-w-0 break-words">: {value || "-"}</span>
    </div>
  );
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function uniqueKpmByNik(rows: Kpm[]) {
  const map = new Map<string, Kpm>();
  for (const row of rows) {
    if (!map.has(row.nik)) map.set(row.nik, row);
  }
  return [...map.values()];
}

function formatKpmAddress(row: Kpm) {
  return row.alamatFc || "-";
}

function sameText(left: string, right: string) {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}
