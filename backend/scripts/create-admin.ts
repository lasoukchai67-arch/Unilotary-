// ຕັ້ງແອັດມິນຄົນທຳອິດ (ຫຼື ປ່ຽນ role ຂອງເບີທີ່ມີແລ້ວ):
//   npm run create-admin -- 02055551234 "ຊື່ ແອັດມິນ" [admin|finance|auditor]
// ຈາກນັ້ນເຂົ້າເວັບແອັດມິນດ້ວຍ OTP ແລະ ຕັ້ງ PIN ໃນຄັ້ງທຳອິດ.
import pg from 'pg';
import { normalizePhone } from '../src/modules/auth.js';
import { migrate } from '../src/migrate.js';

const [rawPhone, name, role = 'admin'] = process.argv.slice(2);
if (!rawPhone || !name || !['admin', 'finance', 'auditor'].includes(role)) {
  console.error('usage: npm run create-admin -- <phone> "<full name>" [admin|finance|auditor]');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
await migrate(url, () => {});
const phone = normalizePhone(rawPhone);
const db = new pg.Client({ connectionString: url });
await db.connect();
const { rows } = await db.query(
  `INSERT INTO users (phone, full_name, role, kyc) VALUES ($1, $2, $3, 'verified')
   ON CONFLICT (phone) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name
   RETURNING id`,
  [phone, name, role],
);
await db.query('INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [rows[0].id]);
await db.query(`INSERT INTO audit_logs (actor_id, action, entity, entity_id, after_data) VALUES (NULL, 'user.create_admin', 'users', $1, $2)`, [
  String(rows[0].id),
  JSON.stringify({ phone, role }),
]);
await db.end();
console.log(`${role} ready: ${phone} (user #${rows[0].id})`);
