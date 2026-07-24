# VSocial — Red Social Full-Stack

[![Version](https://img.shields.io/badge/version-0.5--alpha-blue)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-AGPLv3-blue)](#licencia)
[![Stack](https://img.shields.io/badge/stack-SvelteKit%205%20%2B%20libSQL%20%2B%20Glassmorphism%202.0-orange)](#tech-stack)

**VSocial** es una red social completa construida con SvelteKit 5, SQLite/libSQL,
WebSockets en tiempo real y un sistema de diseño Glassmorphism 2.0 propio.

**Estado:** Alpha v0.5 — Funcional completo, 16 módulos, 35 tablas, 24 API endpoints.
En desarrollo activo.

> 📖 **Documentación completa:** [`DOCS.md`](./DOCS.md) — arquitectura, schema, rutas,
> componentes, API, configuración, operaciones y roadmap.

---

## Módulos

| Módulo | Descripción |
|--------|-------------|
| **Social Core** | Posts, comentarios anidados, reacciones, hashtags, check-ins geolocalizados, **moods** (estados de ánimo) y **encuestas** |
| **Reels** | Videos cortos con likes, comentarios y métricas |
| **Stories** | Historias efímeras (24h) + highlights permanentes |
| **Mensajería** | Chat DM + grupos con media, voz, replies, reacciones, typing indicators |
| **Notificaciones** | SSE en tiempo real, pestañas inteligentes, optimistic UI |
| **Marketplace** | Categorías, listings con precio/condición/ubicación, detección de fraude |
| **Freelance Gigs** | Tablón de encargos y postulaciones |
| **Grupos & Páginas** | Comunidades públicas/privadas, posts grupales, eventos con RSVP |
| **Wallet** | Monedero virtual con balance y transacciones |
| **Gamificación** | XP, niveles, check-ins diarios, rachas, títulos, leaderboard rediseñado (podio + pestañas) |
| **Admin Panel** | Dashboard, gestión de usuarios, reportes, moderación de contenido, settings |
| **Push Notifications** | Web Push (VAPID), suscripciones por usuario |
| **Legal & RGPD** | Páginas `/privacy` `/terms` `/cookies`, banner de cookies, consentimiento + age gate 13+, borrado de cuenta con ventana de 30 días, exportación de datos JSON |
| **Seguridad** | JWT (localStorage + cookie `Secure; SameSite=Strict`), rate limiting, CSRF, Helmet, HSTS, bloqueos, snooze |
| **PWA** | Service worker cache-first, install prompt, manifest.json |
| **Diseño** | Glassmorphism 2.0 + Neo-Aero tokenizado, perfiles customizables |

---

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| Framework | SvelteKit 5 (SSR + CSR) + Runes (`$state`, `$derived`, `$props`) |
| Estilos | Tailwind CSS + DaisyUI + Glassmorphism 2.0 (CSS puro tokenizado) |
| DB primaria | `@libsql/client` (soporta local WAL + Turso remoto) |
| DB fallback | `better-sqlite3` (nativo, síncrono, envuelto en async) |
| API | Raw SQL con prepared statements — sin ORM |
| Auth | JWT + bcryptjs + OAuth (Google/Apple) |
| Tiempo real | Socket.io (chat) + SSE (notificaciones) + WebRTC (llamadas) |
| Email | Nodemailer (verificación, reset password) |
| Logging | Pino (structured JSON) |
| Testing | Vitest |
| DevOps | Docker + docker-compose + nginx + Husky hooks |

---

## Inicio Rápido

```bash
# 1. Dependencias
cd frontend && npm install && cd ..

# 2. Configuración
cp .env.example .env    # editar .env → mínimo: JWT_SECRET

# 3. Base de datos (opcional)
node scripts/seed.js

# 4. Arrancar
cd frontend && npm run dev    # → http://localhost:5173
```

Primera visita → wizard de instalación en `/install` → crea tablas y admin → ready.

---

## Comandos

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Build de producción |
| `npm start` | Servidor producción (adapter-node) |
| `npm run test` | Vitest |
| `npm run lint` | ESLint + Prettier check |
| `npm run format` | ESLint + Prettier fix |
| `node scripts/migrate-up.js` | Aplicar migraciones pendientes |
| `node scripts/migrate-down.js [N]` | Revertir últimas N migraciones |
| `node scripts/seed.js` | Sembrar system_settings + marketplace_categories |

---

## Docker

```bash
# configurar .env con JWT_SECRET y variables de producción
docker-compose up --build -d
```

Expone `:3000`, volumen persistente `vsocial_data`, healthcheck `/api/health`.

---

## Documentación

| Archivo | Contenido |
|---------|-----------|
| [`DOCS.md`](./DOCS.md) | Documentación técnica completa (17 secciones) |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Decisiones de diseño y filosofía del proyecto |
| [`CHANGELOG.md`](./CHANGELOG.md) | Historial de versiones |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Guía para contribuir al proyecto |
| [`schema_sqlite.sql`](./schema_sqlite.sql) | Esquema canónico de base de datos (783 líneas) |
| [`.env.example`](./.env.example) | Template de variables de entorno |

---

## Licencia

GNU AGPLv3. Ver el texto completo en [`LICENSE`](./LICENSE) o la página renderizada en [`/docs/license`](./license.html).
