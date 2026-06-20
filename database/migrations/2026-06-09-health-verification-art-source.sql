ALTER TABLE art_members
  ADD COLUMN entry_source VARCHAR(20) NOT NULL DEFAULT 'IMPORT',
  ADD COLUMN health_kpm_id BIGINT NULL,
  ADD COLUMN health_slot_no INT NULL,
  ADD INDEX idx_art_health_slot (health_kpm_id, health_slot_no);
