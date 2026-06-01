import { PageHeader } from "@/components/app-shell";
import { RekonClient } from "@/components/rekon-client";
import { getSession } from "@/lib/auth";
import { getActivePeriod, getRekonRows } from "@/lib/data";

export default async function RekonPage() {
  const user = await getSession();
  const activePeriod = await getActivePeriod();
  const rows = await getRekonRows(user, activePeriod);

  return (
    <>
      <PageHeader title="Rekon Penyaluran" description="Cek status transaksi bantuan KPM yang sudah masuk kelompok pada periode aktif." />
      <RekonClient user={user} rows={rows} activePeriod={activePeriod} />
    </>
  );
}
