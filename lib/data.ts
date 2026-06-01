import { query } from "./db";
import { artData, kpmData, pendampingList } from "./sample-data";
import { ActivePeriod, DeadlineTask, DistrictOption, GroupSummary, Kpm, Pendamping, ProvinceOption, RegencyOption, SessionUser, VillageOption } from "./types";

type KpmRow = {
  id: number;
  nama_penerima: string;
  nik: string;
  no_kk: string;
  tgl_lahir: Date | string | null;
  umur: number | null;
  art: number | null;
  hamil: number | null;
  aud: number | null;
  sd: number | null;
  smp: number | null;
  sma: number | null;
  disabil: number | null;
  lansia: number | null;
  ham: number | null;
  jml_komponen: number | null;
  nominal: string | number | null;
  status: string | null;
  alamat_fc: string | null;
  alamat: string | null;
  rt: string | null;
  rw: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  pendamping_id: number | null;
  pendamping: string | null;
  stage: number;
  year: number;
};

function asDate(value: Date | string | null) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapKpm(row: KpmRow): Kpm {
  return {
    id: row.id,
    nama: row.nama_penerima,
    nik: row.nik,
    noKk: row.no_kk,
    tglLahir: asDate(row.tgl_lahir),
    umur: Number(row.umur ?? 0),
    art: Number(row.art ?? 0),
    hamil: Number(row.hamil ?? 0),
    aud: Number(row.aud ?? 0),
    sd: Number(row.sd ?? 0),
    smp: Number(row.smp ?? 0),
    sma: Number(row.sma ?? 0),
    disabil: Number(row.disabil ?? 0),
    lansia: Number(row.lansia ?? 0),
    ham: Number(row.ham ?? 0),
    komponen: Number(row.jml_komponen ?? 0),
    nominal: Number(row.nominal ?? 0),
    status: row.status ?? "",
    alamatFc: row.alamat_fc ?? "",
    alamat: row.alamat ?? "",
    rt: row.rt ?? "",
    rw: row.rw ?? "",
    kelurahan: row.kelurahan ?? "",
    kecamatan: row.kecamatan ?? "",
    kabupaten: row.kabupaten ?? "",
    provinsi: row.provinsi ?? "",
    pendampingId: row.pendamping_id ? Number(row.pendamping_id) : undefined,
    pendamping: row.pendamping ?? undefined,
    tahap: Number(row.stage),
    tahun: Number(row.year)
  };
}

function scopeWhere(user: SessionUser, alias = "k") {
  if (user.role === "PENDAMPING" && user.districtId) {
    return {
      sql: `WHERE EXISTS (
        SELECT 1 FROM reg_districts sd
        WHERE sd.id = ?
          AND UPPER(${alias}.kecamatan) = UPPER(sd.name)
      )`,
      params: [user.districtId]
    };
  }
  if (user.role === "PENDAMPING" && user.district) {
    return { sql: `WHERE UPPER(${alias}.kecamatan) = UPPER(?)`, params: [user.district] };
  }
  if (user.role === "ADMIN" && user.regency) {
    return { sql: `WHERE UPPER(${alias}.kabupaten) IN (UPPER(?), UPPER(REPLACE(?, 'KABUPATEN ', 'KAB. ')))`, params: [user.regency, user.regency] };
  }
  return { sql: "", params: [] as string[] };
}

export async function getKpmForUser(user: SessionUser): Promise<Kpm[]> {
  const scope = scopeWhere(user, "k");
  try {
    const rows = await query<KpmRow>(
      `SELECT k.*, p.name AS pendamping
       FROM kpm_final_closing k
       LEFT JOIN pendamping_profiles p ON p.id = k.pendamping_id
       ${scope.sql}
       ORDER BY k.year DESC, k.stage DESC, k.id DESC
       LIMIT 50000`,
      scope.params
    );
    return rows.map(mapKpm);
  } catch (error) {
    console.error("Gagal membaca data KPM dari MySQL", error);
    return [];
  }
}

export async function getPendampingProfileForUser(userId: number) {
  const rows = await query<{ id: number; district_id: string; regency_id: string; name: string }>(
    "SELECT id, district_id, regency_id, name FROM pendamping_profiles WHERE user_id = ? LIMIT 1",
    [userId]
  );
  return rows[0];
}

export async function getKpmForKelompok(user: SessionUser): Promise<Kpm[]> {
  try {
    if (user.role === "PENDAMPING") {
      const profile = await getPendampingProfileForUser(user.id);
      if (!profile) return [];
      const rows = await query<KpmRow>(
        `SELECT k.*, p.name AS pendamping
         FROM kpm_final_closing k
         LEFT JOIN pendamping_profiles p ON p.id = k.pendamping_id
         WHERE k.pendamping_id = ?
         ORDER BY k.kecamatan, k.kelurahan, k.nama_penerima
         LIMIT 50000`,
        [profile.id]
      );
      return rows.map(mapKpm);
    }
    const rows = await query<KpmRow>(
      `SELECT k.*, p.name AS pendamping
       FROM kpm_final_closing k
       LEFT JOIN pendamping_profiles p ON p.id = k.pendamping_id
       WHERE k.pendamping_id IS NOT NULL
       ORDER BY k.kecamatan, k.kelurahan, k.nama_penerima
       LIMIT 50000`
    );
    return rows.map(mapKpm);
  } catch (error) {
    console.error("Gagal membaca KPM kelompok", error);
    return [];
  }
}

