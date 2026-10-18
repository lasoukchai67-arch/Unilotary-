#!/usr/bin/env bash
# ສຳຮອງຖານຂໍ້ມູນ ແລະ ເອກະສານ KYC ທຸກມື້. ຕັ້ງ cron ເຊັ່ນ:
#   15 3 * * * /opt/lao-lottery/infra/backup.sh /var/backups/lottery >> /var/log/lottery-backup.log 2>&1
# ຄວນ copy ໄຟລ໌ສຳຮອງໄປເກັບອີກບ່ອນໜຶ່ງ (ອີກເຄື່ອງ ຫຼື cloud storage) ແລະ ລອງກູ້ຄືນເດືອນລະເທື່ອ.
set -euo pipefail
DEST=${1:?usage: backup.sh <dest-dir>}
KEEP_DAYS=${KEEP_DAYS:-30}
cd "$(dirname "$0")"
mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)
docker compose -f docker-compose.yml --env-file .env exec -T postgres pg_dump -U lottery -Fc lottery > "$DEST/db-$STAMP.dump"
docker compose -f docker-compose.yml --env-file .env exec -T backend tar -C /data -czf - uploads > "$DEST/uploads-$STAMP.tgz"
find "$DEST" -name 'db-*.dump' -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name 'uploads-*.tgz' -mtime +"$KEEP_DAYS" -delete
echo "backup ok: $STAMP"
# ກູ້ຄືນ: docker compose exec -T postgres pg_restore -U lottery -d lottery --clean < db-XXXX.dump
