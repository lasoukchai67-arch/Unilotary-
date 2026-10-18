# API Contract v1

Base URL: `https://<host>/v1` (dev: `http://localhost:3000/v1`). Interactive docs: `GET /docs`.

## Conventions

- JSON only, camelCase keys. Money is an **integer number of kip** (LAK). Timestamps are ISO-8601 strings (UTC).
- Auth: `Authorization: Bearer <accessToken>` (15 min). Renew with `/auth/refresh` (refresh token 30 days, rotated on every use).
- Errors: HTTP 4xx/5xx with body `{ "error": "<CODE>", "message": "<Lao text for display>", "details"?: any }`.
  Codes: `VALIDATION, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, DRAW_NOT_OPEN, USER_NOT_ALLOWED, NUMBER_LIMIT, INSUFFICIENT_BALANCE, DAILY_CAP, PIN_REQUIRED, PIN_INVALID, PIN_LOCKED, PROVIDER_ERROR, INTERNAL`.
- Lists: `?limit=` (default 20, max 100) and `?before=<id>` cursor; response `{ "items": [...], "nextBefore": number | null }`.
- Phone numbers: Lao mobile, `020XXXXXXXX` (11 digits) or `030XXXXXXX` (10 digits). Spaces/dashes are stripped; `+856`/`856` prefix is converted to `0`.
- PIN: exactly 6 digits. 5 wrong PINs lock PIN-protected actions for 15 minutes (`PIN_LOCKED`).

## Shared objects

```jsonc
// User
{ "id": 1, "phone": "02055551234", "fullName": "ສົມໃຈ" | null, "role": "customer|agent|admin|finance|auditor",
  "kyc": "unsubmitted|pending|verified|rejected", "kycNote": null, "status": "active|suspended|closed",
  "pinSet": true, "dailySpendCap": 200000 | null, "selfExcludedUntil": "2026-11-01T00:00:00Z" | null,
  "balance": 250000, "held": 0, "commissionBp": 0, "createdAt": "..." }

// DigitRule (public view)
{ "digits": 2, "payoutRate": 60, "minAmount": 1000, "maxPerLine": 100000 }

// Draw
{ "id": 7, "drawNo": "0123", "drawDate": "2026-10-19", "salesOpenAt": "...", "salesCloseAt": "...",
  "status": "scheduled|open|closed|resulted|cancelled", "resultNumber": "482175" | null, "resultedAt": null,
  "rules": [DigitRule], "serverTime": "..." }
// Admin view of Draw adds: "pendingResult": "482175"|null, "resultEnteredBy": 3|null,
//   "rules": [DigitRule + "defaultNumberCap"], "stats": { "sales": 1500000, "tickets": 42 }

// TicketLine
{ "number": "27", "digits": 2, "amount": 10000, "payoutRate": 60, "winAmount": 0 }

// Ticket
{ "id": 9, "ticketNo": "LT-0123-000009", "verifyCode": "A7F392KD", "drawId": 7, "drawNo": "0123",
  "status": "active|won|lost|paid|cancelled", "totalAmount": 30000, "totalWin": 0, "createdAt": "...",
  "buyerPhone": null, "lines": [TicketLine] }
// The purchase response also has "balanceAfter" and "replayed" (true = same Idempotency-Key seen before).

// Deposit
{ "id": 3, "amount": 100000, "status": "pending|success|failed|expired", "provider": "mock",
  "qrPayload": "<string to render as QR>", "expiresAt": "...", "createdAt": "..." }

// Withdrawal
{ "id": 4, "amount": 50000, "bankName": "BCEL", "accountNo": "0101...", "accountName": "...",
  "status": "requested|approved|paid|rejected|failed", "note": null, "createdAt": "...", "updatedAt": "..." }

// WalletTx
{ "id": 1, "type": "deposit|withdraw|purchase|payout|refund|commission|adjust", "amount": -30000,
  "balanceAfter": 220000, "refType": "ticket", "refId": 9, "note": null, "createdAt": "..." }

// Notification
{ "id": 1, "title": "...", "body": "...", "data": {} | null, "readAt": null, "createdAt": "..." }
```

