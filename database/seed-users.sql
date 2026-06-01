USE sim_pkh;

INSERT INTO users (username, password_hash, role, name, nik, nip, regency_id, district_id)
VALUES
  ('admin', '$2b$10$CLnEBlrwPvwJtZ2N3y87Dub.FKUMzCvynpJGAAAYcYTI82HWecylS', 'ADMIN', 'Admin Kabupaten Jember', NULL, '198705112010011001', '3509', NULL),
  ('pendamping', '$2b$10$bs5HnY1qHgeXLGA4xKJNDeRUnnHSGjTWW8i.QHuEWhylYExHS1ZFe', 'PENDAMPING', 'Siti Rahmawati', '3509106503920002', '199203182019032006', '3509', '350902')
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  name = VALUES(name),
  nik = VALUES(nik),
  nip = VALUES(nip),
  regency_id = VALUES(regency_id),
  district_id = VALUES(district_id);

INSERT INTO pendamping_profiles (user_id, nik, nip, name, district_id, regency_id)
SELECT u.id, u.nik, u.nip, u.name, u.district_id, u.regency_id
FROM users u
WHERE u.username = 'pendamping'
  AND NOT EXISTS (SELECT 1 FROM pendamping_profiles p WHERE p.user_id = u.id);
