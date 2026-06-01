"use client";

import { DataTable } from "./data-table";

type UserRow = {
  username: string;
  nama: string;
  role: string;
  wilayah: string;
  status: string;
};

export function UsersTable({ rows }: { rows: UserRow[] }) {
  return (
    <DataTable
      rows={rows as any[]}
      filename="manajemen-user"
      columns={[
        { key: "username", header: "Username" },
        { key: "nama", header: "Nama" },
        { key: "role", header: "Role" },
        { key: "wilayah", header: "Wilayah" },
        { key: "status", header: "Status" },
        { key: "aksi", header: "Aksi", render: () => <button className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">Reset Password</button> }
      ] as any[]}
    />
  );
}
