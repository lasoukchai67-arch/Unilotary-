// ວົງເງິນຕໍ່ເລກ ໃນ Redis — ດ່ານໜ້າທີ່ໄວ ແລະ atomic ສຳລັບຊ່ວງຄົນຊື້ຫຼາຍກ່ອນປິດງວດ.
// Postgres (number_sales CHECK sold_amount <= cap) ຍັງເປັນດ່ານສຸດທ້າຍ ຖ້າ Redis ຜິດພາດ.
import type pg from 'pg';
import type { Redis } from 'ioredis';

// {draw:ID} ເປັນ hash tag ເພື່ອໃຫ້ທຸກ key ຂອງງວດດຽວກັນຢູ່ slot ດຽວກັນໃນ Redis Cluster
const keys = (drawId: number) => {
  const p = `{draw:${drawId}}`;
  return { sold: `${p}:sold`, caps: `${p}:caps`, closed: `${p}:closed`, rules: `${p}:rules`, ready: `${p}:ready`, lock: `${p}:warming` };
};

// ກວດທຸກເລກກ່ອນ; ຖ້າຜ່ານໝົດຈຶ່ງບວກຍອດ (all-or-nothing ໃນຄຳສັ່ງດຽວ)
const RESERVE_LUA = `
local n = tonumber(ARGV[1])
local failed = {}
for i = 0, n - 1 do
  local num = ARGV[2 + i * 2]
  local amt = tonumber(ARGV[3 + i * 2])
  if redis.call('SISMEMBER', KEYS[3], num) == 1 then
    table.insert(failed, num .. ':closed:0')
  else
    local cap = redis.call('HGET', KEYS[2], num)
    if not cap then cap = redis.call('HGET', KEYS[4], tostring(string.len(num))) end
    if not cap then
      table.insert(failed, num .. ':norule:0')
    else
      local sold = tonumber(redis.call('HGET', KEYS[1], num) or '0')
      local left = tonumber(cap) - sold
      if amt > left then table.insert(failed, num .. ':full:' .. math.max(left, 0)) end
    end
  end
end
if #failed > 0 then return failed end
for i = 0, n - 1 do
  redis.call('HINCRBY', KEYS[1], ARGV[2 + i * 2], tonumber(ARGV[3 + i * 2]))
end
return {}
`;

const RELEASE_LUA = `
local n = tonumber(ARGV[1])
for i = 0, n - 1 do
  local num = ARGV[2 + i * 2]
  local v = redis.call('HINCRBY', KEYS[1], num, -tonumber(ARGV[3 + i * 2]))
  if v < 0 then redis.call('HSET', KEYS[1], num, 0) end
end
return 1
`;

export interface LimitFailure {
  number: string;
  reason: 'closed' | 'full' | 'norule';
  remaining: number;
}

const flatten = (amounts: Map<string, number>) => {
  const args: (string | number)[] = [amounts.size];
  for (const [num, amt] of amounts) args.push(num, amt);
  return args;
};

export async function reserve(redis: Redis, drawId: number, amounts: Map<string, number>): Promise<LimitFailure[]> {
  const k = keys(drawId);
  const res = (await redis.eval(RESERVE_LUA, 4, k.sold, k.caps, k.closed, k.rules, ...flatten(amounts))) as string[];
  return res.map((s) => {
    const [number, reason, remaining] = s.split(':');
    return { number, reason: reason as LimitFailure['reason'], remaining: Number(remaining) };
  });
}

export async function release(redis: Redis, drawId: number, amounts: Map<string, number>): Promise<void> {
  await redis.eval(RELEASE_LUA, 1, keys(drawId).sold, ...flatten(amounts));
}

// ໂຫຼດກົດ, ເລກອັ້ນ, ເລກປິດ ແລະ ຍອດຂາຍຈາກ DB ເຂົ້າ Redis (ຕອນເປີດງວດ ຫຼື ເມື່ອ Redis ເສຍຂໍ້ມູນ).
// ມີ lock ເພື່ອໃຫ້ພຽງ instance ດຽວໂຫຼດ, ຄົນອື່ນລໍຖ້າ.
export async function ensureWarm(db: pg.Pool, redis: Redis, drawId: number): Promise<void> {
  const k = keys(drawId);
  if (await redis.exists(k.ready)) return;
  if ((await redis.set(k.lock, '1', 'EX', 30, 'NX')) === 'OK') {
    try {
      const [rules, limits, sales] = await Promise.all([
        db.query('SELECT digits, default_number_cap FROM draw_digit_rules WHERE draw_id = $1', [drawId]),
        db.query('SELECT number, cap, is_closed FROM number_limits WHERE draw_id = $1', [drawId]),
        db.query('SELECT number, sold_amount FROM number_sales WHERE draw_id = $1', [drawId]),
      ]);
      const m = redis.multi().del(k.sold, k.caps, k.closed, k.rules);
      for (const r of rules.rows) m.hset(k.rules, String(r.digits), r.default_number_cap);
      for (const l of limits.rows) {
        if (l.cap !== null) m.hset(k.caps, l.number, l.cap);
        if (l.is_closed) m.sadd(k.closed, l.number);
      }
      for (const s of sales.rows) m.hset(k.sold, s.number, s.sold_amount);
      m.set(k.ready, '1', 'EX', 7 * 86400);
      await m.exec();
    } finally {
      await redis.del(k.lock);
    }
    return;
  }
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 50));
    if (await redis.exists(k.ready)) return;
  }
  throw new Error(`limits for draw ${drawId} not ready`);
}

// ແອັດມິນປ່ຽນວົງເງິນ/ປິດເລກ: ອັບເດດ Redis ທັນທີຫຼັງ DB commit
export async function applyNumberLimit(
  redis: Redis,
  drawId: number,
  number: string,
  cap: number | null,
  closed: boolean,
): Promise<void> {
  const k = keys(drawId);
  const m = redis.multi();
  if (cap === null) m.hdel(k.caps, number);
  else m.hset(k.caps, number, cap);
  if (closed) m.sadd(k.closed, number);
  else m.srem(k.closed, number);
  await m.exec();
}

export async function soldAmount(redis: Redis, drawId: number, number: string): Promise<number> {
  return Number((await redis.hget(keys(drawId).sold, number)) ?? 0);
}

/** ບັງຄັບໃຫ້ໂຫຼດຂໍ້ມູນງວດຈາກ DB ໃໝ່ໃນການຊື້ຄັ້ງຕໍ່ໄປ */
export async function invalidate(redis: Redis, drawId: number): Promise<void> {
  await redis.del(keys(drawId).ready);
}

/** ລຶບຂໍ້ມູນງວດອອກຈາກ Redis (ເມື່ອປິດ ຫຼື ຍົກເລີກງວດ) */
export async function dropDraw(redis: Redis, drawId: number): Promise<void> {
  const k = keys(drawId);
  await redis.del(k.sold, k.caps, k.closed, k.rules, k.ready, k.lock);
}
