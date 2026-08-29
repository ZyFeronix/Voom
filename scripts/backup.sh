#!/bin/sh
# =============================================================================
# Voom! — Backup diario (servicio opcional del stack)
# Uso: backup.sh <DATA_DIR>   (ej. /data)
# Crea /data/backups/voom-YYYYMMDD.tar.gz con:
#   - snapshot consistente de la BD (sqlite .backup, WAL-safe)
#   - uploads/ completo
# Conserva los últimos 7 backups.
# =============================================================================
set -e

DATA_DIR="${1:-/data}"
DB_FILE="${DB_PATH:-$DATA_DIR/database.sqlite}"
BACKUP_DIR="$DATA_DIR/backups"
STAMP="$(date +%Y%m%d)"
TMP_SQL="$(mktemp /tmp/voom-db-XXXX.sql)"

echo "[backup] Generando $BACKUP_DIR/voom-$STAMP.tar.gz"

# Snapshot consistente de la BD (método oficial, seguro con WAL activo)
if command -v sqlite3 >/dev/null 2>&1; then
	sqlite3 "$DB_FILE" ".backup '$DATA_DIR/.backup-temp.sqlite'"
	mv "$DATA_DIR/.backup-temp.sqlite" "$DATA_DIR/.backup-snapshot.sqlite"
else
	cp "$DB_FILE" "$DATA_DIR/.backup-snapshot.sqlite"
fi

mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/voom-$STAMP.tar.gz" \
	-C "$DATA_DIR" .backup-snapshot.sqlite \
	-C "$DATA_DIR" uploads 2>/dev/null || tar -czf "$BACKUP_DIR/voom-$STAMP.tar.gz" -C "$DATA_DIR" .backup-snapshot.sqlite

rm -f "$DATA_DIR/.backup-snapshot.sqlite" "$TMP_SQL"

# Rotación: conservar los últimos 7
ls -1t "$BACKUP_DIR"/voom-*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f

echo "[backup] Completado."
