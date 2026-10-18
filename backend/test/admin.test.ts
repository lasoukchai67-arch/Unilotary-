import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buy, makeUser, openDraw, setup, credit, type TestEnv, type TestUser } from './helpers.js';

let env: TestEnv;
let admin: TestUser;

before(async () => {
  env = await setup();
  admin = await makeUser(env, { role: 'admin' });
});
after(async () => env.close());

// PNG 1x1 ທີ່ຖືກຕ້ອງ
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

function multipart(fields: Record<string, string>, file?: { name: string; type: string; data: Buffer }) {
  const boundary = `----test${randomUUID()}`;
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  if (file) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`));
    parts.push(file.data, Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

const submitKyc = (u: TestUser, birthDate: string, file = { name: 'id.png', type: 'image/png', data: PNG }) => {
  const m = multipart({ fullName: 'ສົມໃຈ ໃຈດີ', birthDate, idCardNo: '01-234567' }, file);
  return env.app.inject({ method: 'POST', url: '/v1/me/kyc', headers: { ...u.headers, ...m.headers }, payload: m.payload });
};

describe('KYC', () => {
  test('ສົ່ງ → pending → ແອັດມິນເບິ່ງເອກະສານ ແລະ ອະນຸມັດ → ຊື້ໄດ້', async () => {
    const drawId = await openDraw(env, admin);
    const u = await makeUser(env, { kyc: 'unsubmitted' });
    await credit(env, u.id, 10_000);
    assert.equal((await buy(env, u, drawId, [{ number: '27', amount: 1_000 }])).json().details.reason, 'kyc');

    const r = await submitKyc(u, '1990-05-01');
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().kyc, 'pending');
    assert.equal(r.json().fullName, 'ສົມໃຈ ໃຈດີ');

    const list = (await env.app.inject({ method: 'GET', url: '/v1/admin/kyc', headers: admin.headers })).json().items;
    const item = list.find((x: any) => x.userId === u.id);
    assert.equal(item.idCardNo, '01-234567');
    assert.equal(item.birthDate, '1990-05-01');

    const doc = await env.app.inject({ method: 'GET', url: `/v1/admin/kyc/${u.id}/document`, headers: admin.headers });
    assert.equal(doc.statusCode, 200);
    assert.equal(doc.headers['content-type'], 'image/png');
    assert.deepEqual(doc.rawPayload, PNG);
    // ລູກຄ້າຄົນອື່ນເບິ່ງບໍ່ໄດ້
    assert.equal((await env.app.inject({ method: 'GET', url: `/v1/admin/kyc/${u.id}/document`, headers: u.headers })).statusCode, 403);

    // ບໍ່ສົ່ງ body (ຄືກັບປຸ່ມອະນຸມັດໃນເວັບແອັດມິນ) ຕ້ອງຜ່ານ
    const ok = await env.app.inject({ method: 'POST', url: `/v1/admin/kyc/${u.id}/approve`, headers: admin.headers });
    assert.equal(ok.json().kyc, 'verified');
    assert.equal((await buy(env, u, drawId, [{ number: '27', amount: 1_000 }])).statusCode, 201);
  });

  test('ອາຍຸຕ່ຳກວ່າ 18 / ໄຟລ໌ບໍ່ແມ່ນຮູບ / ປະຕິເສດພ້ອມເຫດຜົນ', async () => {
    const u = await makeUser(env, { kyc: 'unsubmitted' });
    const young = new Date(Date.now() - 17 * 365 * 86400_000).toISOString().slice(0, 10);
    assert.equal((await submitKyc(u, young)).json().error, 'USER_NOT_ALLOWED');
    assert.equal((await submitKyc(u, '1990-01-01', { name: 'x.pdf', type: 'application/pdf', data: Buffer.from('%PDF') })).statusCode, 400);

    assert.equal((await submitKyc(u, '1990-01-01')).statusCode, 200);
    const rej = await env.app.inject({ method: 'POST', url: `/v1/admin/kyc/${u.id}/reject`, headers: admin.headers, payload: { note: 'ຮູບບໍ່ຊັດ' } });
    assert.equal(rej.json().kyc, 'rejected');
    assert.equal(rej.json().kycNote, 'ຮູບບໍ່ຊັດ');
    const n = (await env.app.inject({ method: 'GET', url: '/v1/notifications', headers: u.headers })).json();
    assert.match(n.items[0].body, /ຮູບບໍ່ຊັດ/);
    // ສົ່ງໃໝ່ໄດ້
    assert.equal((await submitKyc(u, '1990-01-01')).json().kyc, 'pending');
  });
});

describe('admin tools', () => {
  test('ຄົ້ນຫາ ແລະ ແກ້ສິດຜູ້ໃຊ້; ແກ້ສິດຕົນເອງບໍ່ໄດ້; ລະງັບ → token ໃຊ້ບໍ່ໄດ້', async () => {
    const u = await makeUser(env);
    const found = (await env.app.inject({ method: 'GET', url: `/v1/admin/users?q=${u.phone.slice(-6)}`, headers: admin.headers })).json().items;
    assert.ok(found.some((x: any) => x.id === u.id));

    const p = await env.app.inject({ method: 'PATCH', url: `/v1/admin/users/${u.id}`, headers: admin.headers, payload: { role: 'agent', commissionBp: 1200 } });
    assert.equal(p.json().role, 'agent');
    assert.equal(p.json().commissionBp, 1200);
    assert.equal((await env.app.inject({ method: 'PATCH', url: `/v1/admin/users/${admin.id}`, headers: admin.headers, payload: { role: 'customer' } })).statusCode, 403);

    await env.app.inject({ method: 'PATCH', url: `/v1/admin/users/${u.id}`, headers: admin.headers, payload: { status: 'suspended' } });
    assert.equal((await env.app.inject({ method: 'GET', url: '/v1/me', headers: u.headers })).statusCode, 403);
  });

  test('ຕັ້ງຄ່າ: ກວດຄ່າ, ບັນທຶກ audit', async () => {
    const s = await env.app.inject({ method: 'PUT', url: '/v1/admin/settings/payout_auto_limit', headers: admin.headers, payload: { value: 1_000_000 } });
    assert.deepEqual(s.json(), { key: 'payout_auto_limit', value: 1_000_000 });
    assert.equal((await env.app.inject({ method: 'PUT', url: '/v1/admin/settings/payout_auto_limit', headers: admin.headers, payload: { value: -5 } })).statusCode, 400);
    assert.equal((await env.app.inject({ method: 'PUT', url: '/v1/admin/settings/unknown', headers: admin.headers, payload: { value: 1 } })).statusCode, 404);
    const all = (await env.app.inject({ method: 'GET', url: '/v1/admin/settings', headers: admin.headers })).json().items;
    assert.equal(all.find((x: any) => x.key === 'payout_auto_limit').value, 1_000_000);

    const log = (await env.app.inject({ method: 'GET', url: '/v1/admin/audit?limit=5', headers: admin.headers })).json().items;
    assert.equal(log[0].action, 'settings.update');
    assert.equal(log[0].actorPhone, admin.phone);
    // audit log ແກ້ບໍ່ໄດ້
    await assert.rejects(env.ctx.db.query('DELETE FROM audit_logs'));
  });

  test('dashboard ແລະ ແຈ້ງເຕືອນ (ອ່ານແລ້ວ)', async () => {
    const d = (await env.app.inject({ method: 'GET', url: '/v1/admin/dashboard', headers: admin.headers })).json();
    assert.ok(d.users.total >= 1);
    assert.ok(d.currentDraw);
    assert.equal(typeof d.pending.kyc, 'number');

    const u = await makeUser(env);
    await env.ctx.db.query(`INSERT INTO notifications (user_id, title, body) VALUES ($1, 'a', 'b'), ($1, 'c', 'd')`, [u.id]);
    const n = (await env.app.inject({ method: 'GET', url: '/v1/notifications', headers: u.headers })).json();
    assert.equal(n.unread, 2);
    await env.app.inject({ method: 'POST', url: `/v1/notifications/${n.items[0].id}/read`, headers: u.headers });
    assert.equal((await env.app.inject({ method: 'GET', url: '/v1/notifications', headers: u.headers })).json().unread, 1);
    await env.app.inject({ method: 'POST', url: '/v1/notifications/read-all', headers: u.headers });
    assert.equal((await env.app.inject({ method: 'GET', url: '/v1/notifications', headers: u.headers })).json().unread, 0);
  });

  test('health, ready, OpenAPI', async () => {
    assert.equal((await env.app.inject({ method: 'GET', url: '/health' })).statusCode, 200);
    assert.equal((await env.app.inject({ method: 'GET', url: '/ready' })).statusCode, 200);
    const spec = (await env.app.inject({ method: 'GET', url: '/docs/json' })).json();
    assert.ok(spec.paths['/v1/draws/{drawId}/tickets']);
    assert.ok(spec.paths['/v1/admin/draws/{id}/result/approve']);
  });
});
