import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { VerifikasiKesehatanClient } from "@/components/verifikasi-kesehatan-client";
import { getSession } from "@/lib/auth";
import { getActivePeriod, getHealthVerificationElders } from "@/lib/data";
import { canAccessMenu } from "@/lib/menu-access";

export default async function VerifikasiKesehatanPage() {
  const user = await getSession();
  if (!(await canAccessMenu(user, "verifikasi-kesehatan"))) redirect("/dashboard");
  const [rows, activePeriod] = await Promise.all([
    getHealthVerificationElders(user),
    getActivePeriod()
  ]);

  return (
    <>
      <PageHeader
        title="Verifikasi Kesehatan"
        description="Kartu kontrol dan verifikasi bulanan komponen Ibu Hamil, Anak Usia Dini, Lansia, dan Disabilitas."
      />
      <VerifikasiKesehatanClient rows={rows} activePeriod={activePeriod} user={user} />
    </>
  );
}
