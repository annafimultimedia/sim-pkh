import { PageHeader } from "@/components/app-shell";
import { RekapP2k2Client } from "@/components/rekap-p2k2-client";
import { getSession } from "@/lib/auth";
import { getActivePeriod, getP2k2AttendanceRows } from "@/lib/data";

export default async function RekapP2k2Page() {
  const user = await getSession();
  const [rows, activePeriod] = await Promise.all([getP2k2AttendanceRows(user), getActivePeriod()]);

  return (
    <>
      <PageHeader title="Rekap Kehadiran P2K2" description="Rekap hadir dan tidak hadir KPM berdasarkan laporan P2K2 yang sudah disimpan." />
      <RekapP2k2Client user={user} rows={rows} activePeriod={activePeriod} />
    </>
  );
}
