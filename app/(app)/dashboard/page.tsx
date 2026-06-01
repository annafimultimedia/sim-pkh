import { PageHeader } from "@/components/app-shell";
import { DashboardClient } from "@/components/dashboard-client";
import { getSession } from "@/lib/auth";
import { buildDashboardData, getActivePeriod, getDeadlineTasks, getDistrictOptions, getKelompokSummaries, getKpmForUser, getOnlineUsers, getP2k2Reports, getPendampingProfileForUser, getRekonRows } from "@/lib/data";

export default async function DashboardPage() {
  const user = await getSession();
  const activePeriod = await getActivePeriod();
  const scoped = await getKpmForUser(user);
  const groups = await getKelompokSummaries(user);
  const onlineUsers = user.role === "ADMIN" ? await getOnlineUsers() : [];
  const tasks = await getDeadlineTasks(user);
  const districts = user.role === "ADMIN" ? await getDistrictOptions("3509") : [];
  const currentMonth = new Date().getMonth() + 1;
  const activeRows = scoped.filter((row) => row.tahun === activePeriod.year && row.tahap === activePeriod.stage);
  const allData = buildDashboardData(scoped, user);
  const activeData = buildDashboardData(activeRows, user);
  const profile = user.role === "PENDAMPING" ? await getPendampingProfileForUser(user.id) : null;
  const kpmDampingan = profile ? activeRows.filter((row) => row.pendampingId === profile.id).length : activeData.mapped;
  const activeGroups = groups.filter((group) => group.year === activePeriod.year && group.stage === activePeriod.stage);
  const p2k2Reports = await getP2k2Reports(user, activePeriod.year, currentMonth);
  const rekonRows = await getRekonRows(user, activePeriod);
  const p2k2ReportedGroupIds = new Set(p2k2Reports.map((report) => Number(report.groupId)));
  const data = {
    ...activeData,
    mapped: user.role === "PENDAMPING" ? kpmDampingan : activeData.mapped,
    mappedLabel: user.role === "PENDAMPING" ? "KPM Dampingan" : "KPM Termapping",
    byStage: allData.byStage,
    groupCount: activeGroups.length,
    activePeriod,
    alerts: {
      p2k2Month: currentMonth,
      p2k2Terkirim: p2k2Reports.filter((report) => report.status === "TERKIRIM").length,
      p2k2Draft: p2k2Reports.filter((report) => report.status === "DRAFT").length,
      p2k2BelumDibuat: activeGroups.filter((group) => !p2k2ReportedGroupIds.has(group.id)).length,
      rekonTotal: rekonRows.length,
      rekonBelumTransaksi: rekonRows.filter((row) => row.status === "BELUM_TRANSAKSI").length
    }
  };
  return (
    <>
      <PageHeader title="Dashboard" description="Ringkasan monitoring KPM, kelompok, mapping, dan alert status sesuai hak akses login." />
      <DashboardClient data={data} onlineUsers={onlineUsers} isAdmin={user.role === "ADMIN"} tasks={tasks} districts={districts} />
    </>
  );
}
