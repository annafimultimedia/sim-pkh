import { PageHeader } from "@/components/app-shell";
import { SuratClient } from "@/components/surat-client";
import { getSession } from "@/lib/auth";
import { getSuratArchiveRows } from "@/lib/data";

export default async function SuratPage() {
  const user = await getSession();
  const rows = await getSuratArchiveRows();

  return (
    <>
      <PageHeader title="Surat-surat" description="Kumpulan arsip surat masuk beserta lampiran pendukung." />
      <SuratClient rows={rows} user={user} />
    </>
  );
}
