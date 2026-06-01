import { PageHeader } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { getActivityLogs } from "@/lib/data";

export default async function LogsPage() {
  const logs = await getActivityLogs();
  return (
    <>
      <PageHeader title="Log Aktivitas" description="Audit trail siapa mengunggah, mengubah, mapping, dan export data." />
      <DataTable rows={logs} filename="log-aktivitas" columns={[
        { key: "waktu", header: "Waktu" },
        { key: "user", header: "User" },
        { key: "aksi", header: "Aksi" },
        { key: "modul", header: "Modul" },
        { key: "deskripsi", header: "Deskripsi" }
      ]} />
    </>
  );
}
