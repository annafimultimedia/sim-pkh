"use client";

import { useMemo, useState } from "react";
import { DataTable } from "./data-table";
import { DistrictOption, ProvinceOption, RegencyOption } from "@/lib/types";

type WilayahRow = {
  provinsi: string;
  kabupaten: string;
  kecamatan: string;
  desa: string;
};

export function WilayahTable({
  rows,
  provinces,
  regencies,
  districts
}: {
  rows: WilayahRow[];
  provinces: ProvinceOption[];
  regencies: RegencyOption[];
  districts: DistrictOption[];
}) {
  const [provinceId, setProvinceId] = useState("35");
  const [regencyId, setRegencyId] = useState("3509");
  const [districtId, setDistrictId] = useState("SEMUA");

  const regencyOptions = useMemo(() => regencies.filter((item) => provinceId === "SEMUA" || item.provinceId === provinceId), [provinceId, regencies]);
  const districtOptions = useMemo(() => districts.filter((item) => regencyId === "SEMUA" || item.regencyId === regencyId), [districtId, districts, regencyId]);
  const selectedProvince = provinces.find((item) => item.id === provinceId)?.name;
  const selectedRegency = regencies.find((item) => item.id === regencyId)?.name;
  const selectedDistrict = districts.find((item) => item.id === districtId)?.name;

  const filteredRows = rows.filter((row) =>
    (provinceId === "SEMUA" || row.provinsi === selectedProvince) &&
    (regencyId === "SEMUA" || row.kabupaten === selectedRegency) &&
    (districtId === "SEMUA" || row.kecamatan === selectedDistrict)
  );

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-white p-4 shadow-soft">
        <label className="text-sm font-semibold">
          Provinsi
          <select value={provinceId} onChange={(e) => { setProvinceId(e.target.value); setRegencyId("SEMUA"); setDistrictId("SEMUA"); }} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
            <option value="SEMUA">SEMUA PROVINSI</option>
            {provinces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Kabupaten
          <select value={regencyId} onChange={(e) => { setRegencyId(e.target.value); setDistrictId("SEMUA"); }} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
            <option value="SEMUA">SEMUA KABUPATEN</option>
            {regencyOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Kecamatan
          <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-white px-3">
            <option value="SEMUA">SEMUA KECAMATAN</option>
            {districtOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <div className="text-sm text-muted-foreground">
          Tampil: <span className="font-bold text-slate-900">{filteredRows.length.toLocaleString("id-ID")}</span> desa/kelurahan
        </div>
      </section>
      <DataTable rows={filteredRows} filename="master-wilayah" columns={[
        { key: "provinsi", header: "Provinsi" },
        { key: "kabupaten", header: "Kabupaten/Kota" },
        { key: "kecamatan", header: "Kecamatan" },
        { key: "desa", header: "Desa/Kelurahan" }
      ]} />
    </div>
  );
}