export async function ensureSettingsTable() {
  await query("CREATE TABLE IF NOT EXISTS app_settings (setting_key VARCHAR(80) PRIMARY KEY, setting_value VARCHAR(255) NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8");
  await query("INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('active_year', '2026'), ('active_stage', '2'), ('app_name', 'SIM-PKH Kabupaten')");
}

export async function getActivePeriod(): Promise<ActivePeriod> {
  try {
    await ensureSettingsTable();
    const rows = await query<{ setting_key: string; setting_value: string }>("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('active_year', 'active_stage')");
    const map = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
    return { year: Number(map.active_year ?? 2026), stage: Number(map.active_stage ?? 2) };
  } catch (error) {
    console.error("Gagal membaca periode aktif", error);
    return { year: 2026, stage: 2 };
  }
}

export async function ensureDeadlineTaskTables() {
  await query(`CREATE TABLE IF NOT EXISTS deadline_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(180) NOT NULL,
    description TEXT NULL,
    due_date DATE NOT NULL,
    target_role ENUM('ALL','ADMIN','PENDAMPING') NOT NULL DEFAULT 'ALL',
    district_id VARCHAR(20) NULL,
    created_by BIGINT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8`);
  await query(`CREATE TABLE IF NOT EXISTS deadline_task_completions (
    task_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8`);
}

export async function getDeadlineTasks(user: SessionUser): Promise<DeadlineTask[]> {
  try {
    await ensureDeadlineTaskTables();
    const params: (string | number)[] = user.role === "ADMIN" ? [user.id] : [user.id, user.role, user.districtId ?? ""];
    const visibility = user.role === "ADMIN"
      ? "1=1"
      : `(t.target_role IN ('ALL', ?) AND (t.district_id IS NULL OR t.district_id = '' OR t.district_id = ?))`;
    const rows = await query<{
      id: number;
      title: string;
      description: string | null;
      dueDate: string;
      targetRole: "ALL" | "ADMIN" | "PENDAMPING";
      districtId: string | null;
      districtName: string | null;
      completedAt: string | null;
      createdBy: string | null;
    }>(
      `SELECT t.id, t.title, COALESCE(t.description, '') AS description,
              DATE_FORMAT(t.due_date, '%Y-%m-%d') AS dueDate,
              t.target_role AS targetRole,
              COALESCE(t.district_id, '') AS districtId,
              COALESCE(d.name, '') AS districtName,
              DATE_FORMAT(c.completed_at, '%Y-%m-%d %H:%i') AS completedAt,
              COALESCE(u.name, '-') AS createdBy
       FROM deadline_tasks t
       LEFT JOIN reg_districts d ON d.id = t.district_id
       LEFT JOIN deadline_task_completions c ON c.task_id = t.id AND c.user_id = ?
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.is_active = 1 AND ${visibility}
       ORDER BY t.due_date ASC, t.created_at DESC
       LIMIT 100`,
      params
    );
    return rows.map((row) => ({
      id: Number(row.id),
      title: row.title,
      description: row.description ?? "",
      dueDate: row.dueDate,
      targetRole: row.targetRole,
      districtId: row.districtId ?? "",
      districtName: row.districtName ?? "",
      completed: !!row.completedAt,
      completedAt: row.completedAt ?? "",
      createdBy: row.createdBy ?? "-"
    }));
  } catch (error) {
    console.error("Gagal membaca tugas deadline", error);
    return [];
  }
}

export async function getAppName() {
  try {
    await ensureSettingsTable();
    const rows = await query<{ setting_value: string }>("SELECT setting_value FROM app_settings WHERE setting_key = 'app_name' LIMIT 1");
    return rows[0]?.setting_value ?? "SIM-PKH Kabupaten";
  } catch (error) {
    console.error("Gagal membaca nama aplikasi", error);
    return "SIM-PKH Kabupaten";
  }
}

export async function ensureGroupMemberNikColumn() {
  await ensureP2k2GroupAreaColumns();
  try {
    await query("ALTER TABLE p2k2_group_members ADD COLUMN kpm_nik VARCHAR(30) NULL");
  } catch (error: any) {
    if (error?.code !== "ER_DUP_FIELDNAME" && error?.errno !== 1060) throw error;
  }
  try {
    await query("ALTER TABLE p2k2_group_members MODIFY kpm_id BIGINT NULL");
  } catch (error) {
    console.error("Gagal memastikan kpm_id anggota kelompok nullable", error);
  }
  try {
    await query(
      `UPDATE p2k2_group_members gm
       JOIN kpm_final_closing k ON k.id = gm.kpm_id
       SET gm.kpm_nik = k.nik
       WHERE gm.kpm_nik IS NULL OR gm.kpm_nik = ''`
    );
  } catch (error) {
    console.error("Gagal backfill NIK anggota kelompok", error);
  }
}

