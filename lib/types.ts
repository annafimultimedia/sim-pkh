export type Role = "ADMIN" | "PENDAMPING";

export type SessionUser = {
  id: number;
  name: string;
  username: string;
  role: Role;
  regency: string;
  regencyId?: string;
  district?: string;
  districtId?: string;
  nip?: string;
  photoPath?: string;
  sessionToken?: string;
};

export type Kpm = {
  id: number;
  nama: string;
  nik: string;
  noKk: string;
  tglLahir: string;
  umur: number;
  art: number;
  hamil: number;
  aud: number;
  sd: number;
  smp: number;
  sma: number;
  disabil: number;
  lansia: number;
  ham: number;
  komponen: number;
  nominal: number;
  status: string;
  alamatFc: string;
  alamat: string;
  rt: string;
  rw: string;
  kelurahan: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  pendampingId?: number;
  pendamping?: string;
  tahap: number;
  tahun: number;
};

export type Pendamping = {
  id: number;
  userId?: number;
  nik: string;
  nip: string;
  nama: string;
  isActive?: boolean;
  districtId?: string;
  regencyId?: string;
  kecamatan: string;
  kabupaten: string;
  kpmCount?: number;
};

export type DistrictOption = {
  id: string;
  name: string;
  regencyId: string;
  regencyName: string;
};

export type VillageOption = {
  id: string;
  name: string;
  districtId: string;
  districtName: string;
};

export type ProvinceOption = {
  id: string;
  name: string;
};

export type RegencyOption = {
  id: string;
  name: string;
  provinceId: string;
};

export type GroupSummary = {
  id: number;
  name: string;
  year: number;
  stage: number;
  pendampingId: number;
  pendamping: string;
  kecamatan: string;
  archived?: boolean;
  memberCount: number;
  memberIds: number[];
  memberNiks: string[];
};

export type ActivePeriod = {
  year: number;
  stage: number;
};

export type DeadlineTask = {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  targetRole: "ALL" | "ADMIN" | "PENDAMPING";
  districtId: string;
  districtName: string;
  completed: boolean;
  completedAt: string;
  createdBy: string;
};
