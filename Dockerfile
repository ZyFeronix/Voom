# syntax=docker/dockerfile:1
# =============================================================================
# Voom! — Imagen de producción (Alpine, multi-stage, mínima)
#
# Layout espejo del de desarrollo (/app/frontend + /app/schema_sqlite.sql…) para
# que rootDir resuelva en /app. CMD = frontend/server.js (SvelteKit + Socket.IO).
# Solo se instalan dependencias de runtime (ver "dependencies" en package.json:
# lo que se empaqueta en el cliente vive en devDependencies y NO entra aquí).
# =============================================================================

# ── 1. Build de la aplicación ────────────────────────────────────────────────
# El build produce JS independiente de la arquitectura: corre SIEMPRE nativo
# (rápido) aunque se publique para arm64.
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ── 2. Dependencias de producción (podadas) ──────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund \
	&& find node_modules \( -name '*.md' -o -name '*.map' -o -name '*.d.ts' -o -name '*.d.mts' \
		-o -name '*.d.cts' -o -name '.github' -o -name 'test' -o -name 'tests' -o -name 'example*' \) \
		-not -iname 'LICENSE*' -prune -exec rm -rf {} + \
	&& rm -rf node_modules/@types

# ── 3. Runtime ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 DATA_DIR=/data
# su-exec (~10 KB): el entrypoint arranca como root solo para arreglar permisos
# del volumen (upgrades desde imágenes antiguas) y baja a "node".
RUN apk add --no-cache su-exec

WORKDIR /app/frontend
COPY --from=deps    /app/frontend/node_modules ./node_modules
COPY --from=builder /app/frontend/package.json ./package.json
COPY --from=builder /app/frontend/build ./build
COPY --from=builder /app/frontend/server.js ./server.js
COPY --from=builder /app/frontend/src/lib/server ./src/lib/server

WORKDIR /app
COPY schema_sqlite.sql ./
COPY migrations/ ./migrations/
COPY scripts/migrate-up.js scripts/migrate-down.js scripts/seed.js scripts/backup.sh ./scripts/
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh /app/scripts/backup.sh \
	&& mkdir -p /data && chown node:node /data

VOLUME /data
EXPOSE 3000
WORKDIR /app/frontend

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
