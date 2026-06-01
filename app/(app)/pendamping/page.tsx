import { PageHeader } from "@/components/app-shell";
import { PendampingTable } from "@/components/pendamping-table";
import { getDistrictOptions, getPendampingList, getRegencyOptions } from "@/lib/data";

export default async function PendampingPage() {
  const pendampingList = await getPendampingList();
  const districts = await getDistrictOptions("3509");
  const regencies = await getRegencyOptions("35");
  return (
    <>
      <PageHeader title="Data Pendamping" description="Daftar pendamping PKH beserta NIK, NIP, dan kecamatan tugas." />
      <PendampingTable rows={pendampingList} districts={districts} regencies={regencies} defaultRegencyId="3509" />
    </>
  );
}
