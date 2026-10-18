import { loadConfig } from './config.js';
import { createInfra } from './lib/infra.js';
import { createSms } from './providers/sms.js';
import { createPayments } from './providers/payments.js';
import { migrate } from './migrate.js';
import { buildApp } from './app.js';
import { startScheduler } from './jobs/scheduler.js';

const config = loadConfig();
await migrate(config.DATABASE_URL);
const infra = createInfra(config);
const ctx = { config, ...infra, sms: createSms(config), payments: createPayments(config) };
const app = await buildApp(ctx);
const stopScheduler = config.SCHEDULER_ENABLED ? startScheduler(ctx, app.log) : () => {};

await app.listen({ port: config.PORT, host: '0.0.0.0' });
app.log.info({ sms: ctx.sms.name, payments: ctx.payments.name }, 'providers');

// ປິດແບບນຸ້ມນວນ: ຢຸດຮັບຄຳຂໍໃໝ່, ລໍຖ້າຄຳຂໍທີ່ຄ້າງ, ແລ້ວປິດການເຊື່ອມຕໍ່
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    app.log.info({ signal }, 'shutting down');
    stopScheduler();
    await app.close();
    await infra.db.end();
    infra.redis.disconnect();
    process.exit(0);
  });
}
