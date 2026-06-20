import { PageHeader } from "@/components/app-shell";
import { RekapP2k2Client } from "@/components/rekap-p2k2-client";
import { getSession } from "@/lib/auth";
import { getActivePeriod, getKelompokSummaries, getKpmForKelompok, getP2k2AttendanceRows, getP2k2ReportRecapRows } from "@/lib/data";
import { requireMenuAccess } from "@/lib/menu-access";

export default async function RekapP2k2Page() {
  const user = await getSession();
  await requireMenuAccess(user, "rekap-p2k2");
  const activePeriod = await getActivePeriod();
  const groups = await getKelompokSummaries(user);
  const reports = await getP2k2ReportRecapRows(user);
  const attendanceRows = user.role === "PENDAMPING" ? await getP2k2AttendanceRows(user) : [];
  const kpmRows = user.role === "PENDAMPING" ? await getKpmForKelompok(user) : [];

  return (
    <>
      <PageHeader title="Rekap P2K2" description="Pantau keaktifan pendamping dan kelengkapan laporan kelompok P2K2." />
      <RekapP2k2Client user={user} groups={groups} reports={reports} attendanceRows={attendanceRows} kpmRows={kpmRows} activePeriod={activePeriod} />
    </>
  );
}
