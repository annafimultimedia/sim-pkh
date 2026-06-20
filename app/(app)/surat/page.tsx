import { PageHeader } from "@/components/app-shell";
import { SuratClient } from "@/components/surat-client";
import { getSession } from "@/lib/auth";
import { getSuratArchiveRows } from "@/lib/data";
import { requireMenuAccess } from "@/lib/menu-access";

export default async function SuratPage() {
  const user = await getSession();
  await requireMenuAccess(user, "surat");
  const rows = await getSuratArchiveRows();

  return (
    <>
      <PageHeader title="Surat-surat" description="Kumpulan arsip surat masuk beserta lampiran pendukung." />
      <SuratClient rows={rows} user={user} />
    </>
  );
}
