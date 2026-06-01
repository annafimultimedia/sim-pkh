import { PageHeader } from "@/components/app-shell";
import { KelompokClient } from "@/components/kelompok-client";
import { getSession } from "@/lib/auth";
import { getActivePeriod, getDistrictOptions, getKelompokSummaries, getKpmForKelompok, getKpmForUser } from "@/lib/data";

export default async function KelompokPage() {
  const user = await getSession();
  const [kelompokRows, allRows, groups, districts, activePeriod] = await Promise.all([getKpmForKelompok(user), getKpmForUser(user), getKelompokSummaries(user, { includeArchived: true }), getDistrictOptions("3509"), getActivePeriod()]);
  const rows = user.role === "ADMIN" ? allRows : kelompokRows;
  return (
    <>
      <PageHeader title="Manajemen Kelompok" description="Mapping KPM dampingan ke kelompok kecil berdasarkan kedekatan lokasi/dusun." />
      <KelompokClient kpm={rows} groups={groups} user={user} districts={districts} activePeriod={activePeriod} />
    </>
  );
}