export async function ensureP2k2GroupAreaColumns() {
  const existing = await query<{ COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'p2k2_groups'`
  );
  const names = new Set(existing.map((row) => row.COLUMN_NAME));
  if (!names.has("district_id")) {
    await query("ALTER TABLE p2k2_groups ADD COLUMN district_id CHAR(6) NULL AFTER pendamping_id");
  }
  if (!names.has("regency_id")) {
    await query("ALTER TABLE p2k2_groups ADD COLUMN regency_id CHAR(4) NULL AFTER district_id");
  }
  if (!names.has("archived_at")) {
    await query("ALTER TABLE p2k2_groups ADD COLUMN archived_at TIMESTAMP NULL AFTER stage");
  }
  await query(
    `UPDATE p2k2_groups g
     JOIN pendamping_profiles p ON p.id = g.pendamping_id
     SET g.district_id = COALESCE(g.district_id, p.district_id),
         g.regency_id = COALESCE(g.regency_id, p.regency_id)
     WHERE g.district_id IS NULL OR g.regency_id IS NULL`
  );
}

export async function ensurePendampingAssignmentHistoryTable() {
  await query(`CREATE TABLE IF NOT EXISTS pendamping_assignment_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pendamping_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    district_id CHAR(6) NOT NULL,
    regency_id CHAR(4) NOT NULL,
    started_at DATE NOT NULL,
    ended_at DATE NULL,
    note VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8`);
  await query(
    `INSERT INTO pendamping_assignment_history (pendamping_id, user_id, district_id, regency_id, started_at, note)
     SELECT p.id, p.user_id, p.district_id, p.regency_id, CURDATE(), 'Riwayat awal dari data pendamping aktif'
     FROM pendamping_profiles p
     WHERE NOT EXISTS (
       SELECT 1 FROM pendamping_assignment_history h WHERE h.pendamping_id = p.id
     )`
  );
}

export async function getKelompokSummaries(user: SessionUser, options: { includeArchived?: boolean } = {}): Promise<GroupSummary[]> {
  try {
    await ensureGroupMemberNikColumn();
    const profile = user.role === "PENDAMPING" ? await getPendampingProfileForUser(user.id) : null;
    const archiveWhere = options.includeArchived ? "" : "g.archived_at IS NULL";
    const ownerWhere = profile ? "g.pendamping_id = ?" : "";
    const whereParts = [ownerWhere, archiveWhere].filter(Boolean);
    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const params = profile ? [profile.id] : [];
    const rows = await query<{
      id: number;
      name: string;
      year: number;
      stage: number;
      pendamping_id: number;
      pendamping: string;
      kecamatan: string;
      archived: number;
      member_count: number;
      member_ids: string | null;
      member_niks: string | null;
    }>(
      `SELECT g.id, g.name, g.year, g.stage, g.pendamping_id,
              p.name AS pendamping,
              COALESCE(gd.name, d.name) AS kecamatan,
              IF(g.archived_at IS NULL, 0, 1) AS archived,
              COUNT(DISTINCT COALESCE(gm.kpm_nik, k.nik)) AS member_count,
              GROUP_CONCAT(DISTINCT gm.kpm_id) AS member_ids,
              GROUP_CONCAT(DISTINCT COALESCE(gm.kpm_nik, k.nik)) AS member_niks
       FROM p2k2_groups g
       JOIN pendamping_profiles p ON p.id = g.pendamping_id
       LEFT JOIN reg_districts d ON d.id = p.district_id
       LEFT JOIN reg_districts gd ON gd.id = g.district_id
       LEFT JOIN p2k2_group_members gm ON gm.group_id = g.id
       LEFT JOIN kpm_final_closing k ON k.id = gm.kpm_id
       ${where}
       GROUP BY g.id, g.name, g.year, g.stage, g.pendamping_id, p.name, gd.name, d.name, g.archived_at
       ORDER BY g.created_at DESC`,
      params
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      year: Number(row.year),
      stage: Number(row.stage),
      pendampingId: row.pendamping_id,
      pendamping: row.pendamping,
      kecamatan: row.kecamatan ?? "",
      archived: Number(row.archived) === 1,
      memberCount: Number(row.member_count ?? 0),
      memberIds: row.member_ids ? row.member_ids.split(",").map(Number) : [],
      memberNiks: row.member_niks ? row.member_niks.split(",") : []
    }));
  } catch (error) {
    console.error("Gagal membaca rekap kelompok", error);
    return [];
  }
}

export async function getPendampingList(): Promise<Pendamping[]> {
  try {
    const activePeriod = await getActivePeriod();
    const rows = await query<{
      id: number;
      user_id: number;
      nik: string;
      nip: string | null;
      nama: string;
      district_id: string | null;
      regency_id: string | null;
      is_active: number;
      kecamatan: string | null;
      kabupaten: string | null;
      kpm_count: number;
    }>(
      `SELECT p.id, p.user_id, p.nik, p.nip, p.name AS nama,
              COALESCE(u.is_active, 0) AS is_active,
              p.district_id, p.regency_id,
              d.name AS kecamatan, r.name AS kabupaten,
              COUNT(k.id) AS kpm_count
       FROM pendamping_profiles p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN reg_districts d ON d.id = p.district_id
       LEFT JOIN reg_regencies r ON r.id = p.regency_id
       LEFT JOIN kpm_final_closing k ON k.pendamping_id = p.id AND k.year = ? AND k.stage = ?
       GROUP BY p.id, p.user_id, p.nik, p.nip, p.name, u.is_active, p.district_id, p.regency_id, d.name, r.name
       ORDER BY p.name ASC`,
      [activePeriod.year, activePeriod.stage]
    );
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      nik: row.nik,
      nip: row.nip ?? "",
      nama: row.nama,
      isActive: Number(row.is_active) === 1,
      districtId: row.district_id ?? "",
      regencyId: row.regency_id ?? "",
      kecamatan: row.kecamatan ?? "",
      kabupaten: row.kabupaten ?? "",
      kpmCount: Number(row.kpm_count ?? 0)
    }));
  } catch (error) {
    console.error("Gagal membaca pendamping dari MySQL", error);
    return pendampingList;
  }
}

export async function getDistrictOptions(regencyId = "3509"): Promise<DistrictOption[]> {
  try {
    return await query<DistrictOption>(
      `SELECT d.id, d.name, d.regency_id AS regencyId, r.name AS regencyName
       FROM reg_districts d
       JOIN reg_regencies r ON r.id = d.regency_id
       WHERE (? = '' OR r.id = ?)
       ORDER BY r.name, d.name`,
      [regencyId, regencyId]
    );
  } catch (error) {
    console.error("Gagal membaca daftar kecamatan", error);
    return [];
  }
}

export async function getRegencyOptions(provinceId = "35") {
  try {
    return await query<{ id: string; name: string }>(
      `SELECT id, name
       FROM reg_regencies
       WHERE (? = '' OR province_id = ?)
       ORDER BY name`,
      [provinceId, provinceId]
    );
  } catch (error) {
    console.error("Gagal membaca daftar kabupaten", error);
    return [];
  }
}

export async function getVillageOptions(regencyId = "3509"): Promise<VillageOption[]> {
  try {
    return await query<VillageOption>(
      `SELECT v.id, v.name, v.district_id AS districtId, d.name AS districtName
       FROM reg_villages v
       JOIN reg_districts d ON d.id = v.district_id
       WHERE d.regency_id = ?
       ORDER BY d.name, v.name`,
      [regencyId]
    );
  } catch (error) {
    console.error("Gagal membaca daftar desa", error);
    return [];
  }
}

export async function getArtForUser(user: SessionUser) {
  try {
    await ensureArtMembersExtraColumns();
    const activePeriod = await getActivePeriod();
    const scope = user.role === "PENDAMPING" && user.districtId
      ? "WHERE EXISTS (SELECT 1 FROM reg_districts sd WHERE sd.id = ? AND UPPER(COALESCE(fc.kecamatan, a.kecamatan)) = UPPER(sd.name))"
      : user.role === "PENDAMPING" && user.district
        ? "WHERE UPPER(COALESCE(fc.kecamatan, a.kecamatan)) = UPPER(?)"
        : "";
    const params = user.role === "PENDAMPING" && user.districtId ? [user.districtId] : user.role === "PENDAMPING" && user.district ? [user.district] : [];
    const rows = await query<any>(
      `SELECT a.no_kk AS noKk, a.nik, a.nama, a.komponen,
              a.dtsen_jenjang AS dtsenJenjang, a.dtsen_sekolah AS dtsenSekolah,
              a.dtsen_kip AS dtsenKip, a.dtsen_msg AS dtsenMsg,
              a.dapodik_jenjang AS dapodikJenjang, a.dapodik_sekolah AS dapodikSekolah,
              a.dapodik_kip AS dapodikKip, a.dapodik_msg AS dapodikMsg,
              COALESCE(fc.alamat, a.alamat, '') AS alamat,
              COALESCE(fc.rt, a.rt, '') AS rt,
              COALESCE(fc.rw, a.rw, '') AS rw,
              COALESCE(fc.kelurahan, a.desa, '') AS desa,
              COALESCE(fc.kecamatan, a.kecamatan, '') AS kecamatan,
              COALESCE(fc.kabupaten, a.kabupaten, '') AS kabupaten,
              COALESCE(fc.pendamping, '') AS pendamping,
              COALESCE(a.status, '') AS status,
              COALESCE(a.periode, '') AS periode,
              IF(fc.no_kk IS NULL, 'Belum cocok Final Closing', 'Cocok Final Closing') AS statusFinalClosing
       FROM art_members a
       LEFT JOIN (
         SELECT fc.no_kk, MAX(fc.alamat) alamat, MAX(fc.rt) rt, MAX(fc.rw) rw, MAX(fc.kelurahan) kelurahan,
                MAX(fc.kecamatan) kecamatan, MAX(fc.kabupaten) kabupaten, MAX(p.name) pendamping
         FROM kpm_final_closing fc
         LEFT JOIN pendamping_profiles p ON p.id = fc.pendamping_id
         WHERE fc.year = ? AND fc.stage = ?
         GROUP BY fc.no_kk
       ) fc ON fc.no_kk = a.no_kk
       ${scope}
       ORDER BY COALESCE(fc.kecamatan, a.kecamatan),
                COALESCE(fc.kelurahan, a.desa),
                a.no_kk,
                CASE WHEN UPPER(a.komponen) = 'PENGURUS' THEN 0 ELSE 1 END,
                a.nama
       LIMIT 50000`,
      [activePeriod.year, activePeriod.stage, ...params]
    );
    return rows;
  } catch (error) {
    console.error("Gagal membaca ART dari MySQL", error);
    return user.role === "PENDAMPING" ? artData.filter((row) => row.kecamatan === user.district) : artData;
  }
}

export async function ensureArtMembersExtraColumns() {
  const columns = [
    ["alamat", "TEXT NULL"],
    ["rt", "VARCHAR(10) NULL"],
    ["rw", "VARCHAR(10) NULL"],
    ["desa", "VARCHAR(120) NULL"],
    ["kecamatan", "VARCHAR(120) NULL"],
    ["kabupaten", "VARCHAR(120) NULL"],
    ["status", "VARCHAR(120) NULL"],
    ["periode", "VARCHAR(120) NULL"]
  ];
  const existing = await query<{ COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'art_members'`
  );
  const existingNames = new Set(existing.map((row) => row.COLUMN_NAME));
  for (const [name, definition] of columns) {
    if (!existingNames.has(name)) {
      await query(`ALTER TABLE art_members ADD COLUMN ${name} ${definition}`);
    }
  }
}

