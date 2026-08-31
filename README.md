# Voom! — Red Social Full-Stack

[![Version](https://img.shields.io/badge/version-0.6.0--beta.2-blue)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-AGPLv3-blue)](https://www.gnu.org/licenses/agpl-3.0)
[![Stack](https://img.shields.io/badge/stack-SvelteKit%205%20%2B%20libSQL%20%2B%20Glassmorphism%202.0-orange)](#tech-stack)

Durante años, creadores y comunidades fueron estafados por scripts cerrados, vulnerables y costosos como WoWonder.
Cansado de esa basura, decidí construir Voom!: una alternativa 100% libre (AGPLv3), con seguridad nivel OWASP 3, sin algoritmos tóxicos, y optimizada para costar $0 dólares de mantenimiento inicial.

Curiosamente, semanas después de hacer público mi código, los desarrolladores de WoWonder tumbaron su propio script de CodeCanyon.
El código cerrado de baja calidad está muriendo.

Bienvenidos a la era del Neo-Aero y el Open Source.

Para quienes buscan el futuro, no el pasado.

**Estado:** Beta v0.6.0-beta.2 — 19 módulos, 70 tablas, 27 grupos de API. En desarrollo activo.
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
| **Reels** | Videos cortos con likes, comentarios, métricas y **thumbnails automáticos con ffmpeg** + aspect-ratio sin CLS |
| **Stories** | Historias efímeras (24h) + highlights permanentes |
| **Mensajería** | Chat DM + grupos rediseñado estilo MSN (Retro-Aero): media, voz, replies, reacciones, typing, **zumbido** y **llamadas WebRTC** (audio/video/pantalla) |
| **Notificaciones** | HTTP polling con cursor + push Socket.IO en tiempo real, pestañas inteligentes, optimistic UI |
| **Marketplace** | Categorías, listings con precio/condición/ubicación, detección de fraude |
| **Freelance Gigs** | Tablón de encargos y postulaciones |
| **Grupos & Páginas** | Tablas en schema + feature flag (`groups_enabled`); sin UI/API todavía |
| **Gamificación** | XP, niveles, check-ins diarios, rachas, títulos, leaderboard rediseñado (podio + pestañas + skeleton) |
| **Admin Panel** | Dashboard, gestión de usuarios, reportes, moderación de contenido, settings, claves de APIs externas (`/admin/apis`), tags curados (`/admin/tags`), verificación de creadores y strikes, **staff multi-rol con auditoría** (`/admin/team`, `/admin/audit`, roles admin/moderador/soporte/equipo) y **códigos de invitación** (`/admin/invites`) |
| **Beta Cerrada & Email** | Registro por **códigos de invitación** (`VOOM-XXXX-XXXX`, usos/expiración/trazabilidad), **verificación de email** y **recuperación de contraseña** (Nodemailer, SMTP desde `/admin/apis`), modo mantenimiento y modo demo con enforcement real |
| **Notificaciones Push** | En tiempo real vía Socket.IO (`new_notification`). Tabla `web_push_subscriptions` en schema; envío Web Push (VAPID) pendiente |
| **Legal & RGPD** | Páginas `/privacy` `/terms` `/cookies`, banner de cookies, consentimiento + age gate 13+, borrado de cuenta con ventana de 30 días, exportación de datos JSON |
| **Seguridad** | JWT (localStorage + cookie `Secure; SameSite=Strict`), rate limiting (1000 req/min por IP / 2000 por usuario), CSRF, headers HSTS, bloqueos, snooze, anti-bots (reputación + heurísticas) |
| **PWA** | Service worker cache-first, install prompt, manifest.json |
| **Diseño** | Glassmorphism 2.0 + Neo-Aero tokenizado (CSS puro), temas light/dark/midnight, perfiles customizables con CSS sanitizado, **apariencia global por usuario** + **Frutiger Aero Engine** (presets, cristal, radios, gloss, wallpaper) y perfiles de rendimiento lite/balanced/high |

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
| Testing | Vitest (12 suites, 126 tests) |
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
| `npm run test` | Vitest (17 suites, 227 tests) |
| `npm run lint` | ESLint + Prettier check |
| `npm run format` | ESLint + Prettier fix |
| `node scripts/migrate-up.js` | Aplicar migraciones pendientes |
| `node scripts/migrate-down.js [N]` | Revertir últimas N migraciones |
| `node scripts/seed.js` | Sembrar system_settings + marketplace_categories |

---

## Docker / Portainer

**Guía completa para no avanzados (15 min, HTTPS incluido): [`DEPLOY.md`](./DEPLOY.md)**

```bash
# rápida referencia: compilar y levantar localmente
DOMAIN=localhost JWT_SECRET=$(openssl rand -hex 48) docker compose up --build -d
```

Servicios: `voom` (SvelteKit + Socket.IO) y `caddy` (HTTPS automático).
Volumen persistente `voom_data` (BD + uploads + secretos), healthcheck
`/api/health`, backups opcionales con `--profile backup`.

---

## Documentación

| Archivo | Contenido |
|---------|-----------|
| [`DOCS.md`](./DOCS.md) | Documentación técnica completa (17 secciones) |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Decisiones de diseño y filosofía del proyecto |
| [`CHANGELOG.md`](./CHANGELOG.md) | Historial de versiones |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Guía para contribuir al proyecto |
| [`schema_sqlite.sql`](./schema_sqlite.sql) | Esquema canónico de base de datos (1039 líneas, 70 tablas) |
| [`.env.example`](./.env.example) | Template de variables de entorno |

---

## Licencia

GNU AGPLv3. Ver el texto completo en [`LICENSE`](./LICENSE)

<p align="center">
  <a target="_blank" rel="noopener noreferrer" href="https://raw.githubusercontent.com/haveachin/infrared/main/docs/public/img/agplv3_logo.svg">
    <img height="60" src="https://raw.githubusercontent.com/haveachin/infrared/main/docs/public/img/agplv3_logo.svg" alt="AGPLv3 Logo" style="max-width: 100%; height: auto; max-height: 60px;">
  </a>
</p>
