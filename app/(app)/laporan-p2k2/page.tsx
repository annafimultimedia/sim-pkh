import { PageHeader } from "@/components/app-shell";
import { LaporanP2k2Client } from "@/components/laporan-p2k2-client";
import { getSession } from "@/lib/auth";
import { getActivePeriod, getKelompokSummaries, getKpmForKelompok, getP2k2Reports } from "@/lib/data";
import { requireMenuAccess } from "@/lib/menu-access";

export default async function LaporanP2k2Page() {
  const user = await getSession();
  await requireMenuAccess(user, "laporan-p2k2");
  const now = new Date();
  const activePeriod = await getActivePeriod();
  const year = activePeriod.year;
  const month = now.getMonth() + 1;
  const [groups, kpm, reports] = await Promise.all([
    getKelompokSummaries(user, { includeArchived: true }),
    getKpmForKelompok(user),
    getP2k2Reports(user, year, month)
  ]);

  return (
    <>
      <PageHeader title="Laporan P2K2" description="Isi laporan pertemuan bulanan, kehadiran KPM, foto kegiatan, dan PDF absensi P2K2." />
      <LaporanP2k2Client user={user} groups={groups} kpm={kpm} initialReports={reports} initialYear={year} initialMonth={month} activePeriod={activePeriod} />
    </>
  );
}
