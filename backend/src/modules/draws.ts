import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError, notFound } from '../lib/errors.js';
import { withTx, type Db } from '../lib/infra.js';
import { BIG, currentUser, idParam, nextBefore, pageQuery, type Ctx } from '../lib/context.js';
import { audit } from '../lib/audit.js';
import { authenticate, requireRole } from './auth.js';
import { applyNumberLimit, dropDraw, ensureWarm } from './limits.js';
import { refundDraw, settleDraw } from './settlement.js';

const statusEnum = z.enum(['scheduled', 'open', 'closed', 'resulted', 'cancelled']);

async function loadRules(db: Db, drawIds: number[]) {
  const { rows } = await db.query('SELECT * FROM draw_digit_rules WHERE draw_id = ANY($1) ORDER BY digits', [drawIds]);
  const by = new Map<number, any[]>();
  for (const r of rows) by.set(r.draw_id, [...(by.get(r.draw_id) ?? []), r]);
  return by;
}

/** viewer = id ຂອງພະນັກງານທີ່ເບິ່ງ (undefined = ສາທາລະນະ) */
function drawView(d: Record<string, any>, rules: any[], viewer?: number) {
  const admin = viewer !== undefined;
  return {
    id: d.id,
    drawNo: d.draw_no,
    drawDate: d.draw_date instanceof Date ? d.draw_date.toISOString().slice(0, 10) : d.draw_date,
    salesOpenAt: d.sales_open_at,
    salesCloseAt: d.sales_close_at,
    status: d.status,
    resultNumber: d.result_number,
    resultedAt: d.resulted_at,
    rules: rules.map((r) => ({
      digits: r.digits,
      payoutRate: Number(r.payout_rate),
      minAmount: r.min_amount,
      maxPerLine: r.max_per_line,
      ...(admin ? { defaultNumberCap: r.default_number_cap } : {}),
    })),
    serverTime: new Date().toISOString(),
    ...(admin
      ? {
          // ເລກທີ່ລໍຖ້າຢືນຢັນ ເຫັນໄດ້ສະເພາະຄົນທີ່ປ້ອນ, ຜູ້ຢືນຢັນຕ້ອງພິມເອງ
          pendingResult: d.result_entered_by === viewer ? d.pending_result : null,
          hasPendingResult: d.pending_result != null,
          resultEnteredBy: d.result_entered_by,
          stats: { sales: d.sales ?? 0, tickets: d.tickets ?? 0 },
        }
      : {}),
  };
}

const ADMIN_SELECT = `
  SELECT d.*, s.sales, s.tickets FROM draws d
  LEFT JOIN LATERAL (SELECT COALESCE(SUM(total_amount), 0)::bigint AS sales, COUNT(*)::int AS tickets
                       FROM tickets WHERE draw_id = d.id AND status <> 'cancelled') s ON true`;

async function views(db: Db, rows: any[], viewer?: number) {
  const rules = await loadRules(db, rows.map((r) => r.id));
  return rows.map((r) => drawView(r, rules.get(r.id) ?? [], viewer));
}

export async function loadAdminDraw(db: Db, id: number, viewer: number) {
  const { rows } = await db.query(`${ADMIN_SELECT} WHERE d.id = $1`, [id]);
  if (!rows[0]) throw notFound('ງວດ');
  return (await views(db, rows, viewer))[0];
}

export async function currentDraw(db: Db, viewer?: number) {
  const admin = viewer !== undefined;
  const { rows } = await db.query(
    `${admin ? ADMIN_SELECT : 'SELECT d.* FROM draws d'}
      WHERE d.status IN ('open', 'scheduled')
      ORDER BY (d.status = 'open') DESC, d.sales_close_at ASC LIMIT 1`,
  );
  return rows[0] ? (await views(db, rows, viewer))[0] : null;
}

const ruleSchema = z.object({
  digits: z.number().int().min(2).max(6),
  payoutRate: z.number().positive(),
  minAmount: z.number().int().positive(),
  maxPerLine: z.number().int().positive(),
  defaultNumberCap: z.number().int().positive(),
});

