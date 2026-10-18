// ເຂົ້າສູ່ລະບົບດ້ວຍ OTP ທາງ SMS → access token (JWT 15 ນາທີ) + refresh token (ໝູນວຽນທຸກເທື່ອທີ່ໃຊ້).
import { createHash, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import type pg from 'pg';
import { AppError } from '../lib/errors.js';
import { withTx, type Db } from '../lib/infra.js';
import type { Ctx, Role } from '../lib/context.js';
import { MockSms } from '../providers/sms.js';
import { loadUser } from './users.js';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const OTP_TTL = 300;
const OTP_MAX_ATTEMPTS = 5;
const PIN_MAX_FAILS = 5;

export function normalizePhone(input: string): string {
  let p = input.replace(/[\s-]/g, '');
  if (p.startsWith('+856')) p = '0' + p.slice(4);
  else if (p.startsWith('856')) p = '0' + p.slice(3);
  if (!/^(020\d{8}|030\d{7})$/.test(p)) throw new AppError('VALIDATION', 'ເບີໂທບໍ່ຖືກຕ້ອງ (020XXXXXXXX ຫຼື 030XXXXXXX)');
  return p;
}

export const phoneSchema = z.string().min(8).max(20).transform((v, ctx) => {
  try {
    return normalizePhone(v);
  } catch (e) {
    ctx.addIssue({ code: 'custom', message: (e as Error).message });
    return z.NEVER;
  }
});

export const pinSchema = z.string().regex(/^\d{6}$/, 'PIN ຕ້ອງເປັນຕົວເລກ 6 ໂຕ');

// ---------- OTP ----------
async function requestOtp(ctx: Ctx, phone: string) {
  const { redis, sms } = ctx;
  if ((await redis.set(`otp:cool:${phone}`, '1', 'EX', 60, 'NX')) !== 'OK') {
    throw new AppError('RATE_LIMITED', 'ກະລຸນາລໍຖ້າ 1 ນາທີ ກ່ອນຂໍລະຫັດໃໝ່');
  }
  const hourKey = `otp:hour:${phone}`;
  const n = await redis.incr(hourKey);
  if (n === 1) await redis.expire(hourKey, 3600);
  if (n > 5) throw new AppError('RATE_LIMITED', 'ຂໍລະຫັດເກີນກຳນົດ, ກະລຸນາລອງໃໝ່ໃນ 1 ຊົ່ວໂມງ');

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await redis.multi().del(`otp:${phone}`).hset(`otp:${phone}`, 'h', sha256(`${phone}:${code}`), 'a', '0').expire(`otp:${phone}`, OTP_TTL).exec();
  await sms.send(phone, `ລະຫັດຢືນຢັນຂອງທ່ານ: ${code} (ໃຊ້ໄດ້ 5 ນາທີ). ຫ້າມບອກລະຫັດນີ້ໃຫ້ຜູ້ອື່ນ.`);
  return { expiresInSec: OTP_TTL, ...(sms instanceof MockSms ? { devCode: code } : {}) };
}

async function checkOtp(ctx: Ctx, phone: string, code: string): Promise<void> {
  const key = `otp:${phone}`;
  const stored = await ctx.redis.hgetall(key);
  if (!stored.h) throw new AppError('UNAUTHORIZED', 'ລະຫັດໝົດອາຍຸ, ກະລຸນາຂໍລະຫັດໃໝ່');
  const ok = timingSafeEqual(Buffer.from(stored.h), Buffer.from(sha256(`${phone}:${code}`)));
  if (!ok) {
    const attempts = await ctx.redis.hincrby(key, 'a', 1);
    if (attempts >= OTP_MAX_ATTEMPTS) await ctx.redis.del(key);
    throw new AppError('UNAUTHORIZED', 'ລະຫັດບໍ່ຖືກຕ້ອງ');
  }
  await ctx.redis.del(key);
}

// ---------- Tokens ----------
const secretKey = (ctx: Ctx) => new TextEncoder().encode(ctx.config.JWT_SECRET);

async function issueTokens(ctx: Ctx, db: Db, userId: number, role: Role, userAgent?: string) {
  const accessToken = await new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${ctx.config.ACCESS_TOKEN_TTL_SEC}s`)
    .sign(secretKey(ctx));
  const refreshToken = randomBytes(32).toString('base64url');
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(days => $4))`,
    [userId, sha256(refreshToken), userAgent ?? null, ctx.config.REFRESH_TOKEN_TTL_DAYS],
  );
  return { accessToken, refreshToken, expiresInSec: ctx.config.ACCESS_TOKEN_TTL_SEC };
}

