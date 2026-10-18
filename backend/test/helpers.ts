import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { loadConfig } from '../src/config.js';
import { createInfra } from '../src/lib/infra.js';
import { MockSms } from '../src/providers/sms.js';
import { MockPayments } from '../src/providers/payments.js';
import { migrate } from '../src/migrate.js';
import { buildApp } from '../src/app.js';
import { hashPin } from '../src/modules/auth.js';
import type { Ctx } from '../src/lib/context.js';

export const PIN = '135790';

export interface TestEnv {
  ctx: Ctx;
  app: FastifyInstance;
  sms: MockSms;
  payments: MockPayments;
  close(): Promise<void>;
}

/** ສ້າງ DB ໃໝ່ສຳລັບແຕ່ລະໄຟລ໌ test ເພື່ອບໍ່ໃຫ້ຂໍ້ມູນປົນກັນ */
export async function setup(): Promise<TestEnv> {
  const base = process.env.DATABASE_URL!;
  const dbName = `t_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();
  const url = new URL(base);
  url.pathname = `/${dbName}`;

  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: url.toString(),
    JWT_SECRET: 'test-secret-test-secret-test-secret-123',
    PAYMENT_WEBHOOK_SECRET: 'test-webhook-secret',
    UPLOAD_DIR: mkdtempSync(path.join(tmpdir(), 'uploads-')),
    REDIS_URL: `${process.env.REDIS_URL}`,
    RATE_LIMIT_ENABLED: 'false',
    SCHEDULER_ENABLED: 'false',
  });
  await migrate(config.DATABASE_URL, () => {});
  const infra = createInfra(config);
  await infra.redis.flushdb();
  const sms = new MockSms();
  const payments = new MockPayments(config.PAYMENT_WEBHOOK_SECRET);
  const ctx: Ctx = { config, ...infra, sms, payments };
  const app = await buildApp(ctx);
  await app.ready();
  return {
    ctx,
    app,
    sms,
    payments,
    async close() {
      await app.close();
      await infra.db.end();
      infra.redis.disconnect();
    },
  };
}

let phoneSeq = 0;
export const newPhone = () => `020${String(Date.now() % 1e5).padStart(5, '0')}${String(++phoneSeq).padStart(3, '0')}`;

export interface TestUser {
  id: number;
  phone: string;
  token: string;
  headers: Record<string, string>;
}

/** ສ້າງຜູ້ໃຊ້ຜ່ານ OTP ແທ້ ແລ້ວປັບ role/kyc/ຍອດເງິນໃນ DB ໂດຍກົງ */
export async function makeUser(
  env: TestEnv,
  opts: { role?: string; kyc?: string; balance?: number; pin?: boolean; commissionBp?: number } = {},
): Promise<TestUser> {
  const phone = newPhone();
  const r1 = await env.app.inject({ method: 'POST', url: '/v1/auth/otp/request', payload: { phone } });
  const code = r1.json().devCode;
  const r2 = await env.app.inject({ method: 'POST', url: '/v1/auth/otp/verify', payload: { phone, code } });
  const body = r2.json();
  const id = body.user.id;
  const { db } = env.ctx;
  await db.query(`UPDATE users SET role = $2, kyc = $3, commission_bp = $4, pin_hash = $5 WHERE id = $1`, [
    id,
    opts.role ?? 'customer',
    opts.kyc ?? 'verified',
    opts.commissionBp ?? 0,
    opts.pin === false ? null : await hashPin(PIN),
  ]);
  if (opts.balance) await credit(env, id, opts.balance);
  // OTP cooldown ບໍ່ໃຫ້ຂັດ test ອື່ນທີ່ໃຊ້ເບີດຽວກັນ
  await env.ctx.redis.del(`otp:cool:${phone}`, `otp:hour:${phone}`);
  return { id, phone, token: body.accessToken, headers: { authorization: `Bearer ${body.accessToken}` } };
}

/** ເຕີມເງິນຜ່ານ ledger (ຄືກັບເງິນເຂົ້າຈາກທະນາຄານ) ເພື່ອໃຫ້ balance = SUM(ledger) ສະເໝີ */
export async function credit(env: TestEnv, userId: number, amount: number) {
  const { rows } = await env.ctx.db.query(
    `UPDATE wallets SET balance = balance + $2 WHERE user_id = $1 RETURNING id, balance`,
    [userId, amount],
  );
  await env.ctx.db.query(
    `INSERT INTO wallet_transactions (wallet_id, type, amount, balance_after, ref_type, idempotency_key) VALUES ($1, 'adjust', $2, $3, 'test', $4)`,
    [rows[0].id, amount, rows[0].balance, `test:${randomUUID()}`],
  );
}

export async function balanceOf(env: TestEnv, userId: number) {
  const { rows } = await env.ctx.db.query('SELECT balance, held FROM wallets WHERE user_id = $1', [userId]);
  return rows[0] as { balance: number; held: number };
}

/** balance ຕ້ອງເທົ່າກັບຜົນລວມຂອງ ledger ສະເໝີ */
export async function assertLedgerConsistent(env: TestEnv) {
  const { rows } = await env.ctx.db.query(
    `SELECT w.user_id, w.balance, COALESCE(SUM(t.amount), 0)::bigint AS sum
       FROM wallets w LEFT JOIN wallet_transactions t ON t.wallet_id = w.id
      GROUP BY w.id HAVING w.balance <> COALESCE(SUM(t.amount), 0)`,
  );
  if (rows.length) throw new Error(`ledger mismatch: ${JSON.stringify(rows)}`);
}

export const DEFAULT_RULES = [
  { digits: 2, payoutRate: 60, minAmount: 1000, maxPerLine: 100000, defaultNumberCap: 100000 },
  { digits: 3, payoutRate: 400, minAmount: 1000, maxPerLine: 50000, defaultNumberCap: 50000 },
  { digits: 6, payoutRate: 100000, minAmount: 1000, maxPerLine: 10000, defaultNumberCap: 20000 },
];

let drawSeq = 0;
/** ສ້າງງວດຜ່ານ API ຂອງແອັດມິນ ແລ້ວເປີດ */
export async function openDraw(env: TestEnv, admin: TestUser, rules = DEFAULT_RULES): Promise<number> {
  const now = Date.now();
  const res = await env.app.inject({
    method: 'POST',
    url: '/v1/admin/draws',
    headers: admin.headers,
    payload: {
      drawNo: `T${++drawSeq}${now % 10000}`,
      drawDate: new Date(now).toISOString().slice(0, 10),
      salesOpenAt: new Date(now - 3600_000).toISOString(),
      salesCloseAt: new Date(now + 3600_000).toISOString(),
      rules,
    },
  });
  if (res.statusCode !== 201) throw new Error(res.body);
  const id = res.json().id;
  const o = await env.app.inject({ method: 'POST', url: `/v1/admin/draws/${id}/open`, headers: admin.headers });
  if (o.statusCode !== 200) throw new Error(o.body);
  return id;
}

export const key = () => `k-${randomUUID()}`;

export async function buy(env: TestEnv, user: TestUser, drawId: number, lines: { number: string; amount: number }[], k = key()) {
  return env.app.inject({
    method: 'POST',
    url: `/v1/draws/${drawId}/tickets`,
    headers: { ...user.headers, 'idempotency-key': k },
    payload: { lines },
  });
}
