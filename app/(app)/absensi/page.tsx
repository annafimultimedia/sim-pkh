import { PageHeader } from "@/components/app-shell";
import { AbsensiClient } from "@/components/absensi-client";
import { getSession } from "@/lib/auth";
import { getActivePeriod, getKelompokSummaries, getKpmForKelompok, getPendampingList } from "@/lib/data";
import { requireMenuAccess } from "@/lib/menu-access";

export default async function AbsensiPage() {
  const user = await getSession();
  await requireMenuAccess(user, "absensi");
  const [rows, groups, pendamping, activePeriod] = await Promise.all([getKpmForKelompok(user), getKelompokSummaries(user), getPendampingList(), getActivePeriod()]);

  return (
    <>
      <PageHeader title="Cetak Absensi P2K2" description="Preview lembar kehadiran per kelompok sebelum dicetak atau disimpan sebagai PDF." />
      <AbsensiClient rows={rows} groups={groups} pendamping={pendamping} user={user} activePeriod={activePeriod} />
    </>
  );
}
