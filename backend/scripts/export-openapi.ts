// ສົ່ງອອກ OpenAPI spec ໄປ docs/openapi.json (ບໍ່ຕ້ອງມີ DB ຫຼື Redis ແລ່ນຢູ່)
import { writeFileSync } from 'node:fs';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { MockSms } from '../src/providers/sms.js';
import { MockPayments } from '../src/providers/payments.js';

const config = loadConfig({
  NODE_ENV: 'development',
  DATABASE_URL: 'postgres://unused/unused',
  JWT_SECRET: 'x'.repeat(32),
  PAYMENT_WEBHOOK_SECRET: 'x'.repeat(16),
  RATE_LIMIT_ENABLED: 'false',
});
const app = await buildApp({ config, db: {} as never, redis: {} as never, sms: new MockSms(), payments: new MockPayments('x'.repeat(16)) });
await app.ready();
writeFileSync(new URL('../../docs/openapi.json', import.meta.url), JSON.stringify(app.swagger(), null, 2) + '\n');
console.log('wrote docs/openapi.json');
await app.close();
