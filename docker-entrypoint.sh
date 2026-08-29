#!/bin/sh
# =============================================================================
# Voom! — Entrypoint del contenedor
# 1. Genera y persiste JWT_SECRET en el volumen si no viene por entorno.
# 2. Si la BD ya tiene esquema (upgrade), aplica migraciones pendientes.
# 3. Arranca el servidor (node server.js → SvelteKit + Socket.IO).
# En una BD vacía NO toca nada: el asistente /install crea el esquema.
# =============================================================================
set -e

DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"

# ── 1. JWT_SECRET persistente ────────────────────────────────────────────────
if [ -z "$JWT_SECRET" ]; then
	if [ -s "$DATA_DIR/.jwt_secret" ]; then
		JWT_SECRET="$(cat "$DATA_DIR/.jwt_secret")"
		export JWT_SECRET
	else
		JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
		printf '%s' "$JWT_SECRET" > "$DATA_DIR/.jwt_secret"
		chmod 600 "$DATA_DIR/.jwt_secret" 2>/dev/null || true
		export JWT_SECRET
		echo "[entrypoint] JWT_SECRET generado y guardado en $DATA_DIR/.jwt_secret"
	fi
fi

# ── 2. Migraciones solo si el esquema ya existe (upgrade) ────────────────────
DB_FILE="${DB_PATH:-$DATA_DIR/database.sqlite}"
SCHEMA_OK="$(cd /app/frontend && node -e "
import('@libsql/client').then(async ({ createClient }) => {
	const { existsSync } = await import('fs');
	const p = process.env.DB_PATH || '$DB_FILE';
	try {
		if (!existsSync(p)) { console.log('no'); return; }
		const c = createClient({ url: 'file:' + p });
		const r = await c.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name='users'\");
		console.log(r.rows.length ? 'yes' : 'no');
	} catch { console.log('no'); }
})();" 2>/dev/null || echo "no")"

if [ "$SCHEMA_OK" = "yes" ]; then
	echo "[entrypoint] Esquema existente: aplicando migraciones pendientes…"
	node /app/scripts/migrate-up.js || echo "[entrypoint] Aviso: migraciones con fallo — el servidor arranca igualmente."
else
	echo "[entrypoint] BD nueva: el asistente web creará el esquema."
fi

# ── 3. Arrancar ──────────────────────────────────────────────────────────────
exec "$@"