export async function ensureP2k2ReportTables() {
  await query(`CREATE TABLE IF NOT EXISTS p2k2_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    group_id BIGINT NOT NULL,
    pendamping_id BIGINT NOT NULL,
    year SMALLINT NOT NULL,
    month TINYINT NOT NULL,
    meeting_date DATE NULL,
    module_name VARCHAR(180) NULL,
    session_name VARCHAR(220) NULL,
    material_title VARCHAR(220) NULL,
    status ENUM('DRAFT','TERKIRIM') DEFAULT 'DRAFT',
    photo_path VARCHAR(255) NULL,
    photo_size INT NULL,
    pdf_path VARCHAR(255) NULL,
    pdf_size INT NULL,
    submitted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_report_group_month (group_id, year, month)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8`);
  await query(`CREATE TABLE IF NOT EXISTS p2k2_report_attendance (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_id BIGINT NOT NULL,
    kpm_id BIGINT NOT NULL,
    kpm_nik VARCHAR(30) NOT NULL,
    kpm_name VARCHAR(180) NOT NULL,
    attendance_status ENUM('HADIR','TIDAK_HADIR') NOT NULL DEFAULT 'HADIR',
    UNIQUE KEY uniq_report_kpm (report_id, kpm_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8`);
  try {
    await query("ALTER TABLE p2k2_report_attendance ADD COLUMN note VARCHAR(255) NULL");
  } catch (error: any) {
    if (error?.code !== "ER_DUP_FIELDNAME" && error?.errno !== 1060) throw error;
  }
}