async function ensureUser(c: pg.PoolClient, phone: string): Promise<{ id: number; role: Role; status: string }> {
  const { rows } = await c.query(
    `INSERT INTO users (phone) VALUES ($1) ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id, role, status`,
    [phone],
  );
  await c.query('INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [rows[0].id]);
  return rows[0];
}

async function refresh(ctx: Ctx, token: string, userAgent?: string) {
  const out = await withTx(ctx.db, async (c) => {
    const { rows } = await c.query(
      `SELECT r.id, r.user_id, r.revoked_at, r.expires_at < now() AS expired, u.role, u.status
         FROM refresh_tokens r JOIN users u ON u.id = r.user_id
        WHERE r.token_hash = $1 FOR UPDATE OF r`,
      [sha256(token)],
    );
    const t = rows[0];
    if (!t || t.expired) throw new AppError('UNAUTHORIZED', 'ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່');
    if (t.revoked_at) {
      // token ທີ່ຖືກໃຊ້ແລ້ວຖືກນຳມາໃຊ້ຊ້ຳ = ອາດຖືກລັກ → ຍົກເລີກທຸກ session ຂອງຜູ້ໃຊ້ນີ້
      // (ຕ້ອງ commit ກ່ອນ throw, ບໍ່ດັ່ງນັ້ນການຍົກເລີກຈະຖືກ rollback)
      await c.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [t.user_id]);
      return null;
    }
    if (t.status !== 'active') throw new AppError('FORBIDDEN', 'ບັນຊີຖືກລະງັບ');
    await c.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [t.id]);
    const tokens = await issueTokens(ctx, c, t.user_id, t.role, userAgent);
    return { ...tokens, userId: t.user_id as number };
  });
  if (!out) throw new AppError('UNAUTHORIZED', 'ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່');
  return out;
}

// ---------- Guards ----------
export function authenticate(ctx: Ctx) {
  return async (req: FastifyRequest) => {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) throw new AppError('UNAUTHORIZED', 'ກະລຸນາເຂົ້າສູ່ລະບົບ');
    let sub: string | undefined;
    try {
      const { payload } = await jwtVerify(h.slice(7), secretKey(ctx), { algorithms: ['HS256'] });
      sub = payload.sub;
    } catch {
      throw new AppError('UNAUTHORIZED', 'session ໝົດອາຍຸ');
    }
    // ອ່ານ role/status ຈາກ DB ທຸກຄັ້ງ ເພື່ອໃຫ້ການລະງັບ ຫຼື ປ່ຽນສິດມີຜົນທັນທີ
    const { rows } = await ctx.db.query('SELECT id, role, status FROM users WHERE id = $1', [Number(sub)]);
    if (!rows[0]) throw new AppError('UNAUTHORIZED', 'ກະລຸນາເຂົ້າສູ່ລະບົບ');
    if (rows[0].status !== 'active') throw new AppError('FORBIDDEN', 'ບັນຊີຖືກລະງັບ');
    req.auth = { id: rows[0].id, role: rows[0].role };
  };
}

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest) => {
    if (!req.auth || !roles.includes(req.auth.role)) throw new AppError('FORBIDDEN', 'ທ່ານບໍ່ມີສິດໃຊ້ຟັງຊັນນີ້');
  };
}

// ---------- PIN ----------
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pin, salt, 32);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function pinMatches(pin: string, stored: string): Promise<boolean> {
  const [, saltHex, keyHex] = stored.split('$');
  const key = await scrypt(pin, Buffer.from(saltHex, 'hex'), 32);
  return timingSafeEqual(key, Buffer.from(keyHex, 'hex'));
}

