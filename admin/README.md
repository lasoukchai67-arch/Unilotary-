# ເວັບແອັດມິນ ຫວຍພັດທະນາ · Lao Development Lottery — Admin

ເວັບແອັບສຳລັບພະນັກງານ (ແອັດມິນ, ການເງິນ, ຜູ້ກວດສອບ) ຂອງຜູ້ຂາຍຫວຍພັດທະນາທີ່ໄດ້ຮັບອະນຸຍາດ.
Staff web app (admin, finance, auditor) for a licensed Lao Development Lottery seller.

React 18 + TypeScript + Vite, `react-router-dom`, `@tanstack/react-query`, plain CSS (`src/styles/global.css`),
self-hosted Lao font `@fontsource/noto-sans-lao` (400/700, Lao subset). The API contract is
[`../docs/API.md`](../docs/API.md).

---

## ລາວ

### ຄວາມຕ້ອງການ
- Node.js ≥ 22.12 ແລະ npm
- Backend (`../backend`) ແລ່ນຢູ່ `http://localhost:3000` ສຳລັບການພັດທະນາ

### ພັດທະນາ (dev)
```bash
cd admin
npm ci
npm run dev            # http://localhost:5173/admin/  (/v1 ຖືກ proxy ໄປ backend)
```
ສ້າງແອັດມິນຄົນທຳອິດຢູ່ backend: `cd ../backend && npm run create-admin -- 02012345678 "ຊື່" admin`.
ຈາກນັ້ນເຂົ້າລະບົບດ້ວຍ OTP (ໃນໂໝດ mock SMS ລະຫັດຈະສະແດງເທິງໜ້າຈໍ) ແລະ ຕັ້ງ PIN.
ການອອກຜົນຕ້ອງມີແອັດມິນ **2 ຄົນ**: ຄົນໜຶ່ງປ້ອນ, ອີກຄົນພິມຢືນຢັນ.

### Build ແລະ ທົດສອບ
```bash
npm run build          # tsc (ກວດ type) + vite build → dist/
npm test               # vitest (API client, ຮູບແບບເງິນ, ເວລາ, maker–checker)
npm run preview        # ເປີດ dist/ ທີ່ http://localhost:4173/admin/
```

### ຕົວແປສະພາບແວດລ້ອມ
| ຕົວແປ | ຄ່າເລີ່ມຕົ້ນ | ຄວາມໝາຍ |
|---|---|---|
| `VITE_API_BASE_URL` | `/v1` | URL ຂອງ API (ໃສ່ຕອນ **build**). ໃຊ້ `/v1` ເມື່ອ nginx ສົ່ງ `/v1` ໄປ backend ໃນ domain ດຽວກັນ. |
| `VITE_DEV_PROXY_TARGET` | `http://localhost:3000` | ສະເພາະ `npm run dev` / `preview`: ປາຍທາງຂອງ proxy `/v1`. |

ເບິ່ງ `.env.example`. ຖ້າ API ຢູ່ຕ່າງ domain ຕ້ອງເພີ່ມ domain ຂອງເວັບແອັດມິນໃນ `CORS_ORIGINS` ຂອງ backend.

### ຕິດຕັ້ງ production (nginx, path `/admin`)
Vite ຕັ້ງ `base: '/admin/'` ແລ້ວ. ສຳເນົາ `dist/` ໄປທີ່ server ເຊັ່ນ `/var/www/lottery/admin/`
ແລ້ວໃຊ້ການຕັ້ງຄ່າ nginx ດ້ານລຸ່ມ (ພາກພາສາອັງກິດ).

### ຄວາມປອດໄພ
- Access token ເກັບໃນ memory ເທົ່ານັ້ນ, refresh token ເກັບໃນ `sessionStorage` (ຫາຍເມື່ອປິດແທັບ).
- ເມື່ອໄດ້ 401 ລະບົບຈະ refresh token ຄັ້ງດຽວ (ໃຊ້ຮ່ວມກັນລະຫວ່າງຄຳຂໍທີ່ພ້ອມກັນ) ແລ້ວລອງໃໝ່; ຖ້າບໍ່ໄດ້ ຈະກັບໄປໜ້າເຂົ້າລະບົບ.
- ລູກຄ້າ ແລະ ຕົວແທນ ເຂົ້າບໍ່ໄດ້ ("ບໍ່ມີສິດເຂົ້າ").
- ສິດ: ແອັດມິນ = ທຸກຢ່າງ; ການເງິນ = ອະນຸມັດຖອນເງິນ ແລະ ຈ່າຍລາງວັນ (ອື່ນໆເບິ່ງຢ່າງດຽວ); ຜູ້ກວດສອບ = ເບິ່ງຢ່າງດຽວ.
  ພະນັກງານອະນຸມັດລາຍການຂອງຕົນເອງບໍ່ໄດ້ (ເຊີບເວີຕອບ 403 ແລະ ແອັບສະແດງຂໍ້ຄວາມນັ້ນ).

