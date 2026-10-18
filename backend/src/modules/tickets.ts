// ຊື້ເລກ: validate → idempotency → ກວດງວດ/ຜູ້ໃຊ້ → ຈອງວົງເງິນໃນ Redis → transaction ໃນ Postgres.
// ຖ້າຂັ້ນຕອນໃດລົ້ມຫຼັງຈອງແລ້ວ ຈະຄືນວົງເງິນໃນ Redis ສະເໝີ.
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type pg from 'pg';
import { AppError, notFound } from '../lib/errors.js';
import { withTx, type Db } from '../lib/infra.js';
import { BIG, currentUser, idParam, nextBefore, pageQuery, type Ctx } from '../lib/context.js';
import { postLedger } from '../lib/ledger.js';
import { authenticate, phoneSchema, requireRole } from './auth.js';
import { ensureWarm, invalidate, release, reserve } from './limits.js';

export const linesSchema = z
  .array(
    z.object({
      number: z.string().regex(/^[0-9]{2,6}$/, 'ເລກຕ້ອງມີ 2–6 ໂຕ'),
      amount: z.number().int().positive(),
    }),
  )
  .min(1)
  .max(50);

export interface PurchaseInput {
  userId: number;
  drawId: number;
  idempotencyKey: string;
  lines: { number: string; amount: number }[];
  agentId?: number;
  buyerPhone?: string;
}

interface DigitRule {
  digits: number;
  payout_rate: string;
  min_amount: number;
  max_per_line: number;
  default_number_cap: number;
}

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const KEY_RE = /^[A-Za-z0-9_-]{8,80}$/;

// ---------- views ----------
const TICKET_SELECT = `
  SELECT t.*, d.draw_no,
         COALESCE(json_agg(json_build_object('number', l.number, 'digits', l.digits, 'amount', l.amount,
                  'payoutRate', l.payout_rate, 'winAmount', l.win_amount) ORDER BY l.id) FILTER (WHERE l.id IS NOT NULL), '[]') AS lines
    FROM tickets t
    JOIN draws d ON d.id = t.draw_id
    LEFT JOIN ticket_lines l ON l.ticket_id = t.id`;

export function ticketView(r: Record<string, any>) {
  return {
    id: r.id,
    ticketNo: r.ticket_no,
    verifyCode: r.verify_code,
    drawId: r.draw_id,
    drawNo: r.draw_no,
    status: r.status,
    totalAmount: r.total_amount,
    totalWin: r.total_win,
    createdAt: r.created_at,
    buyerPhone: r.buyer_phone,
    lines: (r.lines as any[]).map((l) => ({ ...l, payoutRate: Number(l.payoutRate) })),
  };
}

async function loadTicket(db: Db, where: string, params: unknown[]) {
  const { rows } = await db.query(`${TICKET_SELECT} WHERE ${where} GROUP BY t.id, d.draw_no`, params);
  return rows[0] ? ticketView(rows[0]) : null;
}

async function replay(db: Db, userId: number, key: string) {
  const t = await loadTicket(db, 't.user_id = $1 AND t.idempotency_key = $2', [userId, key]);
  if (!t) return null;
  const { rows } = await db.query(`SELECT balance_after FROM wallet_transactions WHERE ref_type = 'ticket' AND ref_id = $1 AND type = 'purchase'`, [t.id]);
  return { ...t, balanceAfter: rows[0]?.balance_after ?? null, replayed: true };
}

