import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { ServerMonitorClient } from "@/components/server-monitor-client";
import { getSession } from "@/lib/auth";

export default async function ServerMonitorPage() {
  const user = await getSession();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return (
    <>
      <PageHeader title="Pantauan Server" description="Pantau kondisi PC server, database, kapasitas penyimpanan, backup, dan koneksi aplikasi." />
      <ServerMonitorClient />
    </>
  );
}