/** ກວດ PIN; ຜິດ 5 ເທື່ອ ລັອກ 15 ນາທີ */
export async function verifyPin(db: Db, userId: number, pin: string | undefined): Promise<void> {
  if (!pin) throw new AppError('PIN_REQUIRED', 'ກະລຸນາໃສ່ PIN');
  const { rows } = await db.query('SELECT pin_hash, pin_locked_until > now() AS locked FROM users WHERE id = $1', [userId]);
  const u = rows[0];
  if (!u?.pin_hash) throw new AppError('PIN_REQUIRED', 'ກະລຸນາຕັ້ງ PIN ກ່ອນ');
  if (u.locked) throw new AppError('PIN_LOCKED', 'PIN ຖືກລັອກ 15 ນາທີ ເພາະໃສ່ຜິດຫຼາຍເທື່ອ');
  if (await pinMatches(pin, u.pin_hash)) {
    await db.query('UPDATE users SET pin_failed = 0, pin_locked_until = NULL WHERE id = $1', [userId]);
    return;
  }
  const { rows: f } = await db.query(
    `UPDATE users SET pin_failed = CASE WHEN pin_failed + 1 >= $2 THEN 0 ELSE pin_failed + 1 END,
                      pin_locked_until = CASE WHEN pin_failed + 1 >= $2 THEN now() + interval '15 minutes' ELSE pin_locked_until END
      WHERE id = $1 RETURNING pin_locked_until IS NOT NULL AND pin_locked_until > now() AS locked`,
    [userId, PIN_MAX_FAILS],
  );
  if (f[0].locked) throw new AppError('PIN_LOCKED', 'PIN ຖືກລັອກ 15 ນາທີ ເພາະໃສ່ຜິດຫຼາຍເທື່ອ');
  throw new AppError('PIN_INVALID', 'PIN ບໍ່ຖືກຕ້ອງ');
}

// ---------- Routes ----------
export function authRoutes(app: FastifyInstance, ctx: Ctx) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  // ຕໍ່ IP ຕັ້ງໄວ້ສູງ ເພາະຜູ້ໃຊ້ມືຖືຫຼາຍຄົນໃຊ້ IP ດຽວກັນ (CGNAT); ການຈຳກັດຫຼັກແມ່ນຕໍ່ເບີໂທ
  const otpLimit = { rateLimit: { max: 60, timeWindow: '1 minute' } };

  r.post('/v1/auth/otp/request', { config: otpLimit, schema: { tags: ['auth'], body: z.object({ phone: phoneSchema }) } }, async (req) =>
    requestOtp(ctx, req.body.phone),
  );

  r.post(
    '/v1/auth/otp/verify',
    { config: otpLimit, schema: { tags: ['auth'], body: z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/) }) } },
    async (req) => {
      await checkOtp(ctx, req.body.phone, req.body.code);
      const result = await withTx(ctx.db, async (c) => {
        const u = await ensureUser(c, req.body.phone);
        if (u.status !== 'active') throw new AppError('FORBIDDEN', 'ບັນຊີຖືກລະງັບ');
        return { ...(await issueTokens(ctx, c, u.id, u.role, req.headers['user-agent'])), userId: u.id };
      });
      const { userId, ...tokens } = result;
      return { ...tokens, user: await loadUser(ctx.db, userId) };
    },
  );

  r.post('/v1/auth/refresh', { schema: { tags: ['auth'], body: z.object({ refreshToken: z.string().min(20) }) } }, async (req) => {
    const { userId, ...tokens } = await refresh(ctx, req.body.refreshToken, req.headers['user-agent']);
    return { ...tokens, user: await loadUser(ctx.db, userId) };
  });

  r.post('/v1/auth/logout', { schema: { tags: ['auth'], body: z.object({ refreshToken: z.string().min(20) }) } }, async (req, reply) => {
    await ctx.db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [
      sha256(req.body.refreshToken),
    ]);
    return reply.status(204).send();
  });
}
