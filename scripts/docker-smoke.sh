#!/usr/bin/env bash
# =============================================================================
# Voom! — image smoke test: runtime dependencies, boot, migrations, data persistence.
#
# Usage: scripts/docker-smoke.sh <image> [platform]
#        scripts/docker-smoke.sh voom:test linux/arm64
# Env:   MAX_IMAGE_MB (0 = unchecked), SMOKE_WAIT_TRIES (x2 s), SMOKE_RESTARTS
# Exits non-zero on the first failed check and cleans up what it creates.
# =============================================================================
set -euo pipefail

IMAGE="${1:?Usage: docker-smoke.sh <image> [platform]}"
PLATFORM="${2:-}"
MAX_MB="${MAX_IMAGE_MB:-0}"
TRIES="${SMOKE_WAIT_TRIES:-60}"
RESTARTS="${SMOKE_RESTARTS:-10}"
NAME="voom-smoke-$$"
VOL="voom-smoke-data-$$"
PLAT=()
[ -z "$PLATFORM" ] || PLAT=(--platform "$PLATFORM")

pass() { printf '  \033[32mOK\033[0m   %s\n' "$*"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$*" >&2; docker logs "$NAME" 2>&1 | tail -30 >&2 || true; exit 1; }
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; docker volume rm -f "$VOL" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# Run a command in the image with the data volume mounted.
node_run() { docker run --rm "${PLAT[@]}" --entrypoint node -e NODE_ENV=production "$IMAGE" "$@"; }
data_node() { docker run --rm "${PLAT[@]}" -v "$VOL:/data" --user node --entrypoint node -w /app/frontend "$IMAGE" --input-type=module -e "$1"; }
start() { docker run -d --name "$NAME" "${PLAT[@]}" -e ORIGIN=http://localhost:3000 -v "$VOL:/data" "$IMAGE" >/dev/null; }
exec_in() { docker exec "$NAME" "$@"; }
# Poll the health endpoint directly: the image's HEALTHCHECK interval (30 s) is too slow for repeated restarts.
wait_ready() {
	local i
	for i in $(seq 1 "$TRIES"); do
		exec_in wget -qO /dev/null http://127.0.0.1:3000/api/health 2>/dev/null && return 0
		[ "$(docker inspect -f '{{.State.Running}}' "$NAME")" = true ] || fail "container stopped"
		sleep 2
	done
	fail "/api/health did not respond in time"
}
http_code() { exec_in wget -S -qO /dev/null "http://127.0.0.1:3000$1" 2>&1 | awk '/HTTP\//{c=$2} END{print c}'; }
# Stamp the schema and every migration as applied, like a database from the previous release.
seed_previous_db() {
	data_node "
import {createClient} from '@libsql/client'; import fs from 'node:fs';
const c=createClient({url:'file:/data/database.sqlite'});
await c.executeMultiple(fs.readFileSync('/app/schema_sqlite.sql','utf8'));
await c.execute('CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
for (const f of fs.readdirSync('/app/migrations').filter(f=>f.endsWith('.sql')&&!f.endsWith('.down.sql'))) await c.execute({sql:'INSERT OR IGNORE INTO _migrations(name) VALUES (?)',args:[f]});
c.close();" >/dev/null
}

echo "== Image: $IMAGE ${PLATFORM:+($PLATFORM)}"

# 0. Size
MB=$(($(docker image inspect "$IMAGE" --format '{{.Size}}') / 1000000))
echo "  uncompressed size: ${MB} MB"
if [ "$MAX_MB" -gt 0 ] && [ "$MB" -gt "$MAX_MB" ]; then fail "image is ${MB} MB, over the ${MAX_MB} MB budget"; fi

# 1. Runtime dependencies resolve on musl
echo "== Runtime dependencies"
node_run --input-type=module -e "
import {createClient} from '@libsql/client';
const c=createClient({url:'file:/tmp/t.db'});
await c.execute('CREATE TABLE t(a)'); await c.execute('INSERT INTO t VALUES (1)');
if(Number((await c.execute('SELECT a FROM t')).rows[0].a)!==1) process.exit(1); c.close();
" && pass "@libsql/client reads/writes" || fail "@libsql/client"
node_run --input-type=module -e "
import 'socket.io'; import 'jsonwebtoken'; import 'bcryptjs'; import 'nodemailer'; import 'pino'; import 'image-size'; import 'dotenv'; import 'web-push';
" && pass "other runtime dependencies resolve" || fail "runtime dependencies"

# 2. Boot with an empty volume
echo "== Boot (empty volume)"
docker volume create "$VOL" >/dev/null
start; wait_ready
pass "/api/health responds"
[ "$(http_code /install)" = 200 ] && pass "install wizard renders (200)" || fail "/install returned $(http_code /install)"
exec_in sh -c 'test -s /data/.jwt_secret' && pass "JWT secret generated in the volume" || fail "JWT secret missing"
[ "$(exec_in sh -c 'ps -o user= -o comm= | awk "\$2==\"node\"{print \$1; exit}"')" = node ] && pass "runs as non-root user node" || fail "process runs as root"
JWT1="$(exec_in cat /data/.jwt_secret)"
exec_in sh -c 'mkdir -p /data/uploads && echo keep > /data/uploads/marker.txt'

# 3. Existing database (upgrade): migrations run on boot
echo "== Upgrade with existing data"
docker rm -f "$NAME" >/dev/null
seed_previous_db && pass "previous-release database created" || fail "could not prepare the previous database"
start; wait_ready
TOTAL="$(exec_in sh -c 'ls /app/migrations/*.sql | grep -vc "\.down\.sql$"')"
APPLIED="$(exec_in node --input-type=module -e "
import {createClient} from '@libsql/client'; const c=createClient({url:'file:/data/database.sqlite'});
console.log((await c.execute('SELECT COUNT(*) AS n FROM _migrations')).rows[0].n); c.close();" 2>/dev/null || echo 0)"
[ "$APPLIED" = "$TOTAL" ] && pass "migrations up to date ($APPLIED/$TOTAL)" || fail "migrations applied: $APPLIED of $TOTAL"

# 4. Persistence across container recreation
echo "== Persistence"
docker rm -f "$NAME" >/dev/null
start; wait_ready
[ "$(exec_in cat /data/.jwt_secret)" = "$JWT1" ] && pass "JWT secret unchanged" || fail "JWT secret changed"
[ "$(exec_in cat /data/uploads/marker.txt)" = keep ] && pass "uploads intact" || fail "upload marker lost"

# 5. Volume left by an older release (root-owned) must stay writable
echo "== Legacy volume (root-owned)"
docker rm -f "$NAME" >/dev/null
docker run --rm "${PLAT[@]}" -v "$VOL:/data" --user 0 --entrypoint sh "$IMAGE" -c 'chown -R 0:0 /data'
start; wait_ready
exec_in sh -c 'touch /data/.write-test && rm /data/.write-test' && pass "entrypoint fixed permissions" || fail "volume not writable"
[ "$(exec_in cat /data/uploads/marker.txt)" = keep ] && pass "data intact after the fix" || fail "data lost"

# 6. Repeated abrupt restarts: SIGKILL with the database open must never prevent the next boot
echo "== Abrupt restarts (${RESTARTS}x)"
docker rm -f "$NAME" >/dev/null
for _ in $(seq 1 "$RESTARTS"); do
	start; wait_ready
	docker rm -f "$NAME" >/dev/null
done
pass "$RESTARTS consecutive boots after SIGKILL"

echo "== Smoke OK (${MB} MB)"
