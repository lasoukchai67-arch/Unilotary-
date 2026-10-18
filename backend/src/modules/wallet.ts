import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError, notFound } from '../lib/errors.js';
import { withTx, type Db } from '../lib/infra.js';
import { BIG, currentUser, idParam, nextBefore, pageQuery, type Ctx } from '../lib/context.js';
import { audit, getSetting, notify } from '../lib/audit.js';
import { postLedger } from '../lib/ledger.js';
import { isDevTools } from '../config.js';
import { sign, type WebhookEvent } from '../providers/payments.js';
import { authenticate, pinSchema, requireRole, verifyPin } from './auth.js';

const fmt = (n: number) => n.toLocaleString('en-US');

const depositView = (p: Record<string, any>) => ({
  id: p.id,
  amount: p.amount,
  status: p.status,
  provider: p.provider,
  qrPayload: p.qr_payload,
  expiresAt: p.expires_at,
  createdAt: p.created_at,
});

export const withdrawalView = (w: Record<string, any>) => ({
  id: w.id,
  amount: w.amount,
  bankName: w.bank_name,
  accountNo: w.account_no,
  accountName: w.account_name,
  status: w.status,
  note: w.note,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  ...(w.user_phone ? { userId: w.user_id, userPhone: w.user_phone } : {}),
});

