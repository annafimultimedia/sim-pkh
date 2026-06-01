import { PageHeader } from "@/components/app-shell";
import { TrackingClient } from "@/components/tracking-client";
import { getSession } from "@/lib/auth";
import { getActivePeriod, getKpmForUser } from "@/lib/data";

export default async function TrackingPage() {
  const user = await getSession();
  const [rows, activePeriod] = await Promise.all([getKpmForUser(user), getActivePeriod()]);

  return (
    <>
      <PageHeader title="Tracking & Komparasi" description="Membandingkan data Final Closing antar tahap untuk melihat KPM lama, KPM baru, KPM hilang, dan perubahan nominal." />
      <TrackingClient user={user} rows={rows} activePeriod={activePeriod} />
    </>
  );
}
