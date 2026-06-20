ALTER TABLE art_members
  ADD COLUMN health_component_type VARCHAR(20) NULL AFTER health_slot_no;

ALTER TABLE health_visit_verifications
  ADD COLUMN component_type VARCHAR(20) NOT NULL DEFAULT 'LANSIA' AFTER elder_slot_no;

ALTER TABLE health_visit_verifications
  ADD UNIQUE KEY uniq_health_visit_component_month
    (kpm_id, component_type, elder_slot_no, year, month);

ALTER TABLE health_visit_verifications
  DROP INDEX uniq_health_visit_month;
