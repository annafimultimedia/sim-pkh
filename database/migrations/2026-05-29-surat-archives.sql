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
