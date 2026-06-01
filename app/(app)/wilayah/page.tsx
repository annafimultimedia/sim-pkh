import { PageHeader } from "@/components/app-shell";
import { WilayahTable } from "@/components/wilayah-table";
import { getAllDistrictOptions, getAllRegencyOptions, getProvinceOptions, getWilayahRows } from "@/lib/data";

export default async function WilayahPage() {
  const [wilayah, provinces, regencies, districts] = await Promise.all([
    getWilayahRows(),
    getProvinceOptions(),
    getAllRegencyOptions(),
    getAllDistrictOptions()
  ]);

  return (
    <>
      <PageHeader title="Master Wilayah" description="Relasi Provinsi, Kabupaten/Kota, Kecamatan, dan Desa/Kelurahan dari database wilayah." />
      <WilayahTable rows={wilayah} provinces={provinces} regencies={regencies} districts={districts} />
    </>
  );
}
