# ໂຊກໄຊ ພັດທະນາ - ແອັບຊື້ຫວຍອອນລາຍ (Sokxay Lao Lottery Platform)

ລະບົບແອັບຊື້ຫວຍລາວ ໂຊກໄຊ ພັດທະນາ ແບບ 3-Tier Enterprise Architecture ທີ່ສາມາດຕິດຕັ້ງ ແລະ ໃຊ້ງານໄດ້ເທິງທຸກລຸ້ນຂອງ **Android** ແລະ **iOS (iPhone/iPad)**.

---

## 🌟 ຄຸນສົມບັດຫຼັກຂອງລະບົບ (Core Features)

1. **ການຊື້ຫວຍ (Lottery Purchasing)**:
   - ຊື້ເລກ 1 ໂຕ, 2 ໂຕ, 3 ໂຕ, 4 ໂຕ, 5 ໂຕ, ແລະ 6 ໂຕ ຜ່ານແປ້ນພິມດິຈິຕອນ.
   - ຄຳນວນເງິນລາງວັນທີ່ອາດຈະໄດ້ຮັບແບບ Real-time ຕາມອັດຕາຄູນມາດຕະຖານ:
     - 1 ໂຕ: 8.5x (8,500₭ ຕໍ່ 1,000₭)
     - 2 ໂຕ / ນາມສັດ: 60x (60,000₭ ຕໍ່ 1,000₭)
     - 3 ໂຕ: 500x (500,000₭ ຕໍ່ 1,000₭)
     - 4 ໂຕ: 6,000x (6,000,000₭ ຕໍ່ 1,000₭)
     - 5 ໂຕ: 40,000x (40,000,000₭ ຕໍ່ 1,000₭)
     - 6 ໂຕ: 400,000x (400,000,000₭ ຕໍ່ 1,000₭)
   - ປຸ່ມສຸ່ມເລກໂຊກ (🎲 Quick Random).
2. **ຫວຍນາມສັດ 40 ໂຕ (40 Lao Animal Numbers)**:
   - ຕາຕະລາງໂຕສັດ 40 ໂຕຄົບຖ້ວນ (01 ປາໃຫຍ່, 02 ຫອຍ, 03 ຫ່ານ, ... 28 ໄກ່, ... 40 ນົກອິນຊີ) ພ້ອມເລກປະຈຳໂຕສັດ ແລະ ເລກທີ່ກ່ຽວຂ້ອງ.
   - ແຕະເລືອກໂຕສັດ ແລ້ວເພີ່ມໃສ່ໃບບິນໄດ້ທັນທີ.
3. **ໃບບິນຫວຍດີຈິຕອນ (Digital Ticket Slip)**:
   - ອອກໃບບິນຫວຍພ້ອມ Barcode, Serial Number (`SX-2026-XXXX-XXXX`), ງວດວັນທີ, ແລະ ລາຍການເລກທີ່ຊື້.
   - ສາມາດພິມ (Print) ຫຼື ບັນທຶກໃບບິນໄວ້ເປັນຫຼັກຖານ.
4. **ລະບົບການເງິນ & BCEL OnePay QR (Double-Entry Ledger)**:
   - ກະເປົາເງິນ (Wallet) ສະແດງຍອດເງິນກີບ (LAK).
   - ສະແກນ QR Code ເຕີມເງິນແບບ BCEL OnePay / Lao QR.
   - ລະບົບບັນຊີຄູ່ (Double-Entry General Ledger) ຕັດເງິນ ແລະ ຈ່າຍລາງວັນແບບອັດຕະໂນມັດ ຮັບປະກັນຄວາມຖືກຕ້ອງ 100%.
5. **ການກວດລາງວັນ & ຈຳລອງການອອກເລກ (Draw Results Engine)**:
   - ໂມງນັບຖອຍຫຼັງຮອດເວລາອອກເລກ 20:00 ໂມງ.
   - ລະບົບກວດຫວຍອັດຕະໂນມັດ (Auto Prize Evaluation) ແລະ ໂອນເງິນລາງວັນເຂົ້າກະເປົາທັນທີເມື່ອຖືກລາງວັນ.

---

## 📱 ວິທີການຕິດຕັ້ງເທິງ Android ແລະ iOS

ລະບົບຮອງຮັບ **Progressive Web App (PWA)** ທີ່ສາມາດຕິດຕັ້ງເປັນແອັບ Native ເທິງໜ້າຈໍມືຖືໄດ້ທັນທີ ໂດຍບໍ່ຕ້ອງຜ່ານ Play Store / App Store:

### 🤖 ສຳລັບ Android (ທຸກລຸ້ນ):
1. ເປີດເວັບໄຊຜ່ານ Chrome Browser: `http://<IP_OR_DOMAIN>:8080`
2. ກົດປຸ່ມ **"ຕິດຕັ້ງເລີຍ"** ຢູ່ແຖບດ້ານເທິງ ຫຼື ໃນເມນູ
3. ກົດຢືນຢັນ **"Install"**
4. ໄອຄອນແອັບ "ຫວຍໂຊກໄຊ" ຈະປະກົດຢູ່ໜ້າຈໍຫຼັກມືຖື ແລະ ເປີດໃຊ້ງານແບບ Full-screen ຄືແອັບປົກກະຕິ.

