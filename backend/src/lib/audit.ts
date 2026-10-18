import type { Db } from './infra.js';

export async function audit(
  db: Db,
  a: { actorId: number | null; action: string; entity: string; entityId?: string | number; before?: unknown; after?: unknown; ip?: string },
): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs (actor_id, action, entity, entity_id, before_data, after_data, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      a.actorId,
      a.action,
      a.entity,
      a.entityId === undefined ? null : String(a.entityId),
      a.before === undefined ? null : JSON.stringify(a.before),
      a.after === undefined ? null : JSON.stringify(a.after),
      a.ip ?? null,
    ],
  );
}

export async function getSetting<T = number>(db: Db, key: string): Promise<T> {
  const { rows } = await db.query('SELECT value FROM settings WHERE key = $1', [key]);
  if (!rows[0]) throw new Error(`missing setting ${key}`);
  return rows[0].value as T;
}

export async function notify(db: Db, userId: number, title: string, body: string, data?: unknown): Promise<void> {
  await db.query('INSERT INTO notifications (user_id, title, body, data) VALUES ($1, $2, $3, $4)', [
    userId,
    title,
    body,
    data === undefined ? null : JSON.stringify(data),
  ]);
}
