import { redirect } from "next/navigation";
import { Clock3, Settings } from "lucide-react";
import { getOptionalSession } from "@/lib/auth";
import { getAppName } from "@/lib/data";
import { getMaintenanceSettings } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const [settings, user, appName] = await Promise.all([getMaintenanceSettings(), getOptionalSession(), getAppName()]);
  if (!settings.enabled) redirect(user ? "/dashboard" : "/login");
  if (user?.role === "ADMIN") redirect("/server-monitor");

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <section className="w-full max-w-lg rounded-lg border border-border bg-white p-6 text-center shadow-2xl sm:p-8">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
          <Settings className="h-7 w-7" />
        </div>
        <p className="mt-5 text-sm font-bold text-primary">{appName}</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Sistem Sedang Dalam Pemeliharaan</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{settings.message}</p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 ring-1 ring-border">
          <Clock3 className="h-4 w-4" /> Silakan coba kembali beberapa saat lagi
        </div>
      </section>
    </main>
  );
}
