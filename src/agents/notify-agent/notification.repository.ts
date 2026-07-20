import { randomUUID } from "node:crypto";
import type { AgentDb } from "../../shared/db/client";

export type NotificationType = "task" | "new_file" | "important_doc" | "license" | "update" | "security" | "backup" | "achievement";

export interface NotificationRow {
  id: string;
  type: NotificationType;
  titleTh: string;
  messageTh: string;
  isRead: boolean;
  createdAt: string;
}

export function insertNotification(
  db: AgentDb,
  userId: string,
  agentId: string,
  type: NotificationType,
  titleTh: string,
  messageTh: string,
): void {
  db.prepare(`
    INSERT INTO notifications (id, user_id, agent_id, type, title_th, message_th)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), userId, agentId, type, titleTh, messageTh);
}

export function listNotifications(db: AgentDb, userId: string, unreadOnly: boolean, limit = 20): NotificationRow[] {
  const rows = db
    .prepare(`
      SELECT id, type, title_th as titleTh, message_th as messageTh, is_read as isRead, created_at as createdAt
      FROM notifications
      WHERE user_id = ? ${unreadOnly ? "AND is_read = 0" : ""}
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(userId, limit);
  return (rows as unknown as Array<Omit<NotificationRow, "isRead"> & { isRead: number }>).map((row) => ({
    ...row,
    isRead: Boolean(row.isRead),
  }));
}

export function countUnread(db: AgentDb, userId: string): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0").get(userId) as {
    count: number;
  };
  return row.count;
}

export function markRead(db: AgentDb, notificationId: string): void {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(notificationId);
}

export function markAllRead(db: AgentDb, userId: string): void {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(userId);
}
