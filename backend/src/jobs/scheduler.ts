// ເປີດ/ປິດງວດອັດຕະໂນມັດຕາມເວລາ ແລະ ໝາຍລາຍການເຕີມເງິນທີ່ໝົດອາຍຸ.
// ມີ lock ໃນ Redis ເພື່ອໃຫ້ພຽງ server ດຽວເຮັດວຽກນີ້ ເຖິງວ່າຈະແລ່ນຫຼາຍເຄື່ອງ.
import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { Ctx } from '../lib/context.js';
import { audit } from '../lib/audit.js';
import { dropDraw, ensureWarm } from '../modules/limits.js';

const LOCK = 'scheduler:leader';

export async function tick(ctx: Ctx): Promise<{ opened: number[]; closed: number[] }> {
  const { db, redis } = ctx;
  const opened = (await db.query(`UPDATE draws SET status = 'open' WHERE status = 'scheduled' AND now() >= sales_open_at AND now() < sales_close_at RETURNING id`)).rows.map(
    (r) => r.id as number,
  );
  for (const id of opened) {
    await ensureWarm(db, redis, id);
    await audit(db, { actorId: null, action: 'draw.auto_open', entity: 'draws', entityId: id });
  }
  const closed = (await db.query(`UPDATE draws SET status = 'closed' WHERE status IN ('open', 'scheduled') AND now() >= sales_close_at RETURNING id`)).rows.map(
    (r) => r.id as number,
  );
  for (const id of closed) {
    await dropDraw(redis, id);
    await audit(db, { actorId: null, action: 'draw.auto_close', entity: 'draws', entityId: id });
  }
  await db.query(`UPDATE payments SET status = 'expired' WHERE status = 'pending' AND expires_at < now() - interval '1 hour'`);
  return { opened, closed };
}

export function startScheduler(ctx: Ctx, log: FastifyBaseLogger, everyMs = 10_000): () => void {
  let running = false;
  const me = randomUUID();
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const got = (await ctx.redis.set(LOCK, me, 'PX', everyMs * 3, 'NX')) === 'OK';
      if (!got) {
        if ((await ctx.redis.get(LOCK)) !== me) return;
        await ctx.redis.pexpire(LOCK, everyMs * 3);
      }
      const r = await tick(ctx);
      if (r.opened.length || r.closed.length) log.info(r, 'scheduler tick');
    } catch (err) {
      log.error(err, 'scheduler failed');
    } finally {
      running = false;
    }
  }, everyMs);
  timer.unref();
  return () => clearInterval(timer);
}
