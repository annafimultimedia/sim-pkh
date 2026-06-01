import { PageHeader } from "@/components/app-shell";
import { FinalClosingClient } from "@/components/final-closing-client";
import { getSession } from "@/lib/auth";
import { getActivePeriod, getDistrictOptions, getKpmForUser, getPendampingList, getVillageOptions } from "@/lib/data";

export default async function FinalClosingPage() {
  const user = await getSession();
  const [rows, pendamping, districts, villages, activePeriod] = await Promise.all([getKpmForUser(user), getPendampingList(), getDistrictOptions("3509"), getVillageOptions("3509"), getActivePeriod()]);
  return (
    <>
      <PageHeader title="Data Final Closing" description="Tabel besar KPM dengan filter kolom, search Nama/NIK/No KK, export Excel/PDF, dan mapping pendamping." />
      <FinalClosingClient rows={rows} pendamping={pendamping} user={user} districts={districts} villages={villages} activePeriod={activePeriod} />
    </>
  );
}