export async function getP2k2Reports(user: SessionUser, year: number, month: number) {
  try {
    await ensureP2k2GroupAreaColumns();
    await ensureP2k2ReportTables();
    const profile = user.role === "PENDAMPING" ? await getPendampingProfileForUser(user.id) : null;
    const where = profile ? "WHERE r.pendamping_id = ? AND r.year = ? AND r.month = ?" : "WHERE r.year = ? AND r.month = ?";
    const params = profile ? [profile.id, year, month] : [year, month];
    return await query<{
      id: number;
      groupId: number;
      groupName: string;
      pendamping: string;
      kecamatan: string;
      year: number;
      month: number;
      meetingDate: string | null;
      moduleName: string | null;
      sessionName: string | null;
      status: "DRAFT" | "TERKIRIM";
      photoPath: string | null;
      pdfPath: string | null;
      hadir: number;
      tidakHadir: number;
    }>(
      `SELECT r.id, r.group_id AS groupId, g.name AS groupName, p.name AS pendamping, COALESCE(gd.name, d.name, '') AS kecamatan,
              r.year, r.month, DATE_FORMAT(r.meeting_date, '%Y-%m-%d') AS meetingDate,
              r.module_name AS moduleName, r.session_name AS sessionName, r.status,
              r.photo_path AS photoPath, r.pdf_path AS pdfPath,
              SUM(CASE WHEN a.attendance_status = 'HADIR' THEN 1 ELSE 0 END) AS hadir,
              SUM(CASE WHEN a.attendance_status = 'TIDAK_HADIR' THEN 1 ELSE 0 END) AS tidakHadir
       FROM p2k2_reports r
       JOIN p2k2_groups g ON g.id = r.group_id
       JOIN pendamping_profiles p ON p.id = r.pendamping_id
       LEFT JOIN reg_districts d ON d.id = p.district_id
       LEFT JOIN reg_districts gd ON gd.id = g.district_id
       LEFT JOIN p2k2_report_attendance a ON a.report_id = r.id
       ${where}
       GROUP BY r.id, r.group_id, g.name, p.name, gd.name, d.name, r.year, r.month, r.meeting_date, r.module_name, r.session_name, r.status, r.photo_path, r.pdf_path
       ORDER BY COALESCE(gd.name, d.name), p.name, g.name`,
      params
    );
  } catch (error) {
    console.error("Gagal membaca laporan P2K2", error);
    return [];
  }
}