## Auth

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/otp/request` | `{ phone }` | `{ expiresInSec: 300, devCode?: "123456" }` (`devCode` only when the server runs the mock SMS provider). Rate limit: 1 per 60 s per phone, 5 per hour. |
| POST | `/auth/otp/verify` | `{ phone, code }` | `{ accessToken, refreshToken, expiresInSec, user: User }`. New phone numbers are registered automatically. 5 wrong codes invalidate the OTP. |
| POST | `/auth/refresh` | `{ refreshToken }` | same as verify |
| POST | `/auth/logout` | `{ refreshToken }` | 204 |

## Me

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/me` | | User |
| POST | `/me/pin` | `{ pin, currentPin? }` (`currentPin` required when a PIN is already set) | 204 |
| PATCH | `/me/settings` | `{ dailySpendCap: number \| null, pin }` | User |
| POST | `/me/self-exclusion` | `{ days: 1..365, pin }` | User. Purchases are blocked until `selfExcludedUntil`; cannot be shortened by the user. |
| POST | `/me/kyc` | multipart: `fullName`, `birthDate` (YYYY-MM-DD, age ≥ 18), `idCardNo`, file `photo` (jpeg/png ≤ 5 MB) | User (`kyc: "pending"`) |

## Draws (public, no auth)

| Method | Path | Response |
|---|---|---|
| GET | `/draws/current` | Draw: the open draw, else the next scheduled one; 404 if none |
| GET | `/draws?status=&limit=` | `{ items: Draw[] }` newest first |
| GET | `/draws/:id` | Draw |

Winning rule: a line wins when its number equals the **last N digits** of the 6-digit result (N = 2..6). `winAmount = floor(amount × payoutRate)`.

## Tickets (auth)

| Method | Path | Notes |
|---|---|---|
| POST | `/draws/:drawId/tickets` | Header `Idempotency-Key` (8–80 chars `[A-Za-z0-9_-]`, generate a new UUID per purchase attempt and reuse it on retry). Body `{ lines: [{ number: "27", amount: 10000 }] }` (1–50 lines). 201 new / 200 replay. Requires `kyc = verified`. Errors: `NUMBER_LIMIT` with `details: [{ number, reason: "closed|full|norule", remaining }]`, `INSUFFICIENT_BALANCE`, `DAILY_CAP`, `DRAW_NOT_OPEN`, `USER_NOT_ALLOWED` (KYC / self-exclusion / suspended). |
| GET | `/tickets?limit=&before=` | `{ items: Ticket[], nextBefore }` |
| GET | `/tickets/:id` | Ticket (own tickets only) |
| GET | `/tickets/verify/:ticketNo?code=` | public: `{ ticketNo, drawNo, status, totalAmount, totalWin, createdAt, lines: [{ number, amount }] }` |

## Wallet (auth)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/wallet` | | `{ balance, held }` |
| GET | `/wallet/transactions?limit=&before=` | | `{ items: WalletTx[], nextBefore }` |
| POST | `/wallet/deposits` | `{ amount }` (min/max from settings) | Deposit. Show `qrPayload` as a QR code, poll `GET /wallet/deposits/:id` every 3 s until not `pending`. |
| GET | `/wallet/deposits/:id` | | Deposit |
| POST | `/wallet/withdrawals` | `{ amount, bankName, accountNo, accountName, pin }` | Withdrawal (amount moves from balance to held) |
| GET | `/wallet/withdrawals?limit=&before=` | | `{ items: Withdrawal[], nextBefore }` |
| POST | `/dev/deposits/:id/simulate` | `{ status: "success" \| "failed" }` | Deposit — **only when the server runs the mock payment provider** (development/testing). |

Payment provider webhook (server-to-server): `POST /webhooks/payments/:provider`, header `X-Signature: hex(HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, rawBody))`, body `{ providerRef, status: "success" | "failed", amount }`. Idempotent.

## Notifications (auth)

| Method | Path | Response |
|---|---|---|
| GET | `/notifications?limit=&before=` | `{ items: Notification[], nextBefore, unread }` |
| POST | `/notifications/:id/read` | 204 |
| POST | `/notifications/read-all` | 204 |

