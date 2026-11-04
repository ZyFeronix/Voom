#!/bin/sh
# =============================================================================
# Voom! — Backup (servicio opcional del stack; usa la propia imagen de Voom)
# Uso: backup.sh <DATA_DIR>   (ej. /data)
# Crea /data/backups/voom-YYYYMMDD.tar.gz con:
#   - snapshot consistente de la BD (VACUUM INTO, seguro con WAL activo)
#   - uploads/ completo
# Conserva los últimos 7 backups.
# =============================================================================
set -e

DATA_DIR="${1:-/data}"
DB_FILE="${DB_PATH:-$DATA_DIR/database.sqlite}"
BACKUP_DIR="$DATA_DIR/backups"
SNAP="$DATA_DIR/.backup-snapshot.sqlite"
STAMP="$(date +%Y%m%d)"

echo "[backup] Generando $BACKUP_DIR/voom-$STAMP.tar.gz"
mkdir -p "$BACKUP_DIR"
rm -f "$SNAP"

DB_FILE="$DB_FILE" SNAP="$SNAP" node --input-type=module -e "
import { createClient } from '/app/frontend/node_modules/@libsql/client/lib-esm/node.js';
const c = createClient({ url: 'file:' + process.env.DB_FILE });
await c.execute(\"VACUUM INTO '\" + process.env.SNAP.replace(/'/g, \"''\") + \"'\");
c.close();
"

if [ -d "$DATA_DIR/uploads" ]; then
	tar -czf "$BACKUP_DIR/voom-$STAMP.tar.gz" -C "$DATA_DIR" .backup-snapshot.sqlite uploads
else
	tar -czf "$BACKUP_DIR/voom-$STAMP.tar.gz" -C "$DATA_DIR" .backup-snapshot.sqlite
fi
rm -f "$SNAP"

# Rotación: conservar los últimos 7
ls -1t "$BACKUP_DIR"/voom-*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
echo "[backup] Completado."
