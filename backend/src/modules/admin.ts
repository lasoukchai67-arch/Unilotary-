import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError, notFound } from '../lib/errors.js';
import { withTx } from '../lib/infra.js';
import { BIG, currentUser, idParam, nextBefore, pageQuery, type Ctx } from '../lib/context.js';
import { audit, notify } from '../lib/audit.js';
import { authenticate, requireRole } from './auth.js';
import { USER_SELECT, loadUser, userView } from './users.js';
import { currentDraw } from './draws.js';
import { payPayout } from './settlement.js';

const TODAY = `date_trunc('day', now() AT TIME ZONE 'Asia/Vientiane') AT TIME ZONE 'Asia/Vientiane'`;

const SETTING_SCHEMAS: Record<string, z.ZodType<number>> = {
  payout_auto_limit: z.number().int().min(0),
  deposit_min: z.number().int().positive(),
  deposit_max: z.number().int().positive(),
  withdraw_min: z.number().int().positive(),
  withdraw_max_daily: z.number().int().positive(),
};

const payoutView = (p: Record<string, any>) => ({
  id: p.id,
  ticketId: p.ticket_id,
  ticketNo: p.ticket_no,
  userId: p.user_id,
  userPhone: p.user_phone,
  amount: p.amount,
  status: p.status,
  createdAt: p.created_at,
});

