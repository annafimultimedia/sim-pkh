CREATE DATABASE IF NOT EXISTS sim_pkh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sim_pkh;

CREATE TABLE IF NOT EXISTS reg_provinces (
  id CHAR(2) PRIMARY KEY,
  name VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS reg_regencies (
  id CHAR(4) PRIMARY KEY,
  province_id CHAR(2) NOT NULL,
  name VARCHAR(255) NOT NULL,
  FOREIGN KEY (province_id) REFERENCES reg_provinces(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS reg_districts (
  id CHAR(6) PRIMARY KEY,
  regency_id CHAR(4) NOT NULL,
  name VARCHAR(255) NOT NULL,
  FOREIGN KEY (regency_id) REFERENCES reg_regencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS reg_villages (
  id CHAR(10) PRIMARY KEY,
  district_id CHAR(6) NOT NULL,
  name VARCHAR(255) NOT NULL,
  FOREIGN KEY (district_id) REFERENCES reg_districts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN','PENDAMPING') NOT NULL,
  name VARCHAR(160) NOT NULL,
  nik VARCHAR(30) NULL,
  nip VARCHAR(40) NULL,
  profile_photo_path VARCHAR(255) NULL,
  regency_id CHAR(4) NULL,
  district_id CHAR(6) NULL,
  is_active TINYINT(1) DEFAULT 1,
  current_session_token VARCHAR(120) NULL,
  last_seen_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS role_menu_access (
  role ENUM('PENDAMPING') NOT NULL,
  menu_key VARCHAR(80) NOT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (role, menu_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS pendamping_profiles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  nik VARCHAR(30) NOT NULL,
  nip VARCHAR(40) NULL,
  name VARCHAR(160) NOT NULL,
  district_id CHAR(6) NOT NULL,
  regency_id CHAR(4) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (district_id) REFERENCES reg_districts(id),
  FOREIGN KEY (regency_id) REFERENCES reg_regencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS import_batches (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('FINAL_CLOSING','ART') NOT NULL,
  year SMALLINT NOT NULL,
  stage TINYINT NOT NULL,
  district_id CHAR(6) NULL,
  file_name VARCHAR(255) NOT NULL,
  uploaded_by BIGINT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS kpm_final_closing (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  import_batch_id BIGINT NOT NULL,
  year SMALLINT NOT NULL,
  stage TINYINT NOT NULL,
  nama_penerima VARCHAR(180) NOT NULL,
  nik VARCHAR(30) NOT NULL,
  no_kk VARCHAR(30) NOT NULL,
  tgl_lahir DATE NULL,
  umur INT NULL,
  art INT DEFAULT 0,
  hamil INT DEFAULT 0,
  aud INT DEFAULT 0,
  sd INT DEFAULT 0,
  smp INT DEFAULT 0,
  sma INT DEFAULT 0,
  disabil INT DEFAULT 0,
  lansia INT DEFAULT 0,
  ham INT DEFAULT 0,
  jml_komponen INT DEFAULT 0,
  nominal DECIMAL(14,2) DEFAULT 0,
  status VARCHAR(80) NULL,
  alamat_fc TEXT NULL,
  alamat TEXT NULL,
  rt VARCHAR(10) NULL,
  rw VARCHAR(10) NULL,
  kelurahan VARCHAR(120) NULL,
  kecamatan VARCHAR(120) NULL,
  kabupaten VARCHAR(120) NULL,
  provinsi VARCHAR(120) NULL,
  pendamping_id BIGINT NULL,
  mapped_at TIMESTAMP NULL,
  INDEX idx_kpm_scope (year, stage, kabupaten, kecamatan, kelurahan),
  INDEX idx_kpm_search (nik, no_kk, nama_penerima),
  FOREIGN KEY (import_batch_id) REFERENCES import_batches(id),
  FOREIGN KEY (pendamping_id) REFERENCES pendamping_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS art_members (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  import_batch_id BIGINT NOT NULL,
  no_kk VARCHAR(30) NOT NULL,
  nik VARCHAR(30) NOT NULL,
  nama VARCHAR(180) NOT NULL,
  komponen VARCHAR(80) NULL,
  dtsen_jenjang VARCHAR(80) NULL,
  dtsen_sekolah VARCHAR(180) NULL,
  dtsen_kip VARCHAR(80) NULL,
  dtsen_msg VARCHAR(180) NULL,
  dapodik_jenjang VARCHAR(80) NULL,
  dapodik_sekolah VARCHAR(180) NULL,
  dapodik_kip VARCHAR(80) NULL,
  dapodik_msg VARCHAR(180) NULL,
  alamat TEXT NULL,
  rt VARCHAR(10) NULL,
  rw VARCHAR(10) NULL,
  desa VARCHAR(120) NULL,
  kecamatan VARCHAR(120) NULL,
  kabupaten VARCHAR(120) NULL,
  status VARCHAR(120) NULL,
  periode VARCHAR(120) NULL,
  entry_source VARCHAR(20) NOT NULL DEFAULT 'IMPORT',
  health_kpm_id BIGINT NULL,
  health_slot_no INT NULL,
  health_component_type VARCHAR(20) NULL,
  FOREIGN KEY (import_batch_id) REFERENCES import_batches(id),
  INDEX idx_art_search (no_kk, nik, nama),
  INDEX idx_art_health_slot (health_kpm_id, health_slot_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS p2k2_groups (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  pendamping_id BIGINT NOT NULL,
  district_id CHAR(6) NULL,
  regency_id CHAR(4) NULL,
  year SMALLINT NOT NULL,
  stage TINYINT NOT NULL,
  archived_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pendamping_id) REFERENCES pendamping_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS pendamping_assignment_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  pendamping_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  district_id CHAR(6) NOT NULL,
  regency_id CHAR(4) NOT NULL,
  started_at DATE NOT NULL,
  ended_at DATE NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pendamping_id) REFERENCES pendamping_profiles(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS p2k2_group_members (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT NOT NULL,
  kpm_id BIGINT NULL,
  kpm_nik VARCHAR(30) NULL,
  UNIQUE KEY uniq_group_kpm (group_id, kpm_id),
  FOREIGN KEY (group_id) REFERENCES p2k2_groups(id),
  FOREIGN KEY (kpm_id) REFERENCES kpm_final_closing(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS p2k2_reports (
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
  UNIQUE KEY uniq_report_group_month (group_id, year, month),
  FOREIGN KEY (group_id) REFERENCES p2k2_groups(id),
  FOREIGN KEY (pendamping_id) REFERENCES pendamping_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS p2k2_report_attendance (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_id BIGINT NOT NULL,
  kpm_id BIGINT NOT NULL,
  kpm_nik VARCHAR(30) NOT NULL,
  kpm_name VARCHAR(180) NOT NULL,
  attendance_status ENUM('HADIR','TIDAK_HADIR') NOT NULL DEFAULT 'HADIR',
  UNIQUE KEY uniq_report_kpm (report_id, kpm_id),
  FOREIGN KEY (report_id) REFERENCES p2k2_reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS rekon_transactions (
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
  UNIQUE KEY uniq_rekon_period_kpm (year, stage, kpm_nik),
  FOREIGN KEY (group_id) REFERENCES p2k2_groups(id),
  FOREIGN KEY (pendamping_id) REFERENCES pendamping_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS surat_archives (
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS health_visit_verifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  kpm_id BIGINT NOT NULL,
  elder_slot_no INT NOT NULL,
  component_type VARCHAR(20) NOT NULL DEFAULT 'LANSIA',
  elder_nik VARCHAR(30) NOT NULL,
  elder_name VARCHAR(180) NOT NULL,
  no_kk VARCHAR(30) NOT NULL,
  group_id BIGINT NULL,
  group_name VARCHAR(160) NULL,
  year SMALLINT NOT NULL,
  month TINYINT NOT NULL,
  visit_date DATE NOT NULL,
  attendance_status ENUM('HADIR','TIDAK_HADIR') NOT NULL,
  note VARCHAR(500) NULL,
  verified_by BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_health_visit_component_month (kpm_id, component_type, elder_slot_no, year, month),
  INDEX idx_health_visit_nik (elder_nik),
  FOREIGN KEY (kpm_id) REFERENCES kpm_final_closing(id),
  FOREIGN KEY (verified_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NULL,
  action VARCHAR(120) NOT NULL,
  entity VARCHAR(120) NOT NULL,
  entity_id VARCHAR(80) NULL,
  description TEXT NULL,
  ip_address VARCHAR(80) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('active_year', '2026'),
  ('active_stage', '2')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

INSERT INTO reg_provinces (id, name) VALUES ('35', 'JAWA TIMUR')
ON DUPLICATE KEY UPDATE name = VALUES(name);
INSERT INTO reg_regencies (id, province_id, name) VALUES ('3509', '35', 'KABUPATEN JEMBER')
ON DUPLICATE KEY UPDATE name = VALUES(name);