// ---------- purchase ----------
export async function purchase(ctx: Ctx, input: PurchaseInput) {
  const { db, redis } = ctx;
  const parsed = linesSchema.safeParse(input.lines);
  if (!parsed.success) throw new AppError('VALIDATION', 'ຂໍ້ມູນບໍ່ຖືກຕ້ອງ', parsed.error.issues);
  if (!KEY_RE.test(input.idempotencyKey)) throw new AppError('VALIDATION', 'Idempotency-Key ບໍ່ຖືກຕ້ອງ');
  const lines = parsed.data;

  const existing = await replay(db, input.userId, input.idempotencyKey);
  if (existing) return existing;

  const { rows: drawRows } = await db.query(
    'SELECT id, status, now() BETWEEN sales_open_at AND sales_close_at AS in_window FROM draws WHERE id = $1',
    [input.drawId],
  );
  const draw = drawRows[0];
  if (!draw) throw notFound('ງວດ');
  if (draw.status !== 'open' || !draw.in_window) throw new AppError('DRAW_NOT_OPEN', 'ງວດນີ້ປິດຮັບແລ້ວ');

  const { rows: ruleRows } = await db.query<DigitRule>('SELECT * FROM draw_digit_rules WHERE draw_id = $1', [input.drawId]);
  const rules = new Map(ruleRows.map((r) => [r.digits, r]));
  for (const l of lines) {
    const rule = rules.get(l.number.length);
    if (!rule) throw new AppError('VALIDATION', `ງວດນີ້ບໍ່ຂາຍເລກ ${l.number.length} ໂຕ`);
    if (l.amount < rule.min_amount || l.amount > rule.max_per_line) {
      throw new AppError('VALIDATION', `ເລກ ${l.number}: ຈຳນວນເງິນຕ້ອງຢູ່ລະຫວ່າງ ${rule.min_amount}–${rule.max_per_line} ກີບ`);
    }
  }

  const perNumber = new Map<string, number>();
  for (const l of lines) perNumber.set(l.number, (perNumber.get(l.number) ?? 0) + l.amount);
  const total = lines.reduce((s, l) => s + l.amount, 0);

  await ensureWarm(db, redis, input.drawId);
  const failures = await reserve(redis, input.drawId, perNumber);
  if (failures.length > 0) throw new AppError('NUMBER_LIMIT', 'ມີເລກທີ່ເຕັມວົງເງິນ ຫຼື ປິດຮັບ', failures);

  try {
    return await withTx(db, (c) => writeTicket(c, input, lines, perNumber, total, rules));
  } catch (err) {
    await release(redis, input.drawId, perNumber);
    const e = err as { code?: string; constraint?: string };
    if (e.code === UNIQUE_VIOLATION && e.constraint === 'tickets_user_id_idempotency_key_key') {
      const t = await replay(db, input.userId, input.idempotencyKey);
      if (t) return t;
    }
    if (e.code === CHECK_VIOLATION && e.constraint === 'number_sales_within_cap') {
      // Redis ກັບ DB ບໍ່ກົງກັນ (ເຊັ່ນ Redis restart): DB ກັນບໍ່ໃຫ້ຂາຍເກີນ ແລ້ວໂຫຼດ Redis ໃໝ່
      await invalidate(redis, input.drawId);
      throw new AppError('NUMBER_LIMIT', 'ມີເລກທີ່ເຕັມວົງເງິນ');
    }
    throw err;
  }
}

