// End-to-end check of the offline demo web build in headless Chromium.
//
//   tool/build_demo_web.sh
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH="$(npm root -g)" \
//     node tool/demo_web_check.mjs build/web /tmp/demo-shots
//
// Serves the build from a local static server, then drives the app through
// Flutter's accessibility tree: login → set PIN → home → buy → ticket →
// profile → "ອອກຜົນງວດນີ້" → payout in the wallet. Fails on any console
// error, page error, failed request, or request to another host.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(process.argv[2] ?? 'build/web');
const shots = path.resolve(process.argv[3] ?? 'build/demo-shots');
const width = Number(process.env.WIDTH ?? 375);
const height = Number(process.env.HEIGHT ?? 812);
fs.mkdirSync(shots, { recursive: true });

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.txt': 'text/plain',
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise((r) => server.on('listening', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const consoleErrors = [];
const external = [];
const failed = [];
const requests = [];
const steps = [];

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
// An explicit locale: with an empty LANG headless Chromium reports
// "en-US@posix", which Flutter's web engine rejects.
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 2,
  locale: 'lo-LA',
  timezoneId: 'Asia/Vientiane',
});
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e}`));
page.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText}`));
page.on('request', (r) => {
  const u = r.url();
  requests.push(u);
  if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u);
});
await page.addInitScript(() => {
  window.__firstFrame = false;
  window.addEventListener('flutter-first-frame', () => { window.__firstFrame = true; });
});

const step = async (name, fn) => {
  const t = Date.now();
  await fn();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shots, `${String(steps.length + 1).padStart(2, '0')}-${name}.png`) });
  steps.push(`${name} (${Date.now() - t} ms)`);
};
const button = (name) => page.getByRole('button', { name, exact: true });
const field = (label) => page.locator(`input[aria-label="${label}"]`);
// Flutter listens to real key events on its own editing element: focus the
// field, then type (Playwright's fill() only sets the DOM value).
const typeInto = async (label, value) => {
  await field(label).click();
  await page.waitForTimeout(300);
  await page.keyboard.type(value, { delay: 30 });
  await page.waitForTimeout(300);
};
// Flutter exposes text either as text content or as aria-label.
const text = (t) => page.locator(`[aria-label*="${t}"]`).or(page.getByText(t, { exact: false }));
const labelled = text;
// Bottom-navigation destinations are exposed as tabs (or buttons).
const navTab = (name) => page.getByRole('tab', { name: new RegExp(name) })
  .or(page.getByRole('button', { name, exact: true })).last();
const scrollDown = async (px = 600) => {
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.wheel(0, px);
  await page.waitForTimeout(500);
};

let ok = false;
try {
  await step('login', async () => {
    const t0 = Date.now();
    await page.goto(`${origin}/`);
    await page.waitForFunction(() => window.__firstFrame === true, null, { timeout: 60000 });
    steps.push(`first frame after ${Date.now() - t0} ms`);
    await page.evaluate(() => document.querySelector('flt-semantics-placeholder')?.click());
    await labelled('ໂໝດສາທິດ · ຂໍ້ມູນຕົວຢ່າງ ບໍ່ແມ່ນເງິນແທ້').first().waitFor();
    await text('020 9999 9999').first().waitFor();
    if ((await page.title()) !== 'ຫວຍພັດທະນາ · ສາທິດ') throw new Error(`title: ${await page.title()}`);
  });

  await step('otp', async () => {
    await typeInto('ເບີໂທລະສັບ', '02055550001');
    await button('ຂໍລະຫັດ OTP').click();
    await text('ລະຫັດທົດສອບ (dev)').first().waitFor();
  });

  await step('set-pin', async () => {
    const node = text('ລະຫັດທົດສອບ (dev)').first();
    const banner = `${await node.getAttribute('aria-label') ?? ''} ${await node.textContent()}`;
    const code = banner.match(/\d{6}/)[0];
    await typeInto('ລະຫັດ OTP', code);
    await text('ຕັ້ງລະຫັດ PIN 6 ຕົວເລກ').first().waitFor();
  });

  await step('home', async () => {
    await typeInto('ລະຫັດ PIN ໃໝ່', '482915');
    await typeInto('ຢືນຢັນລະຫັດ PIN', '482915');
    await button('ບັນທຶກ').click();
    await text('500,000 ກີບ').first().waitFor();
    await text('ປິດຮັບໃນ').first().waitFor();
  });

  await step('buy', async () => {
    await navTab('ຊື້ເລກ').click();
    await button('2').waitFor();
    await button('2').click();
    await button('7').click();
    await text('ເລກ 2 ຕົວ · ຈ່າຍ x60').first().waitFor();
    await page.getByRole('button', { name: /ເພີ່ມເລກ/ }).click();
    await text('1,000 ກີບ').first().waitFor();
  });

  await step('confirm', async () => {
    await page.getByRole('button', { name: /ຈ່າຍເງິນ/ }).last().click();
    await text('ຢືນຢັນການຊື້').first().waitFor();
  });

  await step('ticket', async () => {
    await page.getByRole('button', { name: 'ຈ່າຍເງິນ', exact: true }).last().click();
    await text('ຊື້ສຳເລັດ').first().waitFor();
    await text('ລະຫັດກວດສອບ').first().waitFor();
  });

  await step('profile', async () => {
    await page.getByRole('button', { name: /ກັບຄືນ|Back/ }).first().click();
    await button('ໂປຣໄຟລ໌').click();
    await text('ເຄື່ອງມືສາທິດ').first().waitFor();
  });

  await step('demo-result', async () => {
    await scrollDown(600);
    await page.getByRole('button', { name: /ອອກຜົນງວດນີ້/ }).click();
    await text('ທ່ານຖືກລາງວັນ 60,000 ກີບ').first().waitFor({ timeout: 15000 });
  });

  await step('wallet-after-payout', async () => {
    await button('ຕົກລົງ').click();
    await page.getByRole('button', { name: /ກັບຄືນ|Back/ }).first().click();
    await navTab('ກະເປົາ').click();
    await text('559,000 ກີບ').first().waitFor();
    await text('ເງິນລາງວັນ').first().waitFor();
  });
  ok = true;
} catch (e) {
  console.error('STEP FAILED after:', steps.at(-1), '\n', e.message.split('\n').slice(0, 6).join('\n'));
  await page.screenshot({ path: path.join(shots, 'failure.png') });
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({
  viewport: `${width}x${height}`,
  ok,
  steps,
  requests: requests.length,
  externalRequests: external,
  failedRequests: failed,
  consoleErrors,
}, null, 2));
process.exit(ok && external.length === 0 && failed.length === 0 && consoleErrors.length === 0 ? 0 : 1);
