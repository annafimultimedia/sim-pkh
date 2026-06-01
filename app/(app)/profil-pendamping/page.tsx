import { PageHeader } from "@/components/app-shell";
import { ProfilPendampingClient } from "@/components/profil-pendamping-client";
import { getSession } from "@/lib/auth";
import { ensureGroupMemberNikColumn, ensureP2k2ReportTables, ensureRekonTables, getActivePeriod } from "@/lib/data";
import { query } from "@/lib/db";

type ProfileRow = {
  id: number;
  nama: string;
  nik: string;
  nip: string;
  kecamatan: string;
  kabupaten: string;
  jumlahKelompok: number;
  jumlahKpm: number;
  p2k2Terkirim: number;
  p2k2Draft: number;
  hadirP2k2: number;
  tidakHadirP2k2: number;
  rekonTotal: number;
  rekonBelumTransaksi: number;
  rekonBelumBukti: number;
};

export default async function ProfilPendampingPage() {
  const user = await getSession();
  const activePeriod = await getActivePeriod();
  const currentMonth = new Date().getMonth() + 1;
  const rows = toPlainRows(await getProfileRows(user.id, user.role, activePeriod.year, activePeriod.stage, currentMonth));
  const total = rows.reduce((acc, row) => ({
    kelompok: acc.kelompok + row.jumlahKelompok,
    kpm: acc.kpm + row.jumlahKpm,
    terkirim: acc.terkirim + row.p2k2Terkirim,
    rekonBelumBukti: acc.rekonBelumBukti + row.rekonBelumBukti
  }), { kelompok: 0, kpm: 0, terkirim: 0, rekonBelumBukti: 0 });

  return (
    <>
      <PageHeader
        title="Profil Pendamping"
        description={`Ringkasan pendamping, kelompok, KPM, P2K2 bulan ${currentMonth}, dan rekon Tahun ${activePeriod.year} Tahap ${activePeriod.stage}.`}
      />
      <section className="mb-5 grid gap-3 sm:grid-cols-4">
        <Info label="Jumlah Kelompok" value={total.kelompok} />
        <Info label="Jumlah KPM" value={total.kpm} />
        <Info label="P2K2 Terkirim" value={total.terkirim} />
        <Info label="Rekon Belum Bukti" value={total.rekonBelumBukti} tone="amber" />
      </section>
      <ProfilPendampingClient rows={rows} />
    </>
  );
}

function toPlainRows(rows: ProfileRow[]) {
  return rows.map((row) => ({
    id: Number(row.id ?? 0),
    nama: String(row.nama ?? ""),
    nik: String(row.nik ?? ""),
    nip: String(row.nip ?? ""),
    kecamatan: String(row.kecamatan ?? ""),
    kabupaten: String(row.kabupaten ?? ""),
    jumlahKelompok: Number(row.jumlahKelompok ?? 0),
    jumlahKpm: Number(row.jumlahKpm ?? 0),
    p2k2Terkirim: Number(row.p2k2Terkirim ?? 0),
    p2k2Draft: Number(row.p2k2Draft ?? 0),
    hadirP2k2: Number(row.hadirP2k2 ?? 0),
    tidakHadirP2k2: Number(row.tidakHadirP2k2 ?? 0),
    rekonTotal: Number(row.rekonTotal ?? 0),
    rekonBelumTransaksi: Number(row.rekonBelumTransaksi ?? 0),
    rekonBelumBukti: Number(row.rekonBelumBukti ?? 0)
  }));
}

function Info({ label, value, tone = "emerald" }: { label: string; value: number; tone?: "emerald" | "amber" }) {
  return (
    <div className={`rounded-2xl border border-border bg-white p-5 shadow-soft ${tone === "amber" ? "text-amber-700" : "text-emerald-700"}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value.toLocaleString("id-ID")}</p>
    </div>
  );
}

async function getProfileRows(userId: number, role: string, year: number, stage: number, month: number) {
  await ensureGroupMemberNikColumn();
  await ensureP2k2ReportTables();
  await ensureRekonTables();
  const where = role === "PENDAMPING" ? "WHERE p.user_id = ?" : "";
  const params = role === "PENDAMPING" ? [userId] : [];
  return query<ProfileRow>(
    `SELECT p.id, p.name AS nama, COALESCE(p.nik, '') AS nik, COALESCE(p.nip, '') AS nip,
            COALESCE(d.name, '') AS kecamatan, COALESCE(r.name, '') AS kabupaten,
            (SELECT COUNT(*) FROM p2k2_groups g WHERE g.pendamping_id = p.id AND g.year = ? AND g.stage = ?) AS jumlahKelompok,
            (SELECT COUNT(DISTINCT k.nik) FROM kpm_final_closing k WHERE k.pendamping_id = p.id AND k.year = ? AND k.stage = ?) AS jumlahKpm,
            (SELECT COUNT(*) FROM p2k2_reports pr WHERE pr.pendamping_id = p.id AND pr.year = ? AND pr.month = ? AND pr.status = 'TERKIRIM') AS p2k2Terkirim,
            (SELECT COUNT(*) FROM p2k2_reports pr WHERE pr.pendamping_id = p.id AND pr.year = ? AND pr.month = ? AND pr.status = 'DRAFT') AS p2k2Draft,
            (SELECT COUNT(*) FROM p2k2_report_attendance a JOIN p2k2_reports pr ON pr.id = a.report_id WHERE pr.pendamping_id = p.id AND pr.year = ? AND a.attendance_status = 'HADIR') AS hadirP2k2,
            (SELECT COUNT(*) FROM p2k2_report_attendance a JOIN p2k2_reports pr ON pr.id = a.report_id WHERE pr.pendamping_id = p.id AND pr.year = ? AND a.attendance_status = 'TIDAK_HADIR') AS tidakHadirP2k2,
            (SELECT COUNT(DISTINCT k.nik)
             FROM p2k2_group_members gm
             JOIN p2k2_groups g ON g.id = gm.group_id
             JOIN kpm_final_closing k ON (k.nik = gm.kpm_nik OR k.id = gm.kpm_id)
             WHERE g.pendamping_id = p.id AND k.pendamping_id = p.id AND k.year = ? AND k.stage = ?) AS rekonTotal,
            (SELECT COUNT(DISTINCT rk.kpm_nik) FROM rekon_transactions rk WHERE rk.pendamping_id = p.id AND rk.year = ? AND rk.stage = ? AND rk.status = 'BELUM_TRANSAKSI') AS rekonBelumTransaksi,
            GREATEST(
              (SELECT COUNT(DISTINCT k.nik)
               FROM p2k2_group_members gm
               JOIN p2k2_groups g ON g.id = gm.group_id
               JOIN kpm_final_closing k ON (k.nik = gm.kpm_nik OR k.id = gm.kpm_id)
               WHERE g.pendamping_id = p.id AND k.pendamping_id = p.id AND k.year = ? AND k.stage = ?)
              -
              (SELECT COUNT(DISTINCT rk.kpm_nik) FROM rekon_transactions rk WHERE rk.pendamping_id = p.id AND rk.year = ? AND rk.stage = ? AND rk.photo_path IS NOT NULL AND rk.photo_path <> ''),
              0
            ) AS rekonBelumBukti
     FROM pendamping_profiles p
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN reg_districts d ON d.id = p.district_id
     LEFT JOIN reg_regencies r ON r.id = p.regency_id
     ${where}
     ORDER BY d.name, p.name`,
    [
      year, stage,
      year, stage,
      year, month,
      year, month,
      year,
      year,
      year, stage,
      year, stage,
      year, stage,
      year, stage,
      ...params
    ]
  );
}