---

## English

### Requirements
- Node.js ≥ 22.12 and npm
- The backend (`../backend`) on `http://localhost:3000` for development

### Develop
```bash
cd admin
npm ci
npm run dev            # http://localhost:5173/admin/  (/v1 is proxied to the backend)
```
Create the first admin in the backend: `cd ../backend && npm run create-admin -- 02012345678 "Name" admin`.
Sign in with an OTP (with the mock SMS provider the code is shown on the login screen) and set a PIN.
Publishing a result needs **two admins**: one enters it, a different one re-types it to approve.

### Build and test
```bash
npm run build          # tsc type-check + vite build → dist/
npm test               # vitest: API client (refresh flow, error mapping), money format,
                       # Asia/Vientiane → UTC conversion, maker–checker logic and UI
npm run typecheck
npm run preview        # serves dist/ at http://localhost:4173/admin/ (same /v1 proxy)
```

### Environment variables
| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `/v1` | API base URL, baked in at **build** time. Keep `/v1` when nginx proxies `/v1` to the backend on the same host. |
| `VITE_DEV_PROXY_TARGET` | `http://localhost:3000` | `npm run dev` / `preview` only: where `/v1` is proxied. |

See `.env.example`. If the API is on another origin, add the admin site's origin to the backend's `CORS_ORIGINS`.

### Deploy as static files behind nginx at `/admin`
`vite.config.ts` sets `base: '/admin/'` and the router uses the same base, so every asset URL starts with
`/admin/`. Copy `dist/` to e.g. `/var/www/lottery/admin/`:

```nginx
server {
    listen 443 ssl http2;
    server_name lottery.example.la;
    # ssl_certificate ...; ssl_certificate_key ...;

    root /var/www/lottery;            # dist/ is copied to /var/www/lottery/admin/

    location = /admin { return 301 /admin/; }

    # Hashed, immutable build assets
    location /admin/assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # SPA: unknown paths under /admin/ fall back to index.html (never cached)
    location /admin/ {
        try_files $uri $uri/ /admin/index.html;
        add_header Cache-Control "no-cache";
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer" always;
        # blob: is needed for KYC document images (fetched with the auth header, shown as object URLs)
        add_header Content-Security-Policy "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'" always;
    }

    # API on the same host (matches VITE_API_BASE_URL=/v1)
    location /v1/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 6m;
    }
}
```
If the API lives on a different origin, build with `VITE_API_BASE_URL=https://api.example.la/v1` and add that
origin to `connect-src`.

### How it works
- `src/api/` — typed client for `docs/API.md`: errors become `ApiError { status, code, message, details }`
  (server `{ error, message, details }`; Lao fallback messages for non-JSON responses and network errors);
  lists use `before` / `nextBefore` cursors.
- Tokens: access token in memory only; refresh token in `sessionStorage` (per tab). On `401 UNAUTHORIZED` the
  client calls `/auth/refresh` once — single-flight, because the server rotates the refresh token and treats
  reuse as theft — stores the rotated token and retries the request once. If the refresh is rejected the tokens
  are cleared and the app returns to the login page. `401 PIN_*` errors never trigger a refresh.
- Times: inputs and displays are Asia/Vientiane (UTC+7); the API gets ISO UTC strings
  (`src/lib/datetime.ts`, independent of the browser's time zone).
- Money: integer kip with thousands separators (`src/lib/format.ts`); negative values in red.
- Results (maker–checker): a pending result is detected with `hasPendingResult`; only the admin who entered it
  receives `pendingResult` and sees “ລໍຖ້າແອັດມິນອີກຄົນຢືນຢັນ”. Another admin must re-type the number blind,
  then approve (the settlement summary is shown) or reject.
- Roles (`src/lib/roles.ts`): admin = everything; finance = withdrawals and payouts (everything else read-only);
  auditor = read-only. Actions a role cannot perform are hidden; the server enforces the same rules. Staff cannot
  approve their own withdrawal, payout or KYC — the server's 403 message is shown in the dialog.

### Project layout
```
src/
  api/          client.ts (fetch, refresh), endpoints.ts, errors.ts, tokens.ts, types.ts (+ tests)
  auth/         AuthContext (session restore, sign-in/out), RequireAuth / Can
  components/   Layout (sidebar → top menu ≤ 900 px), Modal/ConfirmDialog, Toast, small UI pieces
  lib/          format, datetime, resultFlow, drawForm, roles, settings, csv, phone (+ tests)
  pages/        Login, PIN, Dashboard, draws/ (list, create, detail, exposure, results), kyc/,
                Withdrawals, Payouts, Users, Audit, Settings, Reports
  styles/       global.css (design tokens as CSS variables)
```