export async function getP2k2AttendanceRows(user: SessionUser) {
  try {
    await ensureP2k2GroupAreaColumns();
    await ensureP2k2ReportTables();
    const profile = user.role === "PENDAMPING" ? await getPendampingProfileForUser(user.id) : null;
    const where = profile ? "WHERE r.pendamping_id = ?" : "";
    const params = profile ? [profile.id] : [];
    return await query<{
      reportId: number;
      groupId: number;
      groupName: string;
      pendamping: string;
      kecamatan: string;
      desa: string;
      noKk: string;
      kpmId: number;
      nik: string;
      nama: string;
      year: number;
      month: number;
      meetingDate: string | null;
      status: "HADIR" | "TIDAK_HADIR";
      note: string;
    }>(
      `SELECT r.id AS reportId, r.group_id AS groupId, g.name AS groupName,
              p.name AS pendamping, COALESCE(gd.name, d.name, '') AS kecamatan,
              COALESCE(k.kelurahan, '') AS desa, COALESCE(k.no_kk, '') AS noKk,
              a.kpm_id AS kpmId, a.kpm_nik AS nik, a.kpm_name AS nama,
              r.year, r.month, DATE_FORMAT(r.meeting_date, '%Y-%m-%d') AS meetingDate,
              a.attendance_status AS status,
              COALESCE(a.note, '') AS note
       FROM p2k2_report_attendance a
       JOIN p2k2_reports r ON r.id = a.report_id
       JOIN p2k2_groups g ON g.id = r.group_id
       JOIN pendamping_profiles p ON p.id = r.pendamping_id
       LEFT JOIN reg_districts d ON d.id = p.district_id
       LEFT JOIN reg_districts gd ON gd.id = g.district_id
       LEFT JOIN kpm_final_closing k ON k.id = a.kpm_id
       ${where}
       ORDER BY r.year DESC, r.month DESC, COALESCE(gd.name, d.name), p.name, g.name, a.kpm_name`,
      params
    );
  } catch (error) {
    console.error("Gagal membaca rekap kehadiran P2K2", error);
    return [];
  }
}

export async function ensureRekonTables() {
  await query(`CREATE TABLE IF NOT EXISTS rekon_transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    kpm_id BIGINT NULL,
    kpm_nik VARCHAR(30) NOT NULL,
    group_id BIGINT NOT NULL,
    pendamping_id BIGINT NOT NULL,
    year SMALLINT NOT NULL,
    stage TINYINT NOT NULL,
    status ENUM('SUDAH_TRANSAKSI','BELUM_TRANSAKSI') DEFAULT 'BELUM_TRANSAKSI',
    photo_path VARCHAR(255) NULL,
    photo_size INT NULL,
    updated_by BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_rekon_period_kpm (year, stage, kpm_nik)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8`);
}

