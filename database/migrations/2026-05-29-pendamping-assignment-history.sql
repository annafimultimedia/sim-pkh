ALTER TABLE p2k2_groups
  ADD COLUMN district_id CHAR(6) NULL AFTER pendamping_id,
  ADD COLUMN regency_id CHAR(4) NULL AFTER district_id;

UPDATE p2k2_groups g
JOIN pendamping_profiles p ON p.id = g.pendamping_id
SET g.district_id = COALESCE(g.district_id, p.district_id),
    g.regency_id = COALESCE(g.regency_id, p.regency_id);

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

INSERT INTO pendamping_assignment_history (pendamping_id, user_id, district_id, regency_id, started_at, note)
SELECT p.id, p.user_id, p.district_id, p.regency_id, CURDATE(), 'Riwayat awal dari data pendamping aktif'
FROM pendamping_profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM pendamping_assignment_history h WHERE h.pendamping_id = p.id
);