async function loadDeposit(db: Db, id: number, userId: number) {
  // ໝົດອາຍຸ = ຍັງ pending ແຕ່ກາຍເວລາ
  await db.query(`UPDATE payments SET status = 'expired' WHERE id = $1 AND status = 'pending' AND expires_at < now()`, [id]);
  const { rows } = await db.query('SELECT * FROM payments WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!rows[0]) throw notFound('ລາຍການເຕີມເງິນ');
  return depositView(rows[0]);
}

/** ປະມວນຜົນ webhook: idempotent, ກວດຍອດເງິນກົງກັນ */
export async function applyPaymentEvent(ctx: Ctx, provider: string, ev: WebhookEvent): Promise<void> {
  await withTx(ctx.db, async (c) => {
    const { rows } = await c.query('SELECT * FROM payments WHERE provider = $1 AND provider_ref = $2 FOR UPDATE', [provider, ev.providerRef]);
    const p = rows[0];
    if (!p) throw notFound('ລາຍການເຕີມເງິນ');
    if (p.status !== 'pending' && p.status !== 'expired') return; // ປະມວນຜົນແລ້ວ
    if (ev.status === 'success' && ev.amount !== p.amount) {
      await c.query(`UPDATE payments SET status = 'failed', raw_callback = $2, completed_at = now() WHERE id = $1`, [p.id, JSON.stringify(ev)]);
      await audit(c, { actorId: null, action: 'deposit.amount_mismatch', entity: 'payments', entityId: p.id, after: ev });
      return;
    }
    const status = ev.status === 'success' ? 'success' : 'failed';
    await c.query(`UPDATE payments SET status = $2, raw_callback = $3, completed_at = now() WHERE id = $1`, [p.id, status, JSON.stringify(ev)]);
    if (status === 'success') {
      await postLedger(c, { userId: p.user_id, type: 'deposit', amount: p.amount, refType: 'payment', refId: p.id, idempotencyKey: `deposit:${p.id}` });
      await notify(c, p.user_id, 'ເຕີມເງິນສຳເລັດ', `ໄດ້ຮັບ ${fmt(p.amount)} ກີບ ເຂົ້າກະເປົາແລ້ວ`, { paymentId: p.id });
    }
  });
}

async function finishWithdrawal(ctx: Ctx, id: number, actorId: number, ip: string) {
  // ຂັ້ນ 1: ລັອກ ແລະ ໝາຍວ່າ approved (ກັນການອະນຸມັດຊ້ຳ)
  const { rows } = await ctx.db.query(
    `UPDATE withdrawals SET status = 'approved', reviewed_by = $2, updated_at = now()
      WHERE id = $1 AND status = 'requested' AND user_id <> $2 RETURNING *`,
    [id, actorId],
  );
  if (!rows[0]) {
    const { rows: own } = await ctx.db.query('SELECT 1 FROM withdrawals WHERE id = $1 AND user_id = $2', [id, actorId]);
    if (own[0]) throw new AppError('FORBIDDEN', 'ອະນຸມັດການຖອນເງິນຂອງຕົນເອງບໍ່ໄດ້');
  }
  const w = rows[0];
  if (!w) throw new AppError('CONFLICT', 'ລາຍການນີ້ຖືກດຳເນີນການແລ້ວ');
  // ຂັ້ນ 2: ໂອນເງິນຜ່ານຜູ້ໃຫ້ບໍລິການ (ຢູ່ນອກ transaction ເພາະເປັນການເອີ້ນພາຍນອກ)
  let result: { providerRef: string; status: 'paid' | 'failed' };
  try {
    result = await ctx.payments.payout({ withdrawalId: w.id, amount: w.amount, bankName: w.bank_name, accountNo: w.account_no, accountName: w.account_name });
  } catch (err) {
    // ບໍ່ຮູ້ຜົນ → ຄ້າງໄວ້ທີ່ approved ໃຫ້ຝ່າຍການເງິນກວດກັບທະນາຄານ
    await audit(ctx.db, { actorId, action: 'withdraw.payout_error', entity: 'withdrawals', entityId: id, after: { message: (err as Error).message }, ip });
    throw err;
  }
  // ຂັ້ນ 3: ບັນທຶກຜົນ
  await withTx(ctx.db, async (c) => {
    await c.query(`UPDATE withdrawals SET status = $2, provider_ref = $3, updated_at = now() WHERE id = $1`, [id, result.status, result.providerRef]);
    if (result.status === 'paid') {
      await c.query('UPDATE wallets SET held = held - $1, updated_at = now() WHERE user_id = $2', [w.amount, w.user_id]);
      await notify(c, w.user_id, 'ຖອນເງິນສຳເລັດ', `ໂອນ ${fmt(w.amount)} ກີບ ເຂົ້າບັນຊີ ${w.bank_name} ແລ້ວ`, { withdrawalId: id });
    } else {
      await refundWithdrawal(c, w, 'ໂອນເງິນບໍ່ສຳເລັດ');
    }
    await audit(c, { actorId, action: `withdraw.${result.status}`, entity: 'withdrawals', entityId: id, after: result, ip });
  });
}

async function refundWithdrawal(c: pg.PoolClient, w: Record<string, any>, reason: string) {
  await postLedger(c, {
    userId: w.user_id,
    type: 'refund',
    amount: w.amount,
    holdDelta: -w.amount,
    refType: 'withdrawal',
    refId: w.id,
    idempotencyKey: `refund:withdrawal:${w.id}`,
    note: reason,
  });
  await notify(c, w.user_id, 'ການຖອນເງິນບໍ່ສຳເລັດ', `${reason}: ຄືນ ${fmt(w.amount)} ກີບ ເຂົ້າກະເປົາແລ້ວ`, { withdrawalId: w.id });
}

export function walletRoutes(app: FastifyInstance, ctx: Ctx) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const { db } = ctx;
  const auth = authenticate(ctx);

  r.get('/v1/wallet', { onRequest: auth, schema: { tags: ['wallet'] } }, async (req) => {
    const { rows } = await db.query('SELECT balance, held FROM wallets WHERE user_id = $1', [currentUser(req).id]);
    return { balance: rows[0]?.balance ?? 0, held: rows[0]?.held ?? 0 };
  });

  r.get('/v1/wallet/transactions', { onRequest: auth, schema: { tags: ['wallet'], querystring: pageQuery } }, async (req) => {
    const { limit, before } = req.query;
    const { rows } = await db.query(
      `SELECT t.* FROM wallet_transactions t JOIN wallets w ON w.id = t.wallet_id
        WHERE w.user_id = $1 AND t.id < $2 ORDER BY t.id DESC LIMIT $3`,
      [currentUser(req).id, before ?? BIG, limit],
    );
    const items = rows.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balance_after,
      refType: t.ref_type,
      refId: t.ref_id,
      note: t.note,
      createdAt: t.created_at,
    }));
    return { items, nextBefore: nextBefore(items, limit) };
  });

  r.post(
    '/v1/wallet/deposits',
    { onRequest: auth, schema: { tags: ['wallet'], body: z.object({ amount: z.number().int().positive() }) } },
    async (req, reply) => {
      const me = currentUser(req);
      const [min, max] = await Promise.all([getSetting(db, 'deposit_min'), getSetting(db, 'deposit_max')]);
      if (req.body.amount < Number(min) || req.body.amount > Number(max)) {
        throw new AppError('VALIDATION', `ເຕີມເງິນໄດ້ລະຫວ່າງ ${fmt(Number(min))}–${fmt(Number(max))} ກີບ`);
      }
      const id = await withTx(db, async (c) => {
        const { rows } = await c.query(
          `INSERT INTO payments (user_id, provider, amount, provider_ref, expires_at) VALUES ($1, $2, $3, 'pending:' || gen_random_uuid(), now()) RETURNING id`,
          [me.id, ctx.payments.name, req.body.amount],
        );
        const intent = await ctx.payments.createDeposit(rows[0].id, req.body.amount);
        await c.query('UPDATE payments SET provider_ref = $2, qr_payload = $3, expires_at = $4 WHERE id = $1', [
          rows[0].id,
          intent.providerRef,
          intent.qrPayload,
          intent.expiresAt,
        ]);
        return rows[0].id as number;
      });
      return reply.status(201).send(await loadDeposit(db, id, me.id));
    },
  );

  r.get('/v1/wallet/deposits/:id', { onRequest: auth, schema: { tags: ['wallet'], params: idParam } }, async (req) =>
    loadDeposit(db, req.params.id, currentUser(req).id),
  );

  r.post(
    '/v1/wallet/withdrawals',
    {
      onRequest: auth,
      schema: {
        tags: ['wallet'],
        body: z.object({
          amount: z.number().int().positive(),
          bankName: z.string().trim().min(2).max(60),
          accountNo: z.string().trim().regex(/^[0-9 -]{6,40}$/, 'ເລກບັນຊີບໍ່ຖືກຕ້ອງ'),
          accountName: z.string().trim().min(2).max(150),
          pin: pinSchema,
        }),
      },
    },
    async (req, reply) => {
      const me = currentUser(req);
      await verifyPin(db, me.id, req.body.pin);
      const [min, maxDaily] = await Promise.all([getSetting(db, 'withdraw_min'), getSetting(db, 'withdraw_max_daily')]);
      if (req.body.amount < Number(min)) throw new AppError('VALIDATION', `ຖອນຂັ້ນຕ່ຳ ${fmt(Number(min))} ກີບ`);
      const w = await withTx(db, async (c) => {
        const { rows: u } = await c.query('SELECT kyc FROM users WHERE id = $1', [me.id]);
        if (u[0].kyc !== 'verified') throw new AppError('USER_NOT_ALLOWED', 'ກະລຸນາຢືນຢັນຕົວຕົນ (KYC) ກ່ອນຖອນເງິນ', { reason: 'kyc' });
        const { rows: today } = await c.query(
          `SELECT COALESCE(SUM(amount), 0)::bigint AS s FROM withdrawals
            WHERE user_id = $1 AND status NOT IN ('rejected', 'failed')
              AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Vientiane') AT TIME ZONE 'Asia/Vientiane'`,
          [me.id],
        );
        if (today[0].s + req.body.amount > Number(maxDaily)) throw new AppError('VALIDATION', `ເກີນວົງເງິນຖອນຕໍ່ມື້ ${fmt(Number(maxDaily))} ກີບ`);
        const { rows } = await c.query(
          `INSERT INTO withdrawals (user_id, amount, bank_name, account_no, account_name) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [me.id, req.body.amount, req.body.bankName, req.body.accountNo, req.body.accountName],
        );
        await postLedger(c, {
          userId: me.id,
          type: 'withdraw',
          amount: -req.body.amount,
          holdDelta: req.body.amount,
          refType: 'withdrawal',
          refId: rows[0].id,
          idempotencyKey: `withdraw:${rows[0].id}`,
        });
        return rows[0];
      });
      return reply.status(201).send(withdrawalView(w));
    },
  );

  r.get('/v1/wallet/withdrawals', { onRequest: auth, schema: { tags: ['wallet'], querystring: pageQuery } }, async (req) => {
    const { limit, before } = req.query;
    const { rows } = await db.query('SELECT * FROM withdrawals WHERE user_id = $1 AND id < $2 ORDER BY id DESC LIMIT $3', [
      currentUser(req).id,
      before ?? BIG,
      limit,
    ]);
    const items = rows.map(withdrawalView);
    return { items, nextBefore: nextBefore(items, limit) };
  });

  // ---------- webhook ຈາກຜູ້ໃຫ້ບໍລິການ (ຕ້ອງການ raw body ເພື່ອກວດລາຍເຊັນ) ----------
  app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
    scope.post<{ Params: { provider: string } }>('/v1/webhooks/payments/:provider', async (req, reply) => {
      if (req.params.provider !== ctx.payments.name) throw notFound('ຜູ້ໃຫ້ບໍລິການ');
      const ev = ctx.payments.parseWebhook(req.body as Buffer, req.headers['x-signature'] as string | undefined);
      await applyPaymentEvent(ctx, ctx.payments.name, ev);
      return reply.send({ ok: true });
    });
  });

  // ---------- ເຄື່ອງມືທົດລອງ (ປິດໃນ production) ----------
  if (isDevTools(ctx.config) && ctx.payments.name === 'mock') {
    r.post(
      '/v1/dev/deposits/:id/simulate',
      { onRequest: auth, schema: { tags: ['dev'], params: idParam, body: z.object({ status: z.enum(['success', 'failed']) }) } },
      async (req) => {
        const me = currentUser(req);
        const { rows } = await db.query('SELECT provider_ref, amount FROM payments WHERE id = $1 AND user_id = $2', [req.params.id, me.id]);
        if (!rows[0]) throw notFound('ລາຍການເຕີມເງິນ');
        const body = JSON.stringify({ providerRef: rows[0].provider_ref, status: req.body.status, amount: rows[0].amount });
        const res = await app.inject({
          method: 'POST',
          url: '/v1/webhooks/payments/mock',
          headers: { 'content-type': 'application/json', 'x-signature': sign(ctx.config.PAYMENT_WEBHOOK_SECRET, body) },
          payload: body,
        });
        if (res.statusCode !== 200) throw new AppError('PROVIDER_ERROR', 'simulate failed', res.json());
        return loadDeposit(db, req.params.id, me.id);
      },
    );
  }

  // ---------- admin ----------
  const finance = [auth, requireRole('admin', 'finance')];
  const staff = [auth, requireRole('admin', 'finance', 'auditor')];

  r.get(
    '/v1/admin/withdrawals',
    {
      onRequest: staff,
      schema: { tags: ['admin'], querystring: pageQuery.extend({ status: z.enum(['requested', 'approved', 'paid', 'rejected', 'failed']).optional() }) },
    },
    async (req) => {
      const { limit, before, status } = req.query;
      const { rows } = await db.query(
        `SELECT w.*, u.phone AS user_phone FROM withdrawals w JOIN users u ON u.id = w.user_id
          WHERE ($1::withdrawal_status IS NULL OR w.status = $1) AND w.id < $2 ORDER BY w.id DESC LIMIT $3`,
        [status ?? null, before ?? BIG, limit],
      );
      const items = rows.map(withdrawalView);
      return { items, nextBefore: nextBefore(items, limit) };
    },
  );

  const adminWithdrawal = async (id: number) => {
    const { rows } = await db.query('SELECT w.*, u.phone AS user_phone FROM withdrawals w JOIN users u ON u.id = w.user_id WHERE w.id = $1', [id]);
    return withdrawalView(rows[0]);
  };

  r.post('/v1/admin/withdrawals/:id/approve', { onRequest: finance, schema: { tags: ['admin'], params: idParam } }, async (req) => {
    await finishWithdrawal(ctx, req.params.id, currentUser(req).id, req.ip);
    return adminWithdrawal(req.params.id);
  });

  r.post(
    '/v1/admin/withdrawals/:id/reject',
    { onRequest: finance, schema: { tags: ['admin'], params: idParam, body: z.object({ note: z.string().trim().min(2).max(500) }) } },
    async (req) => {
      const me = currentUser(req);
      await withTx(db, async (c) => {
        const { rows } = await c.query(
          `UPDATE withdrawals SET status = 'rejected', reviewed_by = $2, note = $3, updated_at = now()
            WHERE id = $1 AND status = 'requested' RETURNING *`,
          [req.params.id, me.id, req.body.note],
        );
        if (!rows[0]) throw new AppError('CONFLICT', 'ລາຍການນີ້ຖືກດຳເນີນການແລ້ວ');
        await refundWithdrawal(c, rows[0], `ຖືກປະຕິເສດ: ${req.body.note}`);
        await audit(c, { actorId: me.id, action: 'withdraw.reject', entity: 'withdrawals', entityId: req.params.id, after: req.body, ip: req.ip });
      });
      return adminWithdrawal(req.params.id);
    },
  );
}
