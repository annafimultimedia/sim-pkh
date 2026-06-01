import { PageHeader, PrimaryButton } from "@/components/app-shell";
import { UsersTable } from "@/components/users-table";
import { getUsersRows } from "@/lib/data";

export default async function UsersPage() {
  const users = await getUsersRows();
  return (
    <>
      <PageHeader title="Manajemen User" description="Pengaturan akun login, password, dan role Admin Kabupaten atau Pendamping." action={<PrimaryButton>Tambah User</PrimaryButton>} />
      <UsersTable rows={users} />
    </>
  );
}