export function drawRoutes(app: FastifyInstance, ctx: Ctx) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const { db, redis } = ctx;

  // ---------- public ----------
  r.get('/v1/draws/current', { schema: { tags: ['draws'] } }, async () => {
    const d = await currentDraw(db);
    if (!d) throw notFound('ງວດທີ່ເປີດຂາຍ');
    return d;
  });

  r.get(
    '/v1/draws',
    { schema: { tags: ['draws'], querystring: z.object({ status: statusEnum.optional(), limit: z.coerce.number().int().min(1).max(100).default(20) }) } },
    async (req) => {
      const { rows } = await db.query(
        `SELECT * FROM draws WHERE ($1::draw_status IS NULL OR status = $1) ORDER BY sales_close_at DESC LIMIT $2`,
        [req.query.status ?? null, req.query.limit],
      );
      return { items: await views(db, rows) };
    },
  );

  r.get('/v1/draws/:id', { schema: { tags: ['draws'], params: idParam } }, async (req) => {
    const { rows } = await db.query('SELECT * FROM draws WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('ງວດ');
    return (await views(db, rows))[0];
  });

  // ---------- admin ----------
  const staff = [authenticate(ctx), requireRole('admin', 'finance', 'auditor')];
  const adminOnly = [authenticate(ctx), requireRole('admin')];

  r.get(
    '/v1/admin/draws',
    { onRequest: staff, schema: { tags: ['admin'], querystring: pageQuery.extend({ status: statusEnum.optional() }) } },
    async (req) => {
      const { limit, before, status } = req.query;
      const { rows } = await db.query(
        `${ADMIN_SELECT} WHERE ($1::draw_status IS NULL OR d.status = $1) AND d.id < $2 ORDER BY d.id DESC LIMIT $3`,
        [status ?? null, before ?? BIG, limit],
      );
      const items = await views(db, rows, currentUser(req).id);
      return { items, nextBefore: nextBefore(items, limit) };
    },
  );

  r.get('/v1/admin/draws/:id', { onRequest: staff, schema: { tags: ['admin'], params: idParam } }, async (req) =>
    loadAdminDraw(db, req.params.id, currentUser(req).id),
  );

  r.post(
    '/v1/admin/draws',
    {
      onRequest: adminOnly,
      schema: {
        tags: ['admin'],
        body: z
          .object({
            drawNo: z.string().trim().regex(/^[A-Za-z0-9-]{1,20}$/),
            drawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            salesOpenAt: z.string().datetime({ offset: true }),
            salesCloseAt: z.string().datetime({ offset: true }),
            rules: z.array(ruleSchema).min(1).max(5),
          })
          .refine((b) => new Date(b.salesCloseAt) > new Date(b.salesOpenAt), { message: 'ເວລາປິດຕ້ອງຫຼັງເວລາເປີດ', path: ['salesCloseAt'] })
          .refine((b) => new Set(b.rules.map((x) => x.digits)).size === b.rules.length, { message: 'ປະເພດເລກຊ້ຳ', path: ['rules'] }),
      },
    },
    async (req, reply) => {
      const me = currentUser(req);
      const b = req.body;
      const id = await withTx(db, async (c) => {
        const { rows } = await c.query(
          `INSERT INTO draws (draw_no, draw_date, sales_open_at, sales_close_at, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [b.drawNo, b.drawDate, b.salesOpenAt, b.salesCloseAt, me.id],
        ).catch((e) => {
          if (e.code === '23505') throw new AppError('CONFLICT', 'ເລກງວດນີ້ມີແລ້ວ');
          throw e;
        });
        for (const rule of b.rules) {
          await c.query(
            `INSERT INTO draw_digit_rules (draw_id, digits, payout_rate, min_amount, max_per_line, default_number_cap)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [rows[0].id, rule.digits, rule.payoutRate, rule.minAmount, rule.maxPerLine, rule.defaultNumberCap],
          );
        }
        await audit(c, { actorId: me.id, action: 'draw.create', entity: 'draws', entityId: rows[0].id, after: b, ip: req.ip });
        return rows[0].id as number;
      });
      return reply.status(201).send(await loadAdminDraw(db, id, currentUser(req).id));
    },
  );

  const transition = (path: string, from: string[], to: string, action: string) =>
    r.post(path, { onRequest: adminOnly, schema: { tags: ['admin'], params: idParam } }, async (req) => {
      const me = currentUser(req);
      const { rows } = await db.query(
        `UPDATE draws SET status = $2 WHERE id = $1 AND status = ANY($3::draw_status[]) RETURNING id`,
        [req.params.id, to, from],
      );
      if (!rows[0]) throw new AppError('CONFLICT', 'ສະຖານະງວດບໍ່ອະນຸຍາດ');
      if (to === 'open') await ensureWarm(db, redis, req.params.id);
      await audit(db, { actorId: me.id, action, entity: 'draws', entityId: req.params.id, ip: req.ip });
      return loadAdminDraw(db, req.params.id, currentUser(req).id);
    });
  transition('/v1/admin/draws/:id/open', ['scheduled'], 'open', 'draw.open');
  transition('/v1/admin/draws/:id/close', ['open'], 'closed', 'draw.close');

  r.post(
    '/v1/admin/draws/:id/cancel',
    { onRequest: adminOnly, schema: { tags: ['admin'], params: idParam, body: z.object({ reason: z.string().trim().min(3).max(500) }) } },
    async (req) => {
      const me = currentUser(req);
      const refunded = await withTx(db, async (c) => {
        const { rows } = await c.query(
          `UPDATE draws SET status = 'cancelled' WHERE id = $1 AND status IN ('scheduled', 'open', 'closed') RETURNING id`,
          [req.params.id],
        );
        if (!rows[0]) throw new AppError('CONFLICT', 'ຍົກເລີກງວດນີ້ບໍ່ໄດ້');
        const n = await refundDraw(c, req.params.id);
        await audit(c, { actorId: me.id, action: 'draw.cancel', entity: 'draws', entityId: req.params.id, after: { reason: req.body.reason, refunded: n }, ip: req.ip });
        return n;
      });
      await dropDraw(redis, req.params.id);
      req.log.info({ drawId: req.params.id, refunded }, 'draw cancelled');
      return loadAdminDraw(db, req.params.id, currentUser(req).id);
    },
  );

  r.get(
    '/v1/admin/draws/:id/exposure',
    {
      onRequest: staff,
      schema: {
        tags: ['admin'],
        params: idParam,
        querystring: z.object({ digits: z.coerce.number().int().min(2).max(6).default(2), limit: z.coerce.number().int().min(1).max(500).default(50) }),
      },
    },
    async (req) => {
      const { rows } = await db.query(
        `SELECT n.number, n.sold, COALESCE(l.cap, r.default_number_cap) AS cap,
                COALESCE(l.payout_rate, r.payout_rate) AS rate, COALESCE(l.is_closed, false) AS closed
           FROM (SELECT number, SUM(amount)::bigint AS sold FROM ticket_lines tl JOIN tickets t ON t.id = tl.ticket_id
                  WHERE tl.draw_id = $1 AND tl.digits = $2 AND t.status <> 'cancelled' GROUP BY number
                 UNION
                 SELECT number, 0 FROM number_limits WHERE draw_id = $1 AND length(number) = $2
                   AND number NOT IN (SELECT number FROM ticket_lines WHERE draw_id = $1)) n
           JOIN draw_digit_rules r ON r.draw_id = $1 AND r.digits = $2
           LEFT JOIN number_limits l ON l.draw_id = $1 AND l.number = n.number
          ORDER BY n.sold * COALESCE(l.payout_rate, r.payout_rate) DESC, n.number
          LIMIT $3`,
        [req.params.id, req.query.digits, req.query.limit],
      );
      return {
        items: rows.map((x) => ({
          number: x.number,
          sold: x.sold,
          cap: x.cap,
          payoutRate: Number(x.rate),
          exposure: Math.floor(x.sold * Number(x.rate)),
          closed: x.closed,
        })),
      };
    },
  );

  r.put(
    '/v1/admin/draws/:id/numbers/:number/limit',
    {
      onRequest: adminOnly,
      schema: {
        tags: ['admin'],
        params: z.object({ id: z.coerce.number().int().positive(), number: z.string().regex(/^[0-9]{2,6}$/) }),
        body: z.object({ cap: z.number().int().min(0).nullable(), payoutRate: z.number().positive().nullable(), closed: z.boolean() }),
      },
    },
    async (req, reply) => {
      const me = currentUser(req);
      const { id, number } = req.params;
      await withTx(db, async (c) => {
        const { rows: d } = await c.query('SELECT status FROM draws WHERE id = $1', [id]);
        if (!d[0]) throw notFound('ງວດ');
        const { rows: rule } = await c.query('SELECT 1 FROM draw_digit_rules WHERE draw_id = $1 AND digits = $2', [id, number.length]);
        if (!rule[0]) throw new AppError('VALIDATION', `ງວດນີ້ບໍ່ຂາຍເລກ ${number.length} ໂຕ`);
        const { rows: before } = await c.query('SELECT * FROM number_limits WHERE draw_id = $1 AND number = $2', [id, number]);
        await c.query(
          `INSERT INTO number_limits (draw_id, number, cap, payout_rate, is_closed, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())
           ON CONFLICT (draw_id, number) DO UPDATE
             SET cap = EXCLUDED.cap, payout_rate = EXCLUDED.payout_rate, is_closed = EXCLUDED.is_closed,
                 updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [id, number, req.body.cap, req.body.payoutRate, req.body.closed, me.id],
        );
        await audit(c, { actorId: me.id, action: 'limit.update', entity: 'number_limits', entityId: `${id}:${number}`, before: before[0] ?? null, after: req.body, ip: req.ip });
      });
      await applyNumberLimit(redis, id, number, req.body.cap, req.body.closed);
      return reply.status(204).send();
    },
  );

  // ---------- ຜົນລາງວັນ: maker → checker ----------
  const resultBody = z.object({ resultNumber: z.string().regex(/^\d{6}$/, 'ຜົນຕ້ອງເປັນເລກ 6 ໂຕ') });

  r.post('/v1/admin/draws/:id/result', { onRequest: adminOnly, schema: { tags: ['admin'], params: idParam, body: resultBody } }, async (req) => {
    const me = currentUser(req);
    const { rows } = await db.query(
      `UPDATE draws SET pending_result = $2, result_entered_by = $3
        WHERE id = $1 AND status = 'closed' AND pending_result IS NULL RETURNING id`,
      [req.params.id, req.body.resultNumber, me.id],
    );
    if (!rows[0]) throw new AppError('CONFLICT', 'ງວດຕ້ອງປິດແລ້ວ ແລະ ຍັງບໍ່ມີຜົນທີ່ລໍຖ້າຢືນຢັນ');
    await audit(db, { actorId: me.id, action: 'result.enter', entity: 'draws', entityId: req.params.id, after: req.body, ip: req.ip });
    return loadAdminDraw(db, req.params.id, currentUser(req).id);
  });

  r.post(
    '/v1/admin/draws/:id/result/approve',
    { onRequest: adminOnly, schema: { tags: ['admin'], params: idParam, body: resultBody } },
    async (req) => {
      const me = currentUser(req);
      const settlement = await withTx(db, async (c) => {
        const { rows } = await c.query('SELECT status, pending_result, result_entered_by FROM draws WHERE id = $1 FOR UPDATE', [req.params.id]);
        const d = rows[0];
        if (!d) throw notFound('ງວດ');
        if (d.status !== 'closed' || !d.pending_result) throw new AppError('CONFLICT', 'ບໍ່ມີຜົນທີ່ລໍຖ້າຢືນຢັນ');
        if (d.result_entered_by === me.id) throw new AppError('FORBIDDEN', 'ຕ້ອງໃຫ້ແອັດມິນອີກຄົນເປັນຜູ້ຢືນຢັນ');
        if (d.pending_result !== req.body.resultNumber) {
          await audit(c, { actorId: me.id, action: 'result.mismatch', entity: 'draws', entityId: req.params.id, ip: req.ip });
          throw new AppError('CONFLICT', 'ເລກທີ່ຢືນຢັນບໍ່ກົງກັບເລກທີ່ປ້ອນ, ກະລຸນາກວດຄືນ');
        }
        await c.query(
          `UPDATE draws SET status = 'resulted', result_number = pending_result, pending_result = NULL,
                            result_approved_by = $2, resulted_at = now() WHERE id = $1`,
          [req.params.id, me.id],
        );
        const s = await settleDraw(c, req.params.id, req.body.resultNumber);
        await audit(c, { actorId: me.id, action: 'result.approve', entity: 'draws', entityId: req.params.id, after: { ...req.body, ...s }, ip: req.ip });
        return s;
      });
      await dropDraw(redis, req.params.id);
      return { draw: await loadAdminDraw(db, req.params.id, currentUser(req).id), settlement };
    },
  );

  r.post('/v1/admin/draws/:id/result/reject', { onRequest: adminOnly, schema: { tags: ['admin'], params: idParam } }, async (req) => {
    const me = currentUser(req);
    const { rows } = await db.query(
      `UPDATE draws SET pending_result = NULL, result_entered_by = NULL WHERE id = $1 AND status = 'closed' AND pending_result IS NOT NULL RETURNING id`,
      [req.params.id],
    );
    if (!rows[0]) throw new AppError('CONFLICT', 'ບໍ່ມີຜົນທີ່ລໍຖ້າຢືນຢັນ');
    await audit(db, { actorId: me.id, action: 'result.reject', entity: 'draws', entityId: req.params.id, ip: req.ip });
    return loadAdminDraw(db, req.params.id, currentUser(req).id);
  });
}
