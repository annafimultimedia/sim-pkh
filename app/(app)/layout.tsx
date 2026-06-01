import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { getActivePeriod } from "@/lib/data";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  const activePeriod = await getActivePeriod();
  return <AppShell user={user} activePeriod={activePeriod}>{children}</AppShell>;
}