export async function getRekonRows(user: SessionUser, activePeriod: ActivePeriod) {
  try {
    await ensureGroupMemberNikColumn();
    await ensureRekonTables();
    const profile = user.role === "PENDAMPING" ? await getPendampingProfileForUser(user.id) : null;
    const where = profile ? "AND g.pendamping_id = ?" : "";
    return await query<{
      kpmId: number;
      nik: string;
      nama: string;
      noKk: string;
      desa: string;
      kecamatan: string;
      nominal: number;
      pendamping: string;
      pendampingId: number;
      groupId: number;
      groupName: string;
      year: number;
      stage: number;
      status: "SUDAH_TRANSAKSI" | "BELUM_TRANSAKSI";
      photoPath: string | null;
    }>(
      `SELECT MIN(k.id) AS kpmId, k.nik, MAX(k.nama_penerima) AS nama, MAX(k.no_kk) AS noKk,
              MAX(k.kelurahan) AS desa, MAX(k.kecamatan) AS kecamatan,
              MAX(k.nominal) AS nominal,
              p.name AS pendamping, g.pendamping_id AS pendampingId, g.id AS groupId, g.name AS groupName,
              ? AS year, ? AS stage,
              COALESCE(r.status, 'BELUM_TRANSAKSI') AS status,
              r.photo_path AS photoPath
       FROM p2k2_group_members gm
       JOIN p2k2_groups g ON g.id = gm.group_id
       JOIN pendamping_profiles p ON p.id = g.pendamping_id
       JOIN kpm_final_closing k ON (k.nik = gm.kpm_nik OR k.id = gm.kpm_id)
        AND k.year = ? AND k.stage = ? AND k.pendamping_id = g.pendamping_id
       LEFT JOIN rekon_transactions r ON r.kpm_nik = k.nik AND r.year = ? AND r.stage = ?
       WHERE 1=1 ${where}
       GROUP BY k.nik, p.name, g.pendamping_id, g.id, g.name, r.status, r.photo_path
       ORDER BY MAX(k.kecamatan), MAX(k.kelurahan), g.name, MAX(k.nama_penerima)`,
      [activePeriod.year, activePeriod.stage, activePeriod.year, activePeriod.stage, activePeriod.year, activePeriod.stage, ...(profile ? [profile.id] : [])]
    );
  } catch (error) {
    console.error("Gagal membaca data rekon", error);
    return [];
  }
}

export async function getWilayahRows(regencyId = "3509") {
  try {
    return await query<{ provinsi: string; kabupaten: string; kecamatan: string; desa: string }>(
      `SELECT p.name AS provinsi, r.name AS kabupaten, d.name AS kecamatan, v.name AS desa
       FROM reg_villages v
       JOIN reg_districts d ON d.id = v.district_id
       JOIN reg_regencies r ON r.id = d.regency_id
       JOIN reg_provinces p ON p.id = r.province_id
       WHERE (? = '' OR r.id = ?)
       ORDER BY d.name, v.name
       LIMIT 10000`,
      [regencyId, regencyId]
    );
  } catch (error) {
    console.error("Gagal membaca wilayah dari MySQL", error);
    return [];
  }
}

export async function getProvinceOptions(): Promise<ProvinceOption[]> {
  try {
    return await query<ProvinceOption>("SELECT id, name FROM reg_provinces ORDER BY name");
  } catch (error) {
    console.error("Gagal membaca provinsi", error);
    return [];
  }
}

export async function getAllRegencyOptions(): Promise<RegencyOption[]> {
  try {
    return await query<RegencyOption>("SELECT id, name, province_id AS provinceId FROM reg_regencies ORDER BY name");
  } catch (error) {
    console.error("Gagal membaca kabupaten", error);
    return [];
  }
}

export async function getAllDistrictOptions(): Promise<DistrictOption[]> {
  try {
    return await query<DistrictOption>(
      `SELECT d.id, d.name, d.regency_id AS regencyId, r.name AS regencyName
       FROM reg_districts d
       JOIN reg_regencies r ON r.id = d.regency_id
       ORDER BY r.name, d.name`
    );
  } catch (error) {
    console.error("Gagal membaca kecamatan", error);
    return [];
  }
}

export async function getUsersRows() {
  try {
    return await query<{ username: string; nama: string; role: string; wilayah: string; status: string }>(
      `SELECT u.username, u.name AS nama, u.role,
              COALESCE(d.name, r.name, '-') AS wilayah,
              IF(u.is_active = 1, 'Aktif', 'Nonaktif') AS status
       FROM users u
       LEFT JOIN reg_regencies r ON r.id = u.regency_id
       LEFT JOIN reg_districts d ON d.id = u.district_id
       ORDER BY u.role, u.name`
    );
  } catch (error) {
    console.error("Gagal membaca user dari MySQL", error);
    return [];
  }
}

export async function getActivityLogs() {
  try {
    return await query<{ waktu: string; user: string; aksi: string; modul: string; deskripsi: string }>(
      `SELECT DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i') AS waktu,
              COALESCE(u.name, '-') AS user,
              l.action AS aksi,
              l.entity AS modul,
              COALESCE(l.description, '') AS deskripsi
       FROM activity_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC
       LIMIT 500`
    );
  } catch (error) {
    console.error("Gagal membaca log aktivitas dari MySQL", error);
    return [];
  }
}

