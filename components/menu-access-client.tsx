"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import type { PendampingMenuKey } from "@/lib/menu-access";

type MenuOption = {
  key: PendampingMenuKey;
  label: string;
  group: string;
  defaultEnabled: boolean;
};

export function MenuAccessClient({ options, enabledKeys }: { options: MenuOption[]; enabledKeys: PendampingMenuKey[] }) {
  const [selected, setSelected] = useState(() => new Set<PendampingMenuKey>(enabledKeys));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const groups = useMemo(() => [...new Set(options.map((item) => item.group))], [options]);

  function toggle(key: PendampingMenuKey) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/hak-akses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuKeys: [...selected] })
      });
      const json = await response.json();
      setMessage(response.ok ? "Hak akses menu Pendamping berhasil disimpan." : json.message ?? "Gagal menyimpan hak akses.");
    } catch {
      setMessage("Tidak dapat terhubung ke server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-soft">
      <div className="flex items-start gap-3 rounded-xl bg-sky-50 p-4 text-sky-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-bold">Role Pendamping</p>
          <p className="mt-1 text-sm">Dashboard dan Pengaturan Akun selalu tersedia. Perubahan menu berlaku setelah halaman pendamping dimuat ulang.</p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {groups.map((group) => (
          <div key={group}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{group}</h2>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {options.filter((item) => item.group === group).map((item) => {
                const checked = selected.has(item.key);
                return (
                  <button key={item.key} type="button" onClick={() => toggle(item.key)} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${checked ? "border-primary bg-primary/5" : "border-border bg-white hover:bg-slate-50"}`}>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${checked ? "border-primary bg-primary text-white" : "border-slate-300 bg-white"}`}>
                      {checked ? <Check className="h-4 w-4" /> : null}
                    </span>
                    <span>
                      <strong className="block text-sm">{item.label}</strong>
                      <span className="text-xs text-muted-foreground">{checked ? "Ditampilkan" : "Disembunyikan"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {message ? <p className={`mt-5 rounded-lg px-4 py-3 text-sm font-semibold ${message.includes("berhasil") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message}</p> : null}
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={save} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Simpan Hak Akses
        </button>
      </div>
    </section>
  );
}
