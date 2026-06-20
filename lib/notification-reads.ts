import { query } from "./db";

export async function getReadNotificationIds(userId: number, notificationIds: string[]) {
  if (!notificationIds.length) return new Set<string>();
  await ensureNotificationReadsTable();
  const placeholders = notificationIds.map(() => "?").join(",");
  const rows = await query<{ notificationId: string }>(
    `SELECT notification_id AS notificationId
     FROM notification_reads
     WHERE user_id = ? AND notification_id IN (${placeholders})`,
    [userId, ...notificationIds]
  );
  return new Set(rows.map((row) => row.notificationId));
}

export async function markNotificationsRead(userId: number, notificationIds: string[]) {
  const ids = [...new Set(notificationIds.map((id) => id.trim()).filter(Boolean))].slice(0, 100);
  if (!ids.length) return;
  await ensureNotificationReadsTable();
  for (const id of ids) {
    await query(
      `INSERT INTO notification_reads (user_id, notification_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP`,
      [userId, id]
    );
  }
  await query("DELETE FROM notification_reads WHERE read_at < DATE_SUB(NOW(), INTERVAL 180 DAY)");
}

async function ensureNotificationReadsTable() {
  await query(`CREATE TABLE IF NOT EXISTS notification_reads (
    user_id BIGINT NOT NULL,
    notification_id VARCHAR(190) NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, notification_id),
    INDEX idx_notification_read_at (read_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8`);
}
