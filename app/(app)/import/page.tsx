import { PageHeader } from "@/components/app-shell";
import { ImportCenterClient } from "@/components/import-center-client";
import { getActivePeriod, getDistrictOptions, getImportBatchLogs } from "@/lib/data";

export default async function ImportPage() {
  const [districts, logs, activePeriod] = await Promise.all([getDistrictOptions("3509"), getImportBatchLogs(), getActivePeriod()]);
  return (
    <>
      <PageHeader title="Import Center" description="Unggah Excel Final Closing per tahun, tahap, dan kecamatan. Satu tahap dapat diimport lebih dari satu kali." />
      <ImportCenterClient districts={districts} logs={logs} activePeriod={activePeriod} />
    </>
  );
}