## Agent (role `agent`)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/agent/sales` | header `Idempotency-Key`; `{ drawId, buyerPhone?, lines }` | Ticket (paid from the agent's wallet; commission = `commissionBp`/10000 of the total, credited when the draw is settled) |
| GET | `/agent/summary` | | `{ sales, tickets, commissionPending, commissionSettled }` |

## Admin (`/admin/*`)

Roles: `admin` = everything; `finance` = dashboard, withdrawals, payouts, reports (read others); `auditor` = all GET endpoints only.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/admin/dashboard` | | `{ today: { sales, tickets, deposits, withdrawals }, users: { total, verified }, pending: { kyc, withdrawals, payouts, results }, currentDraw: Draw \| null }` |
| GET | `/admin/draws?status=&limit=&before=` | | `{ items: AdminDraw[], nextBefore }` |
| GET | `/admin/draws/:id` | | AdminDraw |
| POST | `/admin/draws` | `{ drawNo, drawDate, salesOpenAt, salesCloseAt, rules: [{ digits, payoutRate, minAmount, maxPerLine, defaultNumberCap }] }` | AdminDraw (`scheduled`; opens/closes automatically at the given times) |
| POST | `/admin/draws/:id/open` · `/close` | | AdminDraw |
| POST | `/admin/draws/:id/cancel` | `{ reason }` | AdminDraw — every active ticket is refunded to the wallet |
| GET | `/admin/draws/:id/exposure?digits=2&limit=50` | | `{ items: [{ number, sold, cap, payoutRate, exposure, closed }] }` sorted by exposure (sold × rate) |
| PUT | `/admin/draws/:id/numbers/:number/limit` | `{ cap: number \| null, payoutRate: number \| null, closed: boolean }` | 204 |
| POST | `/admin/draws/:id/result` | `{ resultNumber }` (draw must be `closed`) | AdminDraw with `pendingResult` (maker step) |
| POST | `/admin/draws/:id/result/approve` | `{ resultNumber }` — a **different** admin re-types the number; must match | `{ draw: AdminDraw, settlement: { winners, totalWin, autoPaid, pendingPayouts } }` |
| POST | `/admin/draws/:id/result/reject` | | AdminDraw (pending result cleared) |
| GET | `/admin/kyc?status=pending&limit=&before=` | | `{ items: [{ userId, phone, fullName, birthDate, idCardNo, kyc, submittedAt }], nextBefore }` |
| GET | `/admin/kyc/:userId/document` | | image bytes |
| POST | `/admin/kyc/:userId/approve` · `/reject` | reject: `{ note }` | User |
| GET | `/admin/withdrawals?status=requested&limit=&before=` | | `{ items: [Withdrawal + userId, userPhone], nextBefore }` |
| POST | `/admin/withdrawals/:id/approve` · `/reject` | reject: `{ note }` | Withdrawal (approve sends the money through the payment provider → `paid` or `failed`; reject/failed refunds the wallet) |
| GET | `/admin/payouts?status=pending&limit=&before=` | | `{ items: [{ id, ticketId, ticketNo, userId, userPhone, amount, status, createdAt }], nextBefore }` |
| POST | `/admin/payouts/:id/approve` · `/reject` | reject: `{ note }` | payout item |
| GET | `/admin/users?q=&role=&limit=&before=` | | `{ items: User[], nextBefore }` (`q` matches phone or name) |
| PATCH | `/admin/users/:id` | `{ role?, status?, commissionBp? }` (admin only) | User |
| GET | `/admin/audit?limit=&before=` | | `{ items: [{ id, actorId, actorPhone, action, entity, entityId, before, after, createdAt }], nextBefore }` |
| GET | `/admin/settings` | | `{ items: [{ key, value }] }` |
| PUT | `/admin/settings/:key` | `{ value }` (admin only) | `{ key, value }` |
| GET | `/admin/reports/draws/:id` | | `{ drawNo, status, resultNumber, sales: { total, tickets, byDigits: [{ digits, amount, lines }] }, payouts: { total, paid, pending }, commissions, net }` |

Settings keys: `payout_auto_limit` (prizes up to this amount are credited automatically; larger ones wait for approval), `deposit_min`, `deposit_max`, `withdraw_min`, `withdraw_max_daily`.
