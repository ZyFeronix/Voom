# =============================================================================
# Voom! — Imagen de producción
#
# El stage final ESPEJA el layout de desarrollo (/app/frontend + /app/schema…)
# para que el cálculo de rootDir resuelva en /app y todo (BD, uploads,
# schema_sqlite.sql, migraciones) caiga donde el código espera.
#
# El CMD ejecuta frontend/server.js (NO build/index.js): es quien arranca
# Socket.IO — chat, presencia, notificaciones push y llamadas WebRTC.
# =============================================================================

# ── Stage 1: build de la aplicación SvelteKit ────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ── Stage 2: runtime (solo dependencias de producción) ──────────────────────
FROM node:20-slim AS runner
ENV NODE_ENV=production \
	PORT=3000 \
	HOST=0.0.0.0

WORKDIR /app/frontend

# Dependencias de producción (ffmpeg-static, socket.io, libsql…)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Servidor con Socket.IO + módulos server que importa por ruta relativa
COPY --from=builder /app/frontend/build ./build
COPY --from=builder /app/frontend/server.js ./server.js
COPY --from=builder /app/frontend/src/lib/server ./src/lib/server

# Contrato de instalación/actualización (el instalador lee schema_sqlite.sql)
WORKDIR /app
COPY schema_sqlite.sql ./
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