export async function getOnlineUsers() {
  try {
    return await query<{
      id: number;
      name: string;
      username: string;
      role: string;
      district: string | null;
      lastSeenAt: string;
    }>(
      `SELECT u.id, u.name, u.username, u.role, d.name AS district,
              DATE_FORMAT(u.last_seen_at, '%Y-%m-%d %H:%i:%s') AS lastSeenAt
       FROM users u
       LEFT JOIN reg_districts d ON d.id = u.district_id
       WHERE u.is_active = 1
         AND u.current_session_token IS NOT NULL
         AND u.last_seen_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
       ORDER BY u.last_seen_at DESC`
    );
  } catch (error) {
    console.error("Gagal membaca user online", error);
    return [];
  }
}

export async function ensureSuratArchivesTable() {
  await query(`CREATE TABLE IF NOT EXISTS surat_archives (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tanggal_surat DATE NOT NULL,
    tanggal_diterima DATE NOT NULL,
    nomor_surat VARCHAR(120) NULL,
    pengirim VARCHAR(180) NOT NULL,
    perihal VARCHAR(255) NOT NULL,
    kategori VARCHAR(120) NULL,
    catatan TEXT NULL,
    file_path VARCHAR(255) NULL,
    file_name VARCHAR(255) NULL,
    file_size INT NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8`);
}

export async function getSuratArchiveRows() {
  try {
    await ensureSuratArchivesTable();
    return await query<{
      id: number;
      tanggalSurat: string;
      tanggalDiterima: string;
      nomorSurat: string;
      pengirim: string;
      perihal: string;
      kategori: string;
      catatan: string;
      filePath: string;
      fileName: string;
      fileSize: number;
      dibuatOleh: string;
      createdBy: number;
      dibuatPada: string;
    }>(
      `SELECT s.id,
              DATE_FORMAT(s.tanggal_surat, '%Y-%m-%d') AS tanggalSurat,
              DATE_FORMAT(s.tanggal_diterima, '%Y-%m-%d') AS tanggalDiterima,
              COALESCE(s.nomor_surat, '') AS nomorSurat,
              s.pengirim,
              s.perihal,
              COALESCE(s.kategori, '') AS kategori,
              COALESCE(s.catatan, '') AS catatan,
              COALESCE(s.file_path, '') AS filePath,
              COALESCE(s.file_name, '') AS fileName,
              COALESCE(s.file_size, 0) AS fileSize,
              COALESCE(u.name, '-') AS dibuatOleh,
              s.created_by AS createdBy,
              DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i') AS dibuatPada
       FROM surat_archives s
       LEFT JOIN users u ON u.id = s.created_by
       ORDER BY s.tanggal_diterima DESC, s.id DESC
       LIMIT 5000`
    );
  } catch (error) {
    console.error("Gagal membaca arsip surat", error);
    return [];
  }
}

export async function getImportBatchLogs() {
  try {
    return await query<{
      id: number;
      jenis: string;
      tahun: number;
      tahap: number;
      kecamatan: string;
      file: string;
      jumlahData: number;
      diuploadOleh: string;
      waktu: string;
    }>(
      `SELECT b.id,
              b.type AS jenis,
              b.year AS tahun,
              b.stage AS tahap,
              COALESCE(d.name, '-') AS kecamatan,
              b.file_name AS file,
              COUNT(k.id) AS jumlahData,
              COALESCE(u.name, '-') AS diuploadOleh,
              DATE_FORMAT(b.uploaded_at, '%Y-%m-%d %H:%i') AS waktu
       FROM import_batches b
       LEFT JOIN reg_districts d ON d.id = b.district_id
       LEFT JOIN users u ON u.id = b.uploaded_by
       LEFT JOIN kpm_final_closing k ON k.import_batch_id = b.id
       GROUP BY b.id, b.type, b.year, b.stage, d.name, b.file_name, u.name, b.uploaded_at
       ORDER BY b.uploaded_at DESC
       LIMIT 500`
    );
  } catch (error) {
    console.error("Gagal membaca log import", error);
    return [];
  }
}

export function buildDashboardData(rows: Kpm[], user: SessionUser) {
  return {
    totalKpm: rows.length,
    nominal: rows.reduce((sum, item) => sum + item.nominal, 0),
    mapped: rows.filter((item) => item.pendamping).length,
    unmapped: rows.filter((item) => !item.pendamping).length,
    byStatus: Object.entries(rows.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.status || "TANPA STATUS"]: (acc[item.status || "TANPA STATUS"] ?? 0) + 1 }), {})).map(([name, value]) => ({ name, value })),
    byDistrict: Object.entries(rows.reduce<Record<string, number>>((acc, item) => {
      const key = user.role === "PENDAMPING" ? item.kelurahan || "Tanpa Desa" : item.kecamatan || "Tanpa Kecamatan";
      return { ...acc, [key]: (acc[key] ?? 0) + 1 };
    }, {})).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    byStage: [1, 2, 3, 4].map((stage) => ({ tahap: `Tahap ${stage}`, total: rows.filter((item) => item.tahap === stage).length }))
  };
}
