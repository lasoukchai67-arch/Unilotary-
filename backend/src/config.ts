import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(3000),
    DATABASE_URL: z.string().url(),
    DB_POOL_SIZE: z.coerce.number().int().default(20),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET ຕ້ອງຍາວຢ່າງໜ້ອຍ 32 ໂຕ'),
    ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().default(15 * 60),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().default(30),
    CORS_ORIGINS: z.string().default(''),
    UPLOAD_DIR: z.string().default('./uploads'),
    TIMEZONE: z.string().default('Asia/Vientiane'),
    SMS_PROVIDER: z.enum(['mock', 'http']).default('mock'),
    SMS_HTTP_URL: z.string().optional(),
    SMS_HTTP_TOKEN: z.string().optional(),
    SMS_SENDER: z.string().default('LOTTERY'),
    PAYMENT_PROVIDER: z.enum(['mock', 'lapnet']).default('mock'),
    PAYMENT_WEBHOOK_SECRET: z.string().min(16),
    LAPNET_API_URL: z.string().optional(),
    LAPNET_MERCHANT_ID: z.string().optional(),
    LAPNET_API_KEY: z.string().optional(),
    SCHEDULER_ENABLED: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
    RATE_LIMIT_ENABLED: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
    RATE_LIMIT_MAX: z.coerce.number().int().default(300),
  })
  .superRefine((c, ctx) => {
    // ໂໝດທົດລອງຫ້າມໃຊ້ໃນ production: ກັນບໍ່ໃຫ້ OTP/ການຈ່າຍເງິນປອມຫຼຸດອອກໄປ
    if (c.NODE_ENV === 'production' && c.SMS_PROVIDER === 'mock') {
      ctx.addIssue({ code: 'custom', path: ['SMS_PROVIDER'], message: 'production ຕ້ອງໃຊ້ SMS ແທ້' });
    }
    if (c.NODE_ENV === 'production' && c.PAYMENT_PROVIDER === 'mock') {
      ctx.addIssue({ code: 'custom', path: ['PAYMENT_PROVIDER'], message: 'production ຕ້ອງໃຊ້ຜູ້ໃຫ້ບໍລິການຈ່າຍເງິນແທ້' });
    }
  });

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`ການຕັ້ງຄ່າບໍ່ຖືກຕ້ອງ:\n${msg}`);
  }
  return parsed.data;
}

export const isDevTools = (c: Config) => c.NODE_ENV !== 'production';
