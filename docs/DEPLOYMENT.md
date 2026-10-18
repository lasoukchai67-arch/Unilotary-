# ການ Deploy ຂຶ້ນເຊີບເວີ

ຄູ່ມືນີ້ຕິດຕັ້ງລະບົບທັງໝົດໃນເຊີບເວີ Linux ໜ່ວຍດຽວດ້ວຍ Docker Compose. ເໝາະສຳລັບເລີ່ມຕົ້ນ (ຫຼາຍໝື່ນຜູ້ໃຊ້). ເມື່ອຜູ້ໃຊ້ຫຼາຍຂຶ້ນ ໃຫ້ຍ້າຍ PostgreSQL ແລະ Redis ໄປໃຊ້ບໍລິການ managed ແລະ ແລ່ນ backend ຫຼາຍເຄື່ອງ (scheduler ມີ lock ຢູ່ແລ້ວ, ແລ່ນຫຼາຍເຄື່ອງໄດ້ປອດໄພ).

## 1. ສິ່ງທີ່ຕ້ອງມີ

| ລາຍການ | ຂໍ້ແນະນຳ |
|---|---|
| ເຊີບເວີ | 4 vCPU, 8 GB RAM, SSD 100 GB, Ubuntu 24.04. ຄວນຢູ່ໃນລາວ ຫຼື ໃກ້ (ເຊັ່ນ Bangkok/Singapore) ຖ້າກົດໝາຍອະນຸຍາດ |
| ໂດເມນ | ເຊັ່ນ `api.yourcompany.la`, ຊີ້ DNS (A record) ມາຫາ IP ເຊີບເວີ |
| Docker | Docker Engine 24+ ແລະ Docker Compose plugin |
| ບັນຊີ | SMS gateway, merchant account ກັບທະນາຄານ/LAPNet |

## 2. ຕິດຕັ້ງ

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
git clone -b v2-production https://github.com/lasoukchai67-arch/unilotary-.git /opt/lao-lottery
cd /opt/lao-lottery
cp infra/.env.example infra/.env
nano infra/.env        # ໃສ່ DOMAIN, ACME_EMAIL, ລະຫັດສຸ່ມ (openssl rand -hex 32), SMS ແລະ LAPNet
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
docker compose -f infra/docker-compose.yml --env-file infra/.env ps
```

ກວດ: `https://<DOMAIN>/health` ຕ້ອງໄດ້ `{"ok":true}`, ເວັບແອັດມິນຢູ່ `https://<DOMAIN>/admin/`.

> ເຊີບເວີທົດລອງ (staging): ຕັ້ງ `NODE_ENV=development`, `SMS_PROVIDER=mock`, `PAYMENT_PROVIDER=mock` ເພື່ອທົດສອບໂດຍບໍ່ໃຊ້ເງິນແທ້. **ໃນ production ລະບົບຈະບໍ່ຍອມເປີດ ຖ້າຍັງຕັ້ງ mock ຢູ່.**

## 3. ຕັ້ງແອັດມິນຄົນທຳອິດ

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env exec backend \
  node dist/cli/create-admin.js 02055550001 "ຊື່ແອັດມິນ" admin
```

ແລ້ວເຂົ້າ `https://<DOMAIN>/admin/` ດ້ວຍເບີນັ້ນ (OTP) ແລະ ຕັ້ງ PIN. ໃຊ້ `finance` ຫຼື `auditor` ແທນ `admin` ສຳລັບພະນັກງານການເງິນ ຫຼື ຜູ້ກວດສອບ.
ຕ້ອງມີແອັດມິນ **ຢ່າງໜ້ອຍ 2 ຄົນ** ເພາະການຢືນຢັນຜົນລາງວັນຕ້ອງໃຊ້ 2 ຄົນ.

## 4. ເຊື່ອມ SMS ແລະ ທະນາຄານ

- **SMS:** `backend/src/providers/sms.ts` → `HttpSms`. ຖ້າ API ຂອງຜູ້ໃຫ້ບໍລິການຕ່າງຈາກ `POST {to, from, text}` ໃຫ້ແກ້ບ່ອນນີ້ບ່ອນດຽວ.
- **ການຈ່າຍເງິນ:** `backend/src/providers/payments.ts` → `LapnetPayments`. ຕ້ອງຂຽນ 3 ຟັງຊັນຕາມເອກະສານຂອງທະນາຄານ: `createDeposit` (ສ້າງ QR), `parseWebhook` (ກວດລາຍເຊັນ), `payout` (ໂອນອອກ). ລະບົບສ່ວນອື່ນບໍ່ຕ້ອງແກ້.
- URL webhook ທີ່ຕ້ອງໃຫ້ທະນາຄານ: `https://<DOMAIN>/v1/webhooks/payments/lapnet`.

## 5. ແອັບມືຖື

1. ຕັ້ງ GitHub repository variable `API_BASE_URL` = `https://<DOMAIN>/v1` (Settings → Secrets and variables → Actions → Variables).
2. ສ້າງ keystore ສຳລັບເຊັນແອັບ Android ເທື່ອດຽວ ແລະ **ເກັບໄວ້ໃຫ້ດີ** (ເສຍແລ້ວອັບເດດແອັບໃນ Play Store ບໍ່ໄດ້):
   `keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias lottery`
3. ໃສ່ GitHub Secrets: `ANDROID_KEYSTORE_BASE64` (`base64 -w0 release.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
4. Push ໂຄດ → GitHub Actions ສ້າງ APK ໃຫ້ດາວໂຫຼດ. ສຳລັບ Play Store ໃຊ້ `flutter build appbundle`; iOS ຕ້ອງ build ໃນ Mac ທີ່ມີ Xcode ແລະ Apple Developer account.

## 6. ສຳຮອງຂໍ້ມູນ

```bash
chmod +x infra/backup.sh
sudo crontab -e
# 15 3 * * * /opt/lao-lottery/infra/backup.sh /var/backups/lottery >> /var/log/lottery-backup.log 2>&1
```

Copy ໄຟລ໌ສຳຮອງອອກໄປເກັບນອກເຊີບເວີທຸກມື້ ແລະ ລອງກູ້ຄືນ (`pg_restore`) ເດືອນລະເທື່ອ.

## 7. ອັບເດດລະບົບ

```bash
cd /opt/lao-lottery && git pull
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

Migration ຖານຂໍ້ມູນແລ່ນອັດຕະໂນມັດຕອນ backend ເປີດ. ຢ່າອັບເດດໃນຊ່ວງ 1 ຊົ່ວໂມງກ່ອນປິດງວດ.

## 8. ຕິດຕາມລະບົບ

- Log: `docker compose ... logs -f backend` (ຮູບແບບ JSON, ສົ່ງເຂົ້າ Loki/ELK ໄດ້).
- ກວດສຸຂະພາບ: `GET /ready` (ກວດ DB + Redis) ເໝາະສຳລັບ uptime monitor (ເຊັ່ນ UptimeRobot).
- ຕັ້ງການແຈ້ງເຕືອນເມື່ອ: `/ready` ລົ້ມ, disk ເຫຼືອ < 20%, ບໍ່ມີໄຟລ໌ສຳຮອງໃໝ່ພາຍໃນ 24 ຊົ່ວໂມງ.
