# VSocial — Red Social Full-Stack

[![Version](https://img.shields.io/badge/version-0.6.0--beta.1-blue)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-AGPLv3-blue)](https://www.gnu.org/licenses/agpl-3.0)
[![Stack](https://img.shields.io/badge/stack-SvelteKit%205%20%2B%20libSQL%20%2B%20Glassmorphism%202.0-orange)](#tech-stack)

**VSocial** es una red social completa construida con SvelteKit 5, SQLite/libSQL, WebSockets en tiempo real y un sistema de diseño Glassmorphism 2.0 propio.

**VSOCIAL** nace un par de semanas después del retiro de WoWonder de CodeCanyon, no es un clon.

Es una respuesta arquitectónica a una década de código procedural, vulnerabilidades y mala UX.

Desarrollado en casi tres meses mediante la orquestación e iteración continua de herramientas de IA, con SQLite optimizado, Glassmorphism 2.0 y un sistema de verificación único.

Para quienes buscan el futuro, no el pasado.

**Estado:** Beta v0.6.0-beta.1 — Funcional completo, 18 módulos, 63 tablas, 25 grupos de API. En desarrollo activo.
> 📖 **Documentación completa:** [`DOCS.md`](./DOCS.md) — arquitectura, schema, rutas,
> componentes, API, configuración, operaciones y roadmap.

---

## Módulos

| Módulo | Descripción |
|--------|-------------|
| **Social Core** | Posts, comentarios anidados, reacciones, hashtags, check-ins geolocalizados, **moods**, **encuestas** y **reposts/citas** |
| **Identidades Anónimas** | Publicaciones y comentarios anónimos con alias exclusivos y protegidos |
| **Reposts & Citas** | Republicación de posts con notificación y XP al autor |
| **Custom Assets** | Emoticonos/stickers/emojis personalizados por rol + catálogo MSN (`/studio/emotes`) |
| **Verificación de Creadores** | Solicitud por categoría, revisión admin (`/admin/verifications`) y strikes de moderación |
| **Pagos P2P** | Sin billetera ni pasarelas: enlace PayPal/Patreon/Ko-fi por usuario (`payment_link`); marketplace = catálogo/contacto |
| **Reels** | Videos cortos con likes, comentarios y métricas |
| **Stories** | Historias efímeras (24h) + highlights permanentes |
| **Mensajería** | Chat DM + grupos con media, voz, replies, reacciones, typing indicators |
| **Notificaciones** | HTTP polling con cursor + push Socket.IO en tiempo real, pestañas inteligentes, optimistic UI |
| **Marketplace** | Categorías, listings con precio/condición/ubicación, detección de fraude |
| **Freelance Gigs** | Tablón de encargos y postulaciones |
| **Grupos & Páginas** | Tablas en schema + feature flag (`groups_enabled`); sin UI/API todavía |
| **Gamificación** | XP, niveles, check-ins diarios, rachas, títulos, leaderboard rediseñado (podio + pestañas) |
| **Admin Panel** | Dashboard, gestión de usuarios, reportes, moderación de contenido, settings, verificación de creadores y strikes |
| **Notificaciones Push** | En tiempo real vía Socket.IO (`new_notification`). Tabla `web_push_subscriptions` en schema; envío Web Push (VAPID) pendiente |
| **Legal & RGPD** | Páginas `/privacy` `/terms` `/cookies`, banner de cookies, consentimiento + age gate 13+, borrado de cuenta con ventana de 30 días, exportación de datos JSON |
| **Seguridad** | JWT (localStorage + cookie `Secure; SameSite=Strict`), rate limiting (1000 req/min por IP / 2000 por usuario), CSRF, headers HSTS, bloqueos, snooze, anti-bots (reputación + heurísticas) |
| **PWA** | Service worker cache-first, install prompt, manifest.json |
| **Diseño** | Glassmorphism 2.0 + Neo-Aero tokenizado (CSS puro), perfiles customizables |

---

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| Framework | SvelteKit 5 (SSR + CSR) + Runes (`$state`, `$derived`, `$props`) |
| Estilos | Glassmorphism 2.0 + Neo-Aero (CSS puro tokenizado, sin Tailwind/DaisyUI activo) |
| DB primaria | `@libsql/client` (soporta local WAL + Turso remoto) — async universal wrapper |
| DB fallback | `better-sqlite3` (fallback de driver envuelto en async) |
| API | Raw SQL con prepared statements — sin ORM |
| Auth | JWT + bcryptjs + OAuth (Google/Apple) |
| Tiempo real | Socket.io (chat, presencia, notificaciones push) + WebRTC (llamadas) |
| Email | Nodemailer (verificación, reset password) |
| Logging | Pino (structured JSON) |
| Testing | Vitest (8 suites, 50 tests) |
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
| `npm run test` | Vitest (8 suites, 50 tests) |
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
| [`schema_sqlite.sql`](./schema_sqlite.sql) | Esquema canónico de base de datos (949 líneas) |
| [`.env.example`](./.env.example) | Template de variables de entorno |

---

## Licencia

GNU AGPLv3. Ver el texto completo en [`LICENSE`](./LICENSE)

<p align="center">
  <a target="_blank" rel="noopener noreferrer" href="https://raw.githubusercontent.com/haveachin/infrared/main/docs/public/img/agplv3_logo.svg">
    <img height="60" src="https://raw.githubusercontent.com/haveachin/infrared/main/docs/public/img/agplv3_logo.svg" alt="AGPLv3 Logo" style="max-width: 100%; height: auto; max-height: 60px;">
  </a>
</p>
