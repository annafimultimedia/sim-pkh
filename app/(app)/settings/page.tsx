import { PageHeader } from "@/components/app-shell";
import { SettingsClient } from "@/components/settings-client";
import { getSession } from "@/lib/auth";
import { getActivePeriod, getAppName } from "@/lib/data";

export default async function SettingsPage() {
  const [activePeriod, user, appName] = await Promise.all([getActivePeriod(), getSession(), getAppName()]);
  return (
    <>
      <PageHeader title="Pengaturan" description={user.role === "PENDAMPING" ? "Ubah nama pendamping dan password akun." : "Pengaturan nama aplikasi, periode aktif, dan password akun."} />
      <SettingsClient activePeriod={activePeriod} appName={appName} user={user} />
    </>
  );
}
