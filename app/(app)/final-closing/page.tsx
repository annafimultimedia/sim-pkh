import { PageHeader } from "@/components/app-shell";
import { FinalClosingClient } from "@/components/final-closing-client";
import { getSession } from "@/lib/auth";
import { getActivePeriod, getDistrictOptions, getImportBatchLogs, getKpmForUser, getPendampingList, getVillageOptions } from "@/lib/data";
import { requireMenuAccess } from "@/lib/menu-access";

export default async function FinalClosingPage() {
  const user = await getSession();
  await requireMenuAccess(user, "final-closing");
  const [rows, pendamping, districts, villages, activePeriod, importLogs] = await Promise.all([getKpmForUser(user), getPendampingList(), getDistrictOptions("3509"), getVillageOptions("3509"), getActivePeriod(), getImportBatchLogs()]);
  return (
    <>
      <PageHeader title="Data Final Closing" description="Tabel besar KPM dengan filter kolom, search Nama/NIK/No KK, export Excel, dan mapping pendamping." />
      <FinalClosingClient rows={rows} pendamping={pendamping} user={user} districts={districts} villages={villages} activePeriod={activePeriod} importLogs={importLogs} />
    </>
  );
}
