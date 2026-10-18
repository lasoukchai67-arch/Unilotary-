#!/usr/bin/env bash
# ແລ່ນ test ກັບ Postgres + Redis ຊົ່ວຄາວ (ລຶບຖິ້ມຫຼັງແລ່ນແລ້ວ).
# ຖ້າມີ DATABASE_URL ແລະ REDIS_URL ຢູ່ແລ້ວ (ເຊັ່ນໃນ CI) ຈະໃຊ້ອັນນັ້ນເລີຍ.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "${DATABASE_URL:-}" ] && [ -n "${REDIS_URL:-}" ]; then
  export NODE_ENV=test
  exec npx tsx --test --test-concurrency=1 test/*.test.ts
fi

PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}
TMP=$(mktemp -d)
PGPORT=${PGPORT:-$((20000 + RANDOM % 20000))}
REDISPORT=${REDISPORT:-$((40000 + RANDOM % 20000))}

if [ "$(id -u)" = 0 ]; then RUN="runuser -u postgres --"; chown -R postgres "$TMP"; else RUN=""; fi

cleanup() {
  $RUN "$PGBIN/pg_ctl" -D "$TMP/pg" -m immediate -w stop >/dev/null 2>&1 || true
  redis-cli -p $REDISPORT shutdown nosave >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

$RUN "$PGBIN/initdb" -D "$TMP/pg" -U lottery --auth=trust >/dev/null
$RUN "$PGBIN/pg_ctl" -D "$TMP/pg" -o "-p $PGPORT -k $TMP -c max_connections=300" -l "$TMP/pg.log" -w start >/dev/null || { cat "$TMP/pg.log"; exit 1; }
$RUN "$PGBIN/createdb" -h "$TMP" -p $PGPORT -U lottery lottery
redis-server --port $REDISPORT --save '' --appendonly no --daemonize yes >/dev/null

export DATABASE_URL="postgres://lottery@localhost:$PGPORT/lottery"
export REDIS_URL="redis://localhost:$REDISPORT/0"
export NODE_ENV=test
npx tsx --test --test-concurrency=1 test/*.test.ts