async function writeTicket(
  c: pg.PoolClient,
  input: PurchaseInput,
  lines: { number: string; amount: number }[],
  perNumber: Map<string, number>,
  total: number,
  rules: Map<number, DigitRule>,
) {
  // FOR SHARE: ການປິດງວດ (UPDATE draws) ຕ້ອງລໍຖ້າ → ບໍ່ມີບິນຫຼຸດເຂົ້າຫຼັງປິດ
  const { rows: d } = await c.query(
    `SELECT draw_no FROM draws WHERE id = $1 AND status = 'open' AND now() < sales_close_at FOR SHARE`,
    [input.drawId],
  );
  if (!d[0]) throw new AppError('DRAW_NOT_OPEN', 'ງວດນີ້ປິດຮັບແລ້ວ');

  const { rows: u } = await c.query(
    `SELECT u.status, u.kyc, u.daily_spend_cap, u.self_excluded_until > now() AS excluded, w.balance
       FROM users u JOIN wallets w ON w.user_id = u.id
      WHERE u.id = $1 FOR UPDATE OF w`,
    [input.userId],
  );
  const user = u[0];
  if (!user) throw notFound('ຜູ້ໃຊ້');
  if (user.status !== 'active' || user.kyc !== 'verified') {
    throw new AppError('USER_NOT_ALLOWED', 'ກະລຸນາຢືນຢັນຕົວຕົນ (KYC) ກ່ອນຊື້', { reason: user.kyc !== 'verified' ? 'kyc' : 'status' });
  }
  if (user.excluded) throw new AppError('USER_NOT_ALLOWED', 'ທ່ານໄດ້ພັກການຫຼິ້ນໄວ້', { reason: 'self_excluded' });
  if (user.balance < total) throw new AppError('INSUFFICIENT_BALANCE', 'ເງິນໃນກະເປົາບໍ່ພໍ', { balance: user.balance, total });

  if (user.daily_spend_cap !== null) {
    const { rows: s } = await c.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS spent FROM tickets
        WHERE user_id = $1 AND status <> 'cancelled'
          AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Vientiane') AT TIME ZONE 'Asia/Vientiane'`,
      [input.userId],
    );
    if (s[0].spent + total > user.daily_spend_cap) {
      throw new AppError('DAILY_CAP', 'ເກີນວົງເງິນຊື້ຕໍ່ມື້ທີ່ຕັ້ງໄວ້', { cap: user.daily_spend_cap, spent: s[0].spent });
    }
  }

  const numbers = [...perNumber.keys()];
  const { rows: overrides } = await c.query(
    'SELECT number, cap, payout_rate, is_closed FROM number_limits WHERE draw_id = $1 AND number = ANY($2)',
    [input.drawId, numbers],
  );
  const ov = new Map(overrides.map((o) => [o.number as string, o]));
  if (overrides.some((o) => o.is_closed)) throw new AppError('NUMBER_LIMIT', 'ມີເລກທີ່ປິດຮັບ');

  // ດ່ານສຸດທ້າຍ: CHECK (sold_amount <= cap)
  for (const [num, amt] of perNumber) {
    const cap = ov.get(num)?.cap ?? rules.get(num.length)!.default_number_cap;
    await c.query(
      `INSERT INTO number_sales (draw_id, number, sold_amount, cap) VALUES ($1, $2, $3, $4)
       ON CONFLICT (draw_id, number) DO UPDATE
         SET sold_amount = number_sales.sold_amount + EXCLUDED.sold_amount, cap = EXCLUDED.cap`,
      [input.drawId, num, amt, cap],
    );
  }

  const { rows: seq } = await c.query(`SELECT nextval('ticket_seq') AS n`);
  const ticketNo = `LT-${d[0].draw_no}-${String(seq[0].n).padStart(6, '0')}`;
  const { rows: t } = await c.query(
    `INSERT INTO tickets (ticket_no, draw_id, user_id, sold_by_agent_id, buyer_phone, channel, total_amount, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [ticketNo, input.drawId, input.userId, input.agentId ?? null, input.buyerPhone ?? null, input.agentId ? 'agent' : 'app', total, input.idempotencyKey],
  );
  const ticketId: number = t[0].id;

  const rates = lines.map((l) => Number(ov.get(l.number)?.payout_rate ?? rules.get(l.number.length)!.payout_rate));
  await c.query(
    `INSERT INTO ticket_lines (ticket_id, draw_id, number, amount, payout_rate)
     SELECT $1, $2, * FROM unnest($3::varchar[], $4::bigint[], $5::numeric[])`,
    [ticketId, input.drawId, lines.map((l) => l.number), lines.map((l) => l.amount), rates],
  );

  const posted = await postLedger(c, {
    userId: input.userId,
    type: 'purchase',
    amount: -total,
    refType: 'ticket',
    refId: ticketId,
    idempotencyKey: `purchase:${input.userId}:${input.idempotencyKey}`,
  });

  if (input.agentId) {
    await c.query(
      `INSERT INTO commissions (agent_id, ticket_id, amount)
       SELECT id, $2, ($3::bigint * commission_bp) / 10000 FROM users WHERE id = $1 AND role = 'agent'`,
      [input.agentId, ticketId, total],
    );
  }

  const view = await loadTicket(c, 't.id = $1', [ticketId]);
  return { ...view!, balanceAfter: posted!.balance, replayed: false };
}

// ---------- routes ----------
const keyHeader = z.object({ 'idempotency-key': z.string().regex(KEY_RE, 'Idempotency-Key ບໍ່ຖືກຕ້ອງ') }).passthrough();

export function ticketRoutes(app: FastifyInstance, ctx: Ctx) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const auth = authenticate(ctx);

  r.post(
    '/v1/draws/:drawId/tickets',
    {
      onRequest: auth,
      schema: { tags: ['tickets'], params: z.object({ drawId: z.coerce.number().int().positive() }), headers: keyHeader, body: z.object({ lines: linesSchema }) },
    },
    async (req, reply) => {
      const t = await purchase(ctx, {
        userId: currentUser(req).id,
        drawId: req.params.drawId,
        idempotencyKey: req.headers['idempotency-key'],
        lines: req.body.lines,
      });
      return reply.status(t.replayed ? 200 : 201).send(t);
    },
  );

  r.get('/v1/tickets', { onRequest: auth, schema: { tags: ['tickets'], querystring: pageQuery } }, async (req) => {
    const { limit, before } = req.query;
    const { rows } = await ctx.db.query(
      `${TICKET_SELECT} WHERE t.user_id = $1 AND t.id < $2 GROUP BY t.id, d.draw_no ORDER BY t.id DESC LIMIT $3`,
      [currentUser(req).id, before ?? BIG, limit],
    );
    const items = rows.map(ticketView);
    return { items, nextBefore: nextBefore(items, limit) };
  });

  r.get('/v1/tickets/:id', { onRequest: auth, schema: { tags: ['tickets'], params: idParam } }, async (req) => {
    const t = await loadTicket(ctx.db, 't.id = $1 AND t.user_id = $2', [req.params.id, currentUser(req).id]);
    if (!t) throw notFound('ບິນ');
    return t;
  });

  r.get(
    '/v1/tickets/verify/:ticketNo',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: { tags: ['tickets'], params: z.object({ ticketNo: z.string().max(30) }), querystring: z.object({ code: z.string().max(16) }) },
    },
    async (req) => {
      const t = await loadTicket(ctx.db, 't.ticket_no = $1 AND t.verify_code = upper($2)', [req.params.ticketNo, req.query.code]);
      if (!t) throw notFound('ບິນ (ເລກບິນ ຫຼື ລະຫັດບໍ່ຖືກຕ້ອງ)');
      return {
        ticketNo: t.ticketNo,
        drawNo: t.drawNo,
        status: t.status,
        totalAmount: t.totalAmount,
        totalWin: t.totalWin,
        createdAt: t.createdAt,
        lines: t.lines.map((l) => ({ number: l.number, amount: l.amount })),
      };
    },
  );

  // ---------- ຕົວແທນ ----------
  const agentOnly = [auth, requireRole('agent')];

  r.post(
    '/v1/agent/sales',
    {
      onRequest: agentOnly,
      schema: {
        tags: ['agent'],
        headers: keyHeader,
        body: z.object({ drawId: z.number().int().positive(), buyerPhone: phoneSchema.optional(), lines: linesSchema }),
      },
    },
    async (req, reply) => {
      const me = currentUser(req);
      const t = await purchase(ctx, {
        userId: me.id,
        agentId: me.id,
        drawId: req.body.drawId,
        buyerPhone: req.body.buyerPhone,
        idempotencyKey: req.headers['idempotency-key'],
        lines: req.body.lines,
      });
      return reply.status(t.replayed ? 200 : 201).send(t);
    },
  );

  r.get('/v1/agent/summary', { onRequest: agentOnly, schema: { tags: ['agent'] } }, async (req) => {
    const { rows } = await ctx.db.query(
      `SELECT COALESCE(SUM(t.total_amount) FILTER (WHERE t.status <> 'cancelled'), 0)::bigint AS sales,
              COUNT(t.id) FILTER (WHERE t.status <> 'cancelled')::int AS tickets,
              COALESCE(SUM(c.amount) FILTER (WHERE NOT c.settled AND t.status <> 'cancelled'), 0)::bigint AS pending,
              COALESCE(SUM(c.amount) FILTER (WHERE c.settled), 0)::bigint AS settled
         FROM tickets t LEFT JOIN commissions c ON c.ticket_id = t.id
        WHERE t.sold_by_agent_id = $1`,
      [currentUser(req).id],
    );
    const s = rows[0];
    return { sales: s.sales, tickets: s.tickets, commissionPending: s.pending, commissionSettled: s.settled };
  });
}
