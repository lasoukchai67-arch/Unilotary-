import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { BIG, currentUser, idParam, nextBefore, pageQuery, type Ctx } from '../lib/context.js';
import { authenticate } from './auth.js';

export function notificationRoutes(app: FastifyInstance, ctx: Ctx) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const auth = authenticate(ctx);

  r.get('/v1/notifications', { onRequest: auth, schema: { tags: ['notifications'], querystring: pageQuery } }, async (req) => {
    const me = currentUser(req);
    const { limit, before } = req.query;
    const [list, unread] = await Promise.all([
      ctx.db.query('SELECT * FROM notifications WHERE user_id = $1 AND id < $2 ORDER BY id DESC LIMIT $3', [me.id, before ?? BIG, limit]),
      ctx.db.query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [me.id]),
    ]);
    const items = list.rows.map((n) => ({ id: n.id, title: n.title, body: n.body, data: n.data, readAt: n.read_at, createdAt: n.created_at }));
    return { items, nextBefore: nextBefore(items, limit), unread: unread.rows[0].n };
  });

  r.post('/v1/notifications/:id/read', { onRequest: auth, schema: { tags: ['notifications'], params: idParam } }, async (req, reply) => {
    await ctx.db.query('UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL', [req.params.id, currentUser(req).id]);
    return reply.status(204).send();
  });

  r.post('/v1/notifications/read-all', { onRequest: auth, schema: { tags: ['notifications'] } }, async (req, reply) => {
    await ctx.db.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [currentUser(req).id]);
    return reply.status(204).send();
  });
}
