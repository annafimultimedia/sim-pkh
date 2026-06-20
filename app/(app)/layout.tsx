import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { getActivePeriod, getAppName, getAppNotifications } from "@/lib/data";
import { getPendampingMenuAccess } from "@/lib/menu-access";
import { getMaintenanceSettings } from "@/lib/maintenance";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  const maintenance = await getMaintenanceSettings();
  if (maintenance.enabled && user.role !== "ADMIN") redirect("/maintenance");
  const [activePeriod, appName, allowedMenuKeys] = await Promise.all([
    getActivePeriod(),
    getAppName(),
    user.role === "PENDAMPING" ? getPendampingMenuAccess() : Promise.resolve([])
  ]);
  const notifications = await getAppNotifications(user, activePeriod);
  return <AppShell user={user} activePeriod={activePeriod} appName={appName} allowedMenuKeys={allowedMenuKeys} notifications={notifications}>{children}</AppShell>;
}
