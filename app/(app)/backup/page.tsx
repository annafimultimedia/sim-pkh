import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { BackupClient } from "@/components/backup-client";
import { getSession } from "@/lib/auth";
import { getBackupFiles, getBackupSettings, maybeRunScheduledBackup } from "@/lib/backup";

export default async function BackupPage() {
  const user = await getSession();
  if (user.role !== "ADMIN") redirect("/dashboard");
  await maybeRunScheduledBackup();
  const [settings, files] = await Promise.all([getBackupSettings(), getBackupFiles()]);
  return (
    <>
      <PageHeader title="Backup & Restore" description="Backup database SQL, restore data, dan jadwal backup otomatis harian, mingguan, atau bulanan." />
      <BackupClient initialSettings={settings} initialFiles={files} />
    </>
  );
}
