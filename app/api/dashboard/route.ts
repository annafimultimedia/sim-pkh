import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildDashboardData, getActivePeriod, getKelompokSummaries, getKpmForUser, getOnlineUsers } from "@/lib/data";

export async function GET() {
  const user = await getSession();
  const activePeriod = await getActivePeriod();
  const scoped = await getKpmForUser(user);
  const groups = await getKelompokSummaries(user);
  const onlineUsers = user.role === "ADMIN" ? await getOnlineUsers() : [];
  const activeRows = scoped.filter((row) => row.tahun === activePeriod.year && row.tahap === activePeriod.stage);
  const allData = buildDashboardData(scoped, user);
  const activeData = buildDashboardData(activeRows, user);
  const activeGroups = groups.filter((group) => group.year === activePeriod.year && group.stage === activePeriod.stage);
  return NextResponse.json({
    ...activeData,
    byStage: allData.byStage,
    groupCount: activeGroups.length,
    activePeriod,
    onlineUsers
  });
}
