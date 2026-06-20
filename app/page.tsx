import { redirect } from "next/navigation";
import { getMaintenanceSettings } from "@/lib/maintenance";

export default async function Home() {
  const maintenance = await getMaintenanceSettings();
  if (maintenance.enabled) redirect("/maintenance");
  redirect("/dashboard");
}
