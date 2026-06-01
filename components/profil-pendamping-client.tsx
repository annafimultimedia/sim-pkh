"use client";

import { DataTable } from "./data-table";

export type ProfilPendampingRow = {
  id: number;
  nama: string;
  nik: string;
  nip: string;
  kecamatan: string;
  kabupaten: string;
  jumlahKelompok: number;
  jumlahKpm: number;
  p2k2Terkirim: number;
  p2k2Draft: number;
  hadirP2k2: number;
  tidakHadirP2k2: number;
  rekonTotal: number;
  rekonBelumTransaksi: number;
  rekonBelumBukti: number;
};

export function ProfilPendampingClient({ rows }: { rows: ProfilPendampingRow[] }) {
  return (
    <DataTable
      rows={rows as any[]}
      filename="profil-pendamping"
      columns={[
        { key: "nama", header: "Nama Pendamping" },
        { key: "nip", header: "NIP" },
        { key: "kecamatan", header: "Kecamatan" },
        { key: "jumlahKelompok", header: "Kelompok" },
        { key: "jumlahKpm", header: "KPM" },
        { key: "p2k2Terkirim", header: "P2K2 Terkirim" },
        { key: "p2k2Draft", header: "Draft" },
        { key: "hadirP2k2", header: "Hadir P2K2" },
        { key: "tidakHadirP2k2", header: "Tidak Hadir" },
        { key: "rekonTotal", header: "Total Rekon" },
        { key: "rekonBelumTransaksi", header: "Belum Transaksi" },
        { key: "rekonBelumBukti", header: "Belum Bukti" }
      ]}
      rowClassName={(row) => Number(row.rekonBelumBukti ?? 0) > 0 || Number(row.p2k2Draft ?? 0) > 0 ? "bg-amber-50/50" : "bg-white"}
    />
  );
}
