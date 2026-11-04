#!/bin/sh
# =============================================================================
# Voom! — Instalador de 1 comando (Ubuntu/Debian/cualquier Linux con curl)
#
#   curl -fsSL https://raw.githubusercontent.com/zyferonix/voom/main/install.sh | sh
#   (o con variables:  DOMAIN=voom.example.com sh install.sh)
#
# Instala Docker si falta, descarga docker-compose.yml, crea .env y arranca.
# Idempotente: volver a ejecutarlo actualiza la imagen y reinicia.
# =============================================================================
set -eu

DIR="${VOOM_DIR:-/opt/voom}"
REF="${VOOM_REF:-main}"
RAW="https://raw.githubusercontent.com/zyferonix/voom/$REF"

[ "$(id -u)" = "0" ] || { echo "Ejecuta como root (sudo sh install.sh)"; exit 1; }

if ! command -v docker >/dev/null 2>&1; then
	echo "→ Instalando Docker…"
	curl -fsSL https://get.docker.com | sh
fi

mkdir -p "$DIR"
cd "$DIR"

echo "→ Descargando docker-compose.yml ($REF)…"
curl -fsSL "$RAW/docker-compose.yml" -o docker-compose.yml

if [ ! -f .env ]; then
	DOMAIN="${DOMAIN:-}"
	if [ -z "$DOMAIN" ] && [ -r /dev/tty ]; then
		printf 'Dominio (DNS A ya apuntando a este servidor, ej. voom.example.com): '
		read -r DOMAIN </dev/tty
	fi
	[ -n "$DOMAIN" ] || { echo "Falta DOMAIN. Ejecuta: DOMAIN=tu.dominio sh install.sh"; exit 1; }
	printf 'DOMAIN=%s\nVOOM_TAG=%s\n' "$DOMAIN" "${VOOM_TAG:-latest}" > .env
	chmod 600 .env
fi

echo "→ Arrancando…"
docker compose pull
docker compose up -d --remove-orphans
docker image prune -f >/dev/null 2>&1 || true

DOMAIN="$(sed -n 's/^DOMAIN=//p' .env)"
echo
echo "✔ Listo. Abre https://$DOMAIN para el asistente de instalación."
echo "  (el certificado TLS tarda ~1 min la primera vez)"
echo "  Backups diarios:  cd $DIR && docker compose --profile backup up -d"
