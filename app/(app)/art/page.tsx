import { PageHeader } from "@/components/app-shell";
import { ArtClient } from "@/components/art-client";
import { getSession } from "@/lib/auth";
import { getArtForUser, getDistrictOptions, getVillageOptions } from "@/lib/data";
import { requireMenuAccess } from "@/lib/menu-access";

export default async function ArtPage() {
  const user = await getSession();
  await requireMenuAccess(user, "art");
  const [rows, districts, villages] = await Promise.all([getArtForUser(user), getDistrictOptions("3509"), getVillageOptions("3509")]);
  return (
    <>
      <PageHeader title="Data ART" description="Import dan analisis anggota rumah tangga, otomatis dicocokkan dengan Final Closing berdasarkan No KK." />
      <ArtClient rows={rows as any[]} user={user} districts={districts} villages={villages} />
    </>
  );
}
