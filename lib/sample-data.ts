import { Kpm, Pendamping, SessionUser } from "./types";

export const demoUsers: Record<string, SessionUser & { password: string }> = {
  admin: {
    id: 1,
    username: "admin",
    password: "admin123",
    name: "Admin Kabupaten Jember",
    role: "ADMIN",
    regency: "KABUPATEN JEMBER",
    regencyId: "3509",
    nip: "198705112010011001"
  },
  pendamping: {
    id: 2,
    username: "pendamping",
    password: "pkh123",
    name: "Siti Rahmawati",
    role: "PENDAMPING",
    regency: "KABUPATEN JEMBER",
    regencyId: "3509",
    district: "SUMBERBARU",
    districtId: "350902",
    nip: "199203182019032006"
  }
};

export const pendampingList: Pendamping[] = [
  { id: 1, nik: "3509015203890001", nip: "198903122014022001", nama: "Ahmad Fauzi", kecamatan: "TANGGUL", kabupaten: "KABUPATEN JEMBER" },
  { id: 2, nik: "3509106503920002", nip: "199203182019032006", nama: "Siti Rahmawati", kecamatan: "SUMBERBARU", kabupaten: "KABUPATEN JEMBER" },
  { id: 3, nik: "3509074401880003", nip: "198801042015031004", nama: "Dewi Lestari", kecamatan: "BANGSALSARI", kabupaten: "KABUPATEN JEMBER" },
  { id: 4, nik: "3509121011900004", nip: "199011102020121002", nama: "Budi Santoso", kecamatan: "SEMBORO", kabupaten: "KABUPATEN JEMBER" }
];

const villages = [
  ["YOSORATI", "SUMBERBARU"],
  ["JATIROTO", "SUMBERBARU"],
  ["PRINGGOWIRAWAN", "SUMBERBARU"],
  ["TANGGUL WETAN", "TANGGUL"],
  ["KRAMAT SUKOHARJO", "TANGGUL"],
  ["BANGSALSARI", "BANGSALSARI"],
  ["SUKORENO", "UMBULSARI"],
  ["SIDOMEKAR", "SEMBORO"]
];

export const kpmData: Kpm[] = Array.from({ length: 64 }).map((_, index) => {
  const [kelurahan, kecamatan] = villages[index % villages.length];
  const mapped = index % 4 !== 0;
  const p = pendampingList.find((item) => item.kecamatan === kecamatan) ?? pendampingList[index % pendampingList.length];
  return {
    id: index + 1,
    nama: ["Sulastri", "Maryam", "Saminah", "Nur Aini", "Khotimah", "Sri Wahyuni", "Maimunah", "Rohmah"][index % 8] + ` ${index + 1}`,
    nik: `3509${String(100000000000 + index).padStart(12, "0")}`,
    noKk: `3509${String(800000000000 + Math.floor(index / 2)).padStart(12, "0")}`,
    tglLahir: `${1970 + (index % 30)}-${String((index % 12) + 1).padStart(2, "0")}-15`,
    umur: 28 + (index % 45),
    art: 2 + (index % 5),
    hamil: index % 9 === 0 ? 1 : 0,
    aud: index % 5 === 0 ? 1 : 0,
    sd: index % 3,
    smp: index % 2,
    sma: index % 4 === 0 ? 1 : 0,
    disabil: index % 13 === 0 ? 1 : 0,
    lansia: index % 7 === 0 ? 1 : 0,
    ham: index % 10 === 0 ? 1 : 0,
    komponen: 1 + (index % 4),
    nominal: [225000, 500000, 750000, 975000][index % 4],
    status: ["CAIR", "VALIDASI", "RETUR", "TIDAK CAIR"][index % 4],
    alamatFc: `Dusun ${["Krajan", "Darungan", "Gumuk"][index % 3]}`,
    alamat: `Jl. Desa No. ${index + 3}`,
    rt: String((index % 8) + 1).padStart(2, "0"),
    rw: String((index % 5) + 1).padStart(2, "0"),
    kelurahan,
    kecamatan,
    kabupaten: "KABUPATEN JEMBER",
    provinsi: "JAWA TIMUR",
    pendamping: mapped ? p.nama : undefined,
    tahap: (index % 4) + 1,
    tahun: 2026
  };
});

export const artData = kpmData.slice(0, 42).map((kpm, index) => ({
  noKk: kpm.noKk,
  nik: `${kpm.nik.slice(0, 12)}${String(index + 70).padStart(4, "0")}`,
  nama: ["Ananda Putri", "Muhammad Rizki", "Aisyah", "Slamet", "Fatimah"][index % 5] + ` ${index + 1}`,
  komponen: ["SD", "SMP", "SMA", "LANSIA", "IBU HAMIL"][index % 5],
  dtsenJenjang: ["SD/MI", "SMP/MTs", "SMA/MA", "-", "-"][index % 5],
  dtsenSekolah: index % 4 === 0 ? "-" : "Sekolah Negeri " + ((index % 9) + 1),
  dtsenKip: index % 3 === 0 ? "YA" : "TIDAK",
  dtsenMsg: "Sinkron",
  dapodikJenjang: ["SD", "SMP", "SMA", "-", "-"][index % 5],
  dapodikSekolah: index % 4 === 0 ? "-" : "UPTD Satuan Pendidikan",
  dapodikKip: index % 3 === 0 ? "YA" : "TIDAK",
  dapodikMsg: index % 6 === 0 ? "Perlu verifikasi" : "Padan",
  alamat: kpm.alamat,
  rt: kpm.rt,
  rw: kpm.rw,
  desa: kpm.kelurahan,
  kecamatan: kpm.kecamatan,
  kabupaten: kpm.kabupaten
}));
