import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { MenuAccessClient } from "@/components/menu-access-client";
import { getSession } from "@/lib/auth";
import { getPendampingMenuAccess, pendampingMenuOptions } from "@/lib/menu-access";

export default async function HakAksesPage() {
  const user = await getSession();
  if (user.role !== "ADMIN") redirect("/dashboard");
  const enabledKeys = await getPendampingMenuAccess();

  return (
    <>
      <PageHeader
        title="Hak Akses Menu"
        description="Pilih menu yang dapat dilihat dan digunakan oleh role Pendamping."
      />
      <MenuAccessClient options={[...pendampingMenuOptions]} enabledKeys={enabledKeys} />
    </>
  );
}