export function adminRoutes(app: FastifyInstance, ctx: Ctx) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const { db } = ctx;
  const auth = authenticate(ctx);
  const staff = [auth, requireRole('admin', 'finance', 'auditor')];
  const finance = [auth, requireRole('admin', 'finance')];
  const adminOnly = [auth, requireRole('admin')];

  r.get('/v1/admin/dashboard', { onRequest: staff, schema: { tags: ['admin'] } }, async () => {
    const { rows } = await db.query(`
      SELECT
        (SELECT COALESCE(SUM(total_amount), 0) FROM tickets WHERE status <> 'cancelled' AND created_at >= ${TODAY})::bigint AS sales,
        (SELECT COUNT(*) FROM tickets WHERE status <> 'cancelled' AND created_at >= ${TODAY})::int AS tickets,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'success' AND completed_at >= ${TODAY})::bigint AS deposits,
        (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'paid' AND updated_at >= ${TODAY})::bigint AS withdrawals,
        (SELECT COUNT(*) FROM users)::int AS users_total,
        (SELECT COUNT(*) FROM users WHERE kyc = 'verified')::int AS users_verified,
        (SELECT COUNT(*) FROM users WHERE kyc = 'pending')::int AS p_kyc,
        (SELECT COUNT(*) FROM withdrawals WHERE status = 'requested')::int AS p_withdrawals,
        (SELECT COUNT(*) FROM payouts WHERE status = 'pending')::int AS p_payouts,
        (SELECT COUNT(*) FROM draws WHERE status = 'closed')::int AS p_results`);
    const s = rows[0];
    return {
      today: { sales: s.sales, tickets: s.tickets, deposits: s.deposits, withdrawals: s.withdrawals },
      users: { total: s.users_total, verified: s.users_verified },
      pending: { kyc: s.p_kyc, withdrawals: s.p_withdrawals, payouts: s.p_payouts, results: s.p_results },
      currentDraw: await currentDraw(db, true),
    };
  });

  // ---------- KYC ----------
  r.get(
    '/v1/admin/kyc',
    { onRequest: staff, schema: { tags: ['admin'], querystring: pageQuery.extend({ status: z.enum(['pending', 'verified', 'rejected']).default('pending') }) } },
    async (req) => {
      const { limit, before, status } = req.query;
      const { rows } = await db.query(
        `SELECT id, phone, full_name, birth_date, id_card_no, kyc, kyc_submitted_at FROM users
          WHERE kyc = $1 AND id < $2 ORDER BY id DESC LIMIT $3`,
        [status, before ?? BIG, limit],
      );
      const items = rows.map((u) => ({
        id: u.id,
        userId: u.id,
        phone: u.phone,
        fullName: u.full_name,
        birthDate: u.birth_date instanceof Date ? u.birth_date.toISOString().slice(0, 10) : u.birth_date,
        idCardNo: u.id_card_no,
        kyc: u.kyc,
        submittedAt: u.kyc_submitted_at,
      }));
      return { items: items.map(({ id, ...rest }) => rest), nextBefore: nextBefore(items, limit) };
    },
  );

  r.get(
    '/v1/admin/kyc/:userId/document',
    { onRequest: staff, schema: { tags: ['admin'], params: z.object({ userId: z.coerce.number().int().positive() }) } },
    async (req, reply) => {
      const { rows } = await db.query('SELECT kyc_doc_path FROM users WHERE id = $1', [req.params.userId]);
      const file = rows[0]?.kyc_doc_path as string | undefined;
      const root = path.resolve(ctx.config.UPLOAD_DIR);
      if (!file || !path.resolve(file).startsWith(root)) throw notFound('ເອກະສານ');
      await stat(file).catch(() => {
        throw notFound('ເອກະສານ');
      });
      await audit(db, { actorId: currentUser(req).id, action: 'kyc.view_document', entity: 'users', entityId: req.params.userId, ip: req.ip });
      reply.header('cache-control', 'no-store');
      return reply.type(file.endsWith('.png') ? 'image/png' : 'image/jpeg').send(createReadStream(file));
    },
  );

  const kycDecision = (decision: 'verified' | 'rejected') =>
    r.post(
      `/v1/admin/kyc/:userId/${decision === 'verified' ? 'approve' : 'reject'}`,
      {
        onRequest: adminOnly,
        schema: {
          tags: ['admin'],
          params: z.object({ userId: z.coerce.number().int().positive() }),
          body: decision === 'verified' ? z.object({}).optional() : z.object({ note: z.string().trim().min(2).max(500) }),
        },
      },
      async (req) => {
        const me = currentUser(req);
        const note = (req.body as { note?: string } | undefined)?.note ?? null;
        await withTx(db, async (c) => {
          const { rows } = await c.query(
            `UPDATE users SET kyc = $2, kyc_reviewed_by = $3, kyc_note = $4 WHERE id = $1 AND kyc = 'pending' RETURNING id`,
            [req.params.userId, decision, me.id, note],
          );
          if (!rows[0]) throw new AppError('CONFLICT', 'ບໍ່ມີຄຳຂໍທີ່ລໍຖ້າກວດ');
          await notify(
            c,
            req.params.userId,
            decision === 'verified' ? 'ຢືນຢັນຕົວຕົນສຳເລັດ' : 'ການຢືນຢັນຕົວຕົນບໍ່ຜ່ານ',
            decision === 'verified' ? 'ທ່ານສາມາດຊື້ຫວຍ ແລະ ຖອນເງິນໄດ້ແລ້ວ' : `ເຫດຜົນ: ${note}. ກະລຸນາສົ່ງຂໍ້ມູນໃໝ່`,
          );
          await audit(c, { actorId: me.id, action: `kyc.${decision}`, entity: 'users', entityId: req.params.userId, after: { note }, ip: req.ip });
        });
        return loadUser(db, req.params.userId);
      },
    );
  kycDecision('verified');
  kycDecision('rejected');

  // ---------- ລາງວັນຍອດໃຫຍ່ ----------
  r.get(
    '/v1/admin/payouts',
    { onRequest: staff, schema: { tags: ['admin'], querystring: pageQuery.extend({ status: z.enum(['pending', 'paid', 'rejected']).optional() }) } },
    async (req) => {
      const { limit, before, status } = req.query;
      const { rows } = await db.query(
        `SELECT p.*, t.ticket_no, u.phone AS user_phone FROM payouts p
           JOIN tickets t ON t.id = p.ticket_id JOIN users u ON u.id = p.user_id
          WHERE ($1::payout_status IS NULL OR p.status = $1) AND p.id < $2 ORDER BY p.id DESC LIMIT $3`,
        [status ?? null, before ?? BIG, limit],
      );
      const items = rows.map(payoutView);
      return { items, nextBefore: nextBefore(items, limit) };
    },
  );

  const loadPayout = async (id: number) => {
    const { rows } = await db.query(
      `SELECT p.*, t.ticket_no, u.phone AS user_phone FROM payouts p JOIN tickets t ON t.id = p.ticket_id JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
      [id],
    );
    if (!rows[0]) throw notFound('ລາຍການຈ່າຍລາງວັນ');
    return payoutView(rows[0]);
  };

  r.post('/v1/admin/payouts/:id/approve', { onRequest: finance, schema: { tags: ['admin'], params: idParam } }, async (req) => {
    const me = currentUser(req);
    await withTx(db, async (c) => {
      const { rows } = await c.query(`SELECT status FROM payouts WHERE id = $1 FOR UPDATE`, [req.params.id]);
      if (!rows[0]) throw notFound('ລາຍການຈ່າຍລາງວັນ');
      if (rows[0].status !== 'pending') throw new AppError('CONFLICT', 'ລາຍການນີ້ຖືກດຳເນີນການແລ້ວ');
      await payPayout(c, req.params.id, me.id);
      await audit(c, { actorId: me.id, action: 'payout.approve', entity: 'payouts', entityId: req.params.id, ip: req.ip });
    });
    return loadPayout(req.params.id);
  });

  r.post(
    '/v1/admin/payouts/:id/reject',
    { onRequest: finance, schema: { tags: ['admin'], params: idParam, body: z.object({ note: z.string().trim().min(2).max(500) }) } },
    async (req) => {
      const me = currentUser(req);
      await withTx(db, async (c) => {
        const { rows } = await c.query(`UPDATE payouts SET status = 'rejected', approved_by = $2 WHERE id = $1 AND status = 'pending' RETURNING user_id`, [
          req.params.id,
          me.id,
        ]);
        if (!rows[0]) throw new AppError('CONFLICT', 'ລາຍການນີ້ຖືກດຳເນີນການແລ້ວ');
        await audit(c, { actorId: me.id, action: 'payout.reject', entity: 'payouts', entityId: req.params.id, after: req.body, ip: req.ip });
      });
      return loadPayout(req.params.id);
    },
  );

  // ---------- ຜູ້ໃຊ້ ----------
  r.get(
    '/v1/admin/users',
    {
      onRequest: staff,
      schema: {
        tags: ['admin'],
        querystring: pageQuery.extend({ q: z.string().trim().max(100).optional(), role: z.enum(['customer', 'agent', 'admin', 'finance', 'auditor']).optional() }),
      },
    },
    async (req) => {
      const { limit, before, q, role } = req.query;
      const { rows } = await db.query(
        `${USER_SELECT}
          WHERE ($1::text IS NULL OR u.phone LIKE '%' || $1 || '%' OR u.full_name ILIKE '%' || $1 || '%')
            AND ($2::user_role IS NULL OR u.role = $2) AND u.id < $3
          ORDER BY u.id DESC LIMIT $4`,
        [q || null, role ?? null, before ?? BIG, limit],
      );
      const items = rows.map(userView);
      return { items, nextBefore: nextBefore(items, limit) };
    },
  );

  r.patch(
    '/v1/admin/users/:id',
    {
      onRequest: adminOnly,
      schema: {
        tags: ['admin'],
        params: idParam,
        body: z.object({
          role: z.enum(['customer', 'agent', 'admin', 'finance', 'auditor']).optional(),
          status: z.enum(['active', 'suspended', 'closed']).optional(),
          commissionBp: z.number().int().min(0).max(10000).optional(),
        }),
      },
    },
    async (req) => {
      const me = currentUser(req);
      if (req.params.id === me.id && (req.body.role || req.body.status)) throw new AppError('FORBIDDEN', 'ປ່ຽນສິດ ຫຼື ສະຖານະຂອງຕົນເອງບໍ່ໄດ້');
      const before = await loadUser(db, req.params.id);
      await withTx(db, async (c) => {
        await c.query(
          `UPDATE users SET role = COALESCE($2, role), status = COALESCE($3, status), commission_bp = COALESCE($4, commission_bp) WHERE id = $1`,
          [req.params.id, req.body.role ?? null, req.body.status ?? null, req.body.commissionBp ?? null],
        );
        if (req.body.status && req.body.status !== 'active') {
          await c.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [req.params.id]);
        }
        await audit(c, { actorId: me.id, action: 'user.update', entity: 'users', entityId: req.params.id, before, after: req.body, ip: req.ip });
      });
      return loadUser(db, req.params.id);
    },
  );

  // ---------- Audit ----------
  r.get('/v1/admin/audit', { onRequest: staff, schema: { tags: ['admin'], querystring: pageQuery } }, async (req) => {
    const { limit, before } = req.query;
    const { rows } = await db.query(
      `SELECT a.*, u.phone AS actor_phone FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
        WHERE a.id < $1 ORDER BY a.id DESC LIMIT $2`,
      [before ?? BIG, limit],
    );
    const items = rows.map((a) => ({
      id: a.id,
      actorId: a.actor_id,
      actorPhone: a.actor_phone,
      action: a.action,
      entity: a.entity,
      entityId: a.entity_id,
      before: a.before_data,
      after: a.after_data,
      createdAt: a.created_at,
    }));
    return { items, nextBefore: nextBefore(items, limit) };
  });

  // ---------- ຕັ້ງຄ່າ ----------
  r.get('/v1/admin/settings', { onRequest: staff, schema: { tags: ['admin'] } }, async () => {
    const { rows } = await db.query('SELECT key, value FROM settings ORDER BY key');
    return { items: rows };
  });

  r.put(
    '/v1/admin/settings/:key',
    { onRequest: adminOnly, schema: { tags: ['admin'], params: z.object({ key: z.string() }), body: z.object({ value: z.unknown() }) } },
    async (req) => {
      const me = currentUser(req);
      const schema = SETTING_SCHEMAS[req.params.key];
      if (!schema) throw notFound('ການຕັ້ງຄ່າ');
      const parsed = schema.safeParse(req.body.value);
      if (!parsed.success) throw new AppError('VALIDATION', 'ຄ່າບໍ່ຖືກຕ້ອງ', parsed.error.issues);
      const { rows: before } = await db.query('SELECT value FROM settings WHERE key = $1', [req.params.key]);
      await db.query('UPDATE settings SET value = $2, updated_by = $3, updated_at = now() WHERE key = $1', [
        req.params.key,
        JSON.stringify(parsed.data),
        me.id,
      ]);
      await audit(db, { actorId: me.id, action: 'settings.update', entity: 'settings', entityId: req.params.key, before: before[0]?.value, after: parsed.data, ip: req.ip });
      return { key: req.params.key, value: parsed.data };
    },
  );

  // ---------- ລາຍງານ ----------
  r.get('/v1/admin/reports/draws/:id', { onRequest: staff, schema: { tags: ['admin'], params: idParam } }, async (req) => {
    const { rows: d } = await db.query('SELECT draw_no, status, result_number FROM draws WHERE id = $1', [req.params.id]);
    if (!d[0]) throw notFound('ງວດ');
    const [byDigits, totals, payouts, comm] = await Promise.all([
      db.query(
        `SELECT l.digits, SUM(l.amount)::bigint AS amount, COUNT(*)::int AS lines FROM ticket_lines l JOIN tickets t ON t.id = l.ticket_id
          WHERE l.draw_id = $1 AND t.status <> 'cancelled' GROUP BY l.digits ORDER BY l.digits`,
        [req.params.id],
      ),
      db.query(`SELECT COALESCE(SUM(total_amount), 0)::bigint AS total, COUNT(*)::int AS tickets FROM tickets WHERE draw_id = $1 AND status <> 'cancelled'`, [
        req.params.id,
      ]),
      db.query(
        `SELECT COALESCE(SUM(p.amount), 0)::bigint AS total,
                COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0)::bigint AS paid,
                COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'pending'), 0)::bigint AS pending
           FROM payouts p JOIN tickets t ON t.id = p.ticket_id WHERE t.draw_id = $1 AND p.status <> 'rejected'`,
        [req.params.id],
      ),
      db.query(`SELECT COALESCE(SUM(c.amount), 0)::bigint AS total FROM commissions c JOIN tickets t ON t.id = c.ticket_id WHERE t.draw_id = $1 AND t.status <> 'cancelled'`, [
        req.params.id,
      ]),
    ]);
    const sales = totals.rows[0];
    const p = payouts.rows[0];
    return {
      drawNo: d[0].draw_no,
      status: d[0].status,
      resultNumber: d[0].result_number,
      sales: { total: sales.total, tickets: sales.tickets, byDigits: byDigits.rows },
      payouts: p,
      commissions: comm.rows[0].total,
      net: sales.total - p.total - comm.rows[0].total,
    };
  });
}
