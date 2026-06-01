ALTER TABLE p2k2_groups
  ADD COLUMN archived_at TIMESTAMP NULL AFTER stage;

UPDATE p2k2_groups g
JOIN pendamping_profiles p ON p.id = g.pendamping_id
SET g.archived_at = CURRENT_TIMESTAMP
WHERE g.archived_at IS NULL
  AND g.district_id IS NOT NULL
  AND g.district_id <> p.district_id
  AND g.year = COALESCE((SELECT CAST(setting_value AS UNSIGNED) FROM app_settings WHERE setting_key = 'active_year' LIMIT 1), YEAR(CURDATE()))
  AND g.stage = COALESCE((SELECT CAST(setting_value AS UNSIGNED) FROM app_settings WHERE setting_key = 'active_stage' LIMIT 1), 1);
