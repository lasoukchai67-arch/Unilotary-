# ແອັບຂາຍຫວຍພັດທະນາ (v2)

ລະບົບຂາຍຫວຍພັດທະນາອອນລາຍ ສຳລັບຕົວແທນຈຳໜ່າຍທີ່ໄດ້ຮັບອະນຸຍາດ: ແອັບມືຖືສຳລັບຜູ້ຊື້ ແລະ ຕົວແທນ, ເວັບແອັດມິນ, ແລະ backend ທີ່ຄຸມເງິນ ແລະ ວົງເງິນຕໍ່ເລກແບບ real-time.

| ສ່ວນ | ໂຟນເດີ | ເຕັກໂນໂລຢີ |
|---|---|---|
| Backend API | [`backend/`](backend) | Node.js 22, TypeScript, Fastify, PostgreSQL 16, Redis 7 |
| ຖານຂໍ້ມູນ | [`db/migrations/`](db/migrations) | SQL migrations (ແລ່ນອັດຕະໂນມັດຕອນ backend ເປີດ) |
| ເວັບແອັດມິນ | [`admin/`](admin) | React, TypeScript, Vite |
| ແອັບມືຖື | [`mobile/`](mobile) | Flutter (Android, iOS) |
| Deploy | [`infra/`](infra) | Docker Compose, Caddy (HTTPS ອັດຕະໂນມັດ) |
| ເອກະສານ | [`docs/`](docs) | [API](docs/API.md), [ການ deploy](docs/DEPLOYMENT.md), [ວຽກປະຈຳວັນ](docs/OPERATIONS.md), [ກວດກ່ອນເປີດໃຊ້](docs/GO-LIVE-CHECKLIST.md) |

## ສະຖານະ

- ✅ ລະບົບທັງໝົດເຮັດວຽກໄດ້ຄົບໃນ **ໂໝດທົດລອງ** (OTP ແລະ ການຈ່າຍເງິນແບບຈຳລອງ).
- ⏳ ກ່ອນເປີດໃຊ້ຈິງ ຕ້ອງມີ: ໃບອະນຸຍາດຕົວແທນ, API ຂອງທະນາຄານ/LAPNet, SMS gateway, ເຊີບເວີ ແລະ ໂດເມນ, ການທົດສອບຄວາມປອດໄພ (pentest). ເບິ່ງ [GO-LIVE-CHECKLIST](docs/GO-LIVE-CHECKLIST.md).

## ເລີ່ມໃຊ້ໃນເຄື່ອງ (development)

```bash
# 1) ຖານຂໍ້ມູນ ແລະ Redis (ຫຼືໃຊ້ທີ່ຕິດຕັ້ງໃນເຄື່ອງແລ້ວ)
docker run -d --name lottery-pg -e POSTGRES_USER=lottery -e POSTGRES_PASSWORD=lottery -p 5432:5432 postgres:16-alpine
docker run -d --name lottery-redis -p 6379:6379 redis:7-alpine

# 2) Backend
cd backend
cp .env.example .env          # ແກ້ JWT_SECRET ໃຫ້ຍາວ 32 ໂຕຂຶ້ນໄປ
npm install
npm run create-admin -- 02055550001 "ຊື່ແອັດມິນ"
npm run dev                   # http://localhost:3000, ເອກະສານ API: http://localhost:3000/docs

# 3) ເວັບແອັດມິນ
cd ../admin && npm install && npm run dev      # http://localhost:5173/admin/

# 4) ແອັບມືຖື
cd ../mobile && flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/v1   # Android emulator
```

ໃນໂໝດທົດລອງ, ລະຫັດ OTP ຈະສົ່ງກັບມາໃນ response (`devCode`) ແລະ ສະແດງໃນແອັບ, ແລະ ມີປຸ່ມ "ຈຳລອງການຈ່າຍເງິນ" ສຳລັບເຕີມເງິນ.

## Test

```bash
cd backend && npm test        # ເປີດ PostgreSQL + Redis ຊົ່ວຄາວ ແລ້ວແລ່ນ integration test ທັງໝົດ
cd admin && npm test
cd mobile && flutter test
```

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) ແລ່ນ test ທຸກສ່ວນ, ກວດ Docker image, ແລະ ສ້າງໄຟລ໌ **APK** ໃຫ້ດາວໂຫຼດໃນໜ້າ Actions → artifacts.

## ຫຼັກການສຳຄັນຂອງລະບົບ

- **ເງິນ:** ເກັບເປັນກີບຈຳນວນເຕັມ. ທຸກການເຄື່ອນໄຫວຜ່ານ ledger ທີ່ແກ້ບໍ່ໄດ້ (`wallet_transactions`), ຍອດເງິນ = ຜົນລວມຂອງ ledger ສະເໝີ.
- **ວົງເງິນຕໍ່ເລກ:** ກວດ ແລະ ຈອງແບບ atomic ໃນ Redis, ແລະ ມີ CHECK ໃນ PostgreSQL ເປັນດ່ານສຸດທ້າຍ: ຂາຍເກີນວົງເງິນບໍ່ໄດ້ ເຖິງວ່າຄົນຊື້ພ້ອມກັນຫຼາຍ.
- **ບໍ່ຕັດເງິນຊ້ຳ:** ການຊື້ທຸກຄັ້ງໃຊ້ `Idempotency-Key`; webhook ຂອງທະນາຄານກວດລາຍເຊັນ ແລະ ປະມວນຜົນເທື່ອດຽວ.
- **ຜົນລາງວັນ:** ແອັດມິນຄົນໜຶ່ງປ້ອນ, ອີກຄົນພິມຊ້ຳເພື່ອຢືນຢັນ (maker–checker). ລາງວັນນ້ອຍຈ່າຍເຂົ້າກະເປົາອັດຕະໂນມັດ, ຍອດໃຫຍ່ຕ້ອງອະນຸມັດ.
- **ຄວາມຮັບຜິດຊອບ:** KYC 18+, ວົງເງິນຊື້ຕໍ່ມື້, ພັກການຫຼິ້ນ, ບໍ່ມີການຊື້ຕິດໜີ້.
- **ກວດສອບ:** ທຸກການກະທຳຂອງແອັດມິນບັນທຶກໃນ `audit_logs` ທີ່ລຶບ ຫຼື ແກ້ບໍ່ໄດ້.

---

## English summary

Production-ready codebase for a licensed Lao Development Lottery reseller: Flutter customer/agent app, React admin, and a Fastify/PostgreSQL/Redis backend with an append-only wallet ledger, atomic per-number sales caps, idempotent purchases, signed payment webhooks, maker–checker result entry, automatic settlement, KYC and responsible-gaming controls. Runs end-to-end with mock SMS/payment providers; plug in the real SMS gateway and LAPNet/bank adapters (`backend/src/providers/`) before go-live. See `docs/` for the API contract, deployment, operations and the go-live checklist.