### 🍏 ສຳລັບ iPhone / iPad (iOS ທຸກລຸ້ນ):
1. ເປີດເວັບໄຊຜ່ານ **Safari Browser**
2. ກົດປຸ່ມ Share (ໄອຄອນ ⬆️ ຢູ່ກາງແຖບລຸ່ມ)
3. ເລື່ອນລົງແລ້ວເລືອກ **"Add to Home Screen" (ເພີ່ມໃສ່ໜ້າຈໍຫຼັກ)**
4. ກົດ **"Add" (ເພີ່ມ)**
5. ແອັບຈະຕິດຕັ້ງຢູ່ໜ້າຈໍ iPhone ທັນທີ ພ້ອມໄອຄອນ ແລະ ເປີດໃຊ້ງານແບບເຕັມຈໍ (Standalone Mode).

---

## 💻 ວິທີການ Run ລະບົບ (Developer Instructions)

### 1. ຕິດຕັ້ງ Dependencies
```powershell
pip install -r backend/requirements.txt
```

### 2. ເລີ່ມຕົ້ນ Run Server
```powershell
python run.py
```
- **Web App**: [http://localhost:8080](http://localhost:8080)
- **API Documentation (Swagger)**: [http://localhost:8080/docs](http://localhost:8080/docs)

---

## 🗄️ ໂຄງສ້າງຖານຂໍ້ມູນ (PostgreSQL DDL)

ໄຟລ໌ DDL ທັງໝົດຢູ່ໃນ:
- `backend/sql/01_schemas.sql`: ຕາຕະລາງທັງໝົດ (`security`, `lottery`, `finance`, `audit`, `storage`, `staging`)
- `backend/sql/02_audit_triggers.sql`: PostgreSQL Triggers ບັນທຶກ Mutation Logs ແບບ Immutable ສຳລັບການກວດສອບພາຍໃນ.
- `backend/app/etl/etl_legacy_data.py`: ສະຄຣິບ Pandas ETL ດຶງຂໍ້ມູນເກົ່າເຂົ້າ `staging` ກ່ອນຍ້າຍເຂົ້າ `production`.
- `backend/app/services/storage_service.py`: Service Class ສຳລັບຈັດການ Cloud Storage (S3 / GCS / Local) ພ້ອມ Presigned URLs.

---

## 🚀 ສຳລັບນັກພັດທະນາ (Developer Hand-off Guide)

ສຳລັບນັກພັດທະນາ (Backend/DevOps) ທີ່ຈະມາຮັບຊ່ວງຕໍ່ ເພື່ອເອົາລະບົບຂຶ້ນ Production (ເຊັ່ນ Render.com ຫຼື VPS), ໃຫ້ປະຕິບັດຕາມນີ້:

1. **ສ້າງໄຟລ໌ Environment Variables**:
   - ກັອບປີ້ໄຟລ໌ `backend/.env.example` ປ່ຽນຊື່ເປັນ `backend/.env`.
   - ຕື່ມ `DATABASE_URL` (ຕ້ອງເປັນ PostgreSQL), ແລະ ຂໍ້ມູນ Cloudflare R2 / AWS S3 ໃຫ້ຄົບຖ້ວນ.

2. **ຕິດຕັ້ງຖານຂໍ້ມູນ (Database Initialization)**:
   - ເນື່ອງຈາກລະບົບຮຽກຮ້ອງ Immutable Audit ຜ່ານ Database Triggers, ເຮົາຈຳເປັນຕ້ອງໃຊ້ PostgreSQL.
   - ໃຫ້ລັນສະຄຣິບ: `python backend/init_db.py` ເພື່ອທຳການສ້າງ Schemas, ຕາຕະລາງ ແລະ Triggers ຕ່າງໆແບບອັດຕະໂນມັດ (ອ່ານໂຄດຈາກ `sql/01_schemas.sql` ແລະ `sql/02_audit_triggers.sql`).

3. **ອັບເດດ URL ໜ້າ Frontend**:
   - ຢ່າລືມເຂົ້າໄປແກ້ໄຂໄຟລ໌ `frontend/src/services/api.js` ປ່ຽນຄ່າ `API_BASE` ໃຫ້ຊີ້ໄປຫາ URL ຂອງ Backend Server ທີ່ທ່ານ Deploy ແລ້ວ.

**Tech Stack Requirements (Production)**:
- Python 3.10+ (FastAPI, SQLAlchemy, Pandas)
- PostgreSQL 14+ (ຮອງຮັບ JSONB & Triggers)
- S3-Compatible Storage (AWS S3, Cloudflare R2, ຫລື MinIO)
