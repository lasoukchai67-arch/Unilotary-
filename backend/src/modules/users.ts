import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError, notFound } from '../lib/errors.js';
import type { Db } from '../lib/infra.js';
import { currentUser, type Ctx } from '../lib/context.js';
import { audit } from '../lib/audit.js';
import { authenticate, hashPin, pinSchema, verifyPin } from './auth.js';

export function userView(r: Record<string, any>) {
  return {
    id: r.id,
    phone: r.phone,
    fullName: r.full_name,
    role: r.role,
    kyc: r.kyc,
    kycNote: r.kyc_note,
    status: r.status,
    pinSet: r.pin_hash != null,
    dailySpendCap: r.daily_spend_cap,
    selfExcludedUntil: r.self_excluded_until,
    balance: r.balance ?? 0,
    held: r.held ?? 0,
    commissionBp: r.commission_bp,
    createdAt: r.created_at,
  };
}

export const USER_SELECT = `SELECT u.*, w.balance, w.held FROM users u LEFT JOIN wallets w ON w.user_id = u.id`;

export async function loadUser(db: Db, id: number) {
  const { rows } = await db.query(`${USER_SELECT} WHERE u.id = $1`, [id]);
  if (!rows[0]) throw notFound('ຜູ້ໃຊ້');
  return userView(rows[0]);
}

const ALLOWED_IMAGE = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
]);

export function userRoutes(app: FastifyInstance, ctx: Ctx) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const auth = { onRequest: authenticate(ctx) };

  r.get('/v1/me', { ...auth, schema: { tags: ['me'] } }, async (req) => loadUser(ctx.db, currentUser(req).id));

  r.post(
    '/v1/me/pin',
    { ...auth, schema: { tags: ['me'], body: z.object({ pin: pinSchema, currentPin: pinSchema.optional() }) } },
    async (req, reply) => {
      const me = currentUser(req);
      const { rows } = await ctx.db.query('SELECT pin_hash FROM users WHERE id = $1', [me.id]);
      if (rows[0].pin_hash) await verifyPin(ctx.db, me.id, req.body.currentPin);
      await ctx.db.query('UPDATE users SET pin_hash = $1, pin_failed = 0, pin_locked_until = NULL WHERE id = $2', [
        await hashPin(req.body.pin),
        me.id,
      ]);
      await audit(ctx.db, { actorId: me.id, action: 'user.pin_set', entity: 'users', entityId: me.id, ip: req.ip });
      return reply.status(204).send();
    },
  );

  r.patch(
    '/v1/me/settings',
    {
      ...auth,
      schema: { tags: ['me'], body: z.object({ dailySpendCap: z.number().int().positive().nullable(), pin: pinSchema }) },
    },
    async (req) => {
      const me = currentUser(req);
      await verifyPin(ctx.db, me.id, req.body.pin);
      await ctx.db.query('UPDATE users SET daily_spend_cap = $1 WHERE id = $2', [req.body.dailySpendCap, me.id]);
      return loadUser(ctx.db, me.id);
    },
  );

  r.post(
    '/v1/me/self-exclusion',
    { ...auth, schema: { tags: ['me'], body: z.object({ days: z.number().int().min(1).max(365), pin: pinSchema }) } },
    async (req) => {
      const me = currentUser(req);
      await verifyPin(ctx.db, me.id, req.body.pin);
      // ຂະຫຍາຍໄດ້ ແຕ່ຫຍໍ້ລົງບໍ່ໄດ້
      await ctx.db.query(
        `UPDATE users SET self_excluded_until = GREATEST(COALESCE(self_excluded_until, now()), now() + make_interval(days => $1))
          WHERE id = $2`,
        [req.body.days, me.id],
      );
      await audit(ctx.db, { actorId: me.id, action: 'user.self_exclusion', entity: 'users', entityId: me.id, after: { days: req.body.days }, ip: req.ip });
      return loadUser(ctx.db, me.id);
    },
  );

  r.post('/v1/me/kyc', { ...auth, schema: { tags: ['me'], consumes: ['multipart/form-data'] } }, async (req) => {
    const me = currentUser(req);
    const fields: Record<string, string> = {};
    let photo: { buf: Buffer; ext: string } | undefined;
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        const ext = ALLOWED_IMAGE.get(part.mimetype);
        const buf = await part.toBuffer();
        if (part.fieldname !== 'photo' || !ext) throw new AppError('VALIDATION', 'ຮູບຕ້ອງເປັນ JPEG ຫຼື PNG');
        if (part.file.truncated) throw new AppError('VALIDATION', 'ຮູບໃຫຍ່ເກີນ 5 MB');
        photo = { buf, ext };
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }
    const parsed = z
      .object({
        fullName: z.string().trim().min(2).max(150),
        birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        idCardNo: z.string().trim().min(4).max(40),
      })
      .safeParse(fields);
    if (!parsed.success) throw new AppError('VALIDATION', 'ຂໍ້ມູນບໍ່ຄົບ', parsed.error.issues);
    if (!photo) throw new AppError('VALIDATION', 'ກະລຸນາແນບຮູບບັດປະຈຳຕົວ');

    const { rows } = await ctx.db.query(
      `SELECT kyc, $1::date <= (now() AT TIME ZONE 'Asia/Vientiane')::date - interval '18 years' AS adult FROM users WHERE id = $2`,
      [parsed.data.birthDate, me.id],
    );
    if (!rows[0].adult) throw new AppError('USER_NOT_ALLOWED', 'ຕ້ອງມີອາຍຸ 18 ປີຂຶ້ນໄປ');
    if (rows[0].kyc === 'verified') throw new AppError('CONFLICT', 'ຢືນຢັນຕົວຕົນແລ້ວ');

    const dir = path.join(ctx.config.UPLOAD_DIR, 'kyc', String(me.id));
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${randomUUID()}${photo.ext}`);
    await writeFile(file, photo.buf, { mode: 0o600 });

    await ctx.db.query(
      `UPDATE users SET full_name = $1, birth_date = $2, id_card_no = $3, kyc_doc_path = $4,
                        kyc = 'pending', kyc_submitted_at = now(), kyc_note = NULL
        WHERE id = $5`,
      [parsed.data.fullName, parsed.data.birthDate, parsed.data.idCardNo, file, me.id],
    );
    await audit(ctx.db, { actorId: me.id, action: 'kyc.submit', entity: 'users', entityId: me.id, ip: req.ip });
    return loadUser(ctx.db, me.id);
  });
}
