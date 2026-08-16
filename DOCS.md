# VSocial — Documentación Completa de Proyecto (Beta v0.6.0-beta.1)

> Documento técnico maestro. Arquitectura, stack, módulos, API, base de datos, configuración,
> operaciones y guía de desarrollo. Todo en un solo archivo.

---

## 1. Visión General

**VSocial** es una red social full-stack construida con SvelteKit 5, SQLite/LibSQL,
WebSockets y diseño Glassmorphism 2.0 propio. Cubre el espectro completo de una plataforma
social moderna: feed, posts, reels, stories, marketplace, mensajería en tiempo real,
grupos, notificaciones push, gamificación y panel administrativo.

- **Versión:** Beta v0.6.0-beta.1
- **Licencia:** AGPLv3
- **Estado:** Funcional completo — 18+ módulos implementados

### Características Principales:
- **Sistema de Feeds Transparentes (Anti-Caja Negra):** El usuario tiene control total sobre su contenido mediante tres algoritmos sin opacidad:
  - **Radar en Vivo (Línea de Tiempo):** 100% cronológico estricto y global, sin filtros ocultos. Muestra absolutamente todo lo que se publica en la plataforma en tiempo real, segmentado únicamente por tu idioma principal (para evitar ruido irrelevante).
  - **Feed Inteligente (Personalizado):** Ordenamiento lógico basado explícitamente en los hashtags, categorías y creadores con los que más interactúas, sin ocultar contenido deliberadamente.
  - **Descubrimiento (Para Ti):** Muestra contenido en tendencia y de nuevos creadores basado en la relevancia global y frescura, dando oportunidades equitativas de visibilidad sin usar ML tóxico de retención.
- **Moods & Encuestas en Posts:** Cada publicación puede etiquetarse con un *mood* (estado de ánimo, 10 opciones) y/o adjuntar una encuesta con 2-6 opciones y duración configurable. Las encuestas se serializan como JSON en el cuerpo del post y se votan vía API con un voto por usuario. Ver §4.3.
- **Reproductor Multimedia Unificado:** `MediaPlayer.svelte` (sin Vidstack ni `<video>` nativo del navegador) se usa en feed, reels y stories: PiP, velocidades, atajos de teclado, *autoplay* al entrar en viewport y *media session* del SO. Ver §10.1.
- **Cumplimiento RGPD (UE):** Páginas legales (`/privacy`, `/terms`, `/cookies`), banner de consentimiento de cookies, registro con consentimiento + age gate 13+, borrado de cuenta self-service con ventana de reactivación de 30 días, y exportación de datos en JSON (derecho de portabilidad). Ver §13.1.
- **Leaderboard Rediseñado:** Tabla de clasificación con podio top-3, pestañas entre rankings, tarjeta del usuario actual y transiciones con caché en cliente.
- **Identidades Anónimas:** Publicaciones y comentarios anónimos con alias exclusivos y protegidos (tablas de identidades + flags de anonimato, migraciones `010`/`011`). El servidor oculta la autoría real incluso en comentarios y reposts.
- **Reposts & Citas:** Republicación de posts (`/api/posts/:id/share` o `/:id/repost`) con notificación al autor y XP por recibir repost (migración `008`).
- **Custom Assets & Emoticonos Retro:** Activos personalizados por rol (emojis, stickers, emoticonos) con estudio en `/studio/emotes` y catálogo MSN integrado (migración `009`).
- **Verificación de Creadores & VTubers:** Solicitud pública por categoría (`/about/verified/apply/[category]`), revisión administrativa (`/admin/verifications`) y sistema de strikes de moderación (migración `012`).
- **Pagos P2P (sin billetera ni pasarelas):** Cada usuario publica su enlace personal PayPal/Patreon/Ko-fi en `users.payment_link`; el marketplace es catálogo/contacto y abre el enlace del vendedor en vez de comprar.
- **Motor Anti-Abuso:** Reputación de autores (`author-reputation.js`, batch cada 6 h), heurísticas de spam/bots (`spam-heuristics.js`, batch cada 30 min) y escritor de lotes en memoria (`batch-writer.js`) para métricas de alta concurrencia.

---

## 2. Tech Stack

### 2.1 Frontend

| Capa | Tecnología |
|------|-----------|
| Framework | SvelteKit 5 (SSR + CSR híbrido) |
| Reactividad | Runes de Svelte 5 (`$state`, `$derived`, `$props`) |
| Estilos | Glassmorphism 2.0 + Neo-Aero (CSS puro tokenizado en `layout.css`, sin Tailwind/DaisyUI activo) |
| Iconografía | Material Icons Round (Google Fonts) |
| Emojis | Noto Color Emoji (Nativo). *Nota: Componentes internos conservan prefijo "Twemoji" por legado.* |
| Empaquetado | Vite 8 |
| Adapter | `@sveltejs/adapter-node` (servidor Node.js standalone) |
| PWA | Service worker cache-first, manifest.json |

### 2.2 Backend

| Capa | Tecnología |
|------|-----------|
| API | Rutas SvelteKit `+server.js` (mismo proceso Node.js) |
| Auth | JWT (`jsonwebtoken`) — token en `localStorage` + cookie client-side `SameSite=Strict; Secure` (no httpOnly: el cliente lo lee en `lib/api.js`) |
| Sesiones | Tabla `user_sessions` con token hash (SHA-256) + IP + user-agent |
| OAuth | `oauth.js` con estructura Google/Apple — **sin flujo de login cableado** en rutas (pendiente) |
| Hashing | bcryptjs (cost 10) |
| Validación | Validadores custom con regex en `lib/server/security.js` |
| Rate Limiting | In-memory en `hooks.server.js`: 1000 req/min por IP, 2000 req/min por usuario autenticado; exentos staff y localhost; `/api/gamification/heartbeat` y `/api/health` excluidos |
| Email | Nodemailer (verificación, reset password) — SMTP configurado vía `system_settings` (admin), no vía env |
| Logging | Pino + pino-pretty (structured JSON logs) |
| Seguridad HTTP | Headers manuales en `hooks.server.js` (HSTS, X-Frame-Options: DENY, nosniff, Referrer-Policy, Permissions-Policy). Helmet está en `package.json` pero no se usa en runtime |
| CSRF | Validación de Origin/Referer en `hooks.server.js` |
| Anti-abuso | Reputación de autores (`author-reputation.js`, batch 6 h) + heurísticas spam/bots (`spam-heuristics.js`, 30 min) + `batch-writer.js` |

### 2.3 Base de Datos

| Capa | Tecnología |
|------|-----------|
| Motor primario | `@libsql/client` v0.17+ (soporta local WAL + remoto Turso) |
| Fallback | `better-sqlite3` (driver fallback envuelto en API async) |
| API unificada | Adaptador universal en `db.js` — misma interfaz async para ambos |
| Esquema | 949 líneas SQL idempotente (`schema_sqlite.sql`) |
| Migraciones | Carpeta `migrations/` + scripts `migrate-up.js` / `migrate-down.js` |
| ORM | No se usa. Raw SQL con prepared statements (`?`) |

### 2.4 Tiempo Real

| Capa | Tecnología |
|------|-----------|
| WebSockets | `socket.io` (servidor + cliente): chat, presencia en memoria (`Map<userId, Set<socketId>>`), typing indicators, push de notificaciones |
| Chat | Mensajería DM + grupos con media, voz, reacciones, replies |
| WebRTC | Señalización para llamadas via `/api/rtc/signal` y eventos `rtc_signal` |
| Notificaciones | HTTP polling con cursor (`GET /api/notifications`) + push en tiempo real via Socket.IO (`new_notification`) |

### 2.5 Infraestructura / DevOps

| Capa | Tecnología |
|------|-----------|
| Contenedores | Docker + docker-compose (single service + healthcheck) |
| Proxy reverso | nginx.conf (WebSocket-ready, buffering off) |
| Redis | No usado (arquitectura in-memory local) |
| Tests | Vitest — 8 suites en `tests/` (50 tests) |
| Linting | ESLint 9 + Prettier 3 + plugin Svelte |
| Git hooks | Husky (`.husky/`) |
| CI/CD | Pre-commit linting + build verification (Husky) + GitHub Actions (`lint` + `build` en cada push/PR, ver `.github/workflows/ci.yml`) |

---

## 3. Estructura del Proyecto

```
Vsocial/                     ← raíz del proyecto
├── .env                     ← configuración real (gitignored)
├── .env.example             ← template de configuración
├── .gitignore
├── .husky/                  ← git hooks
├── ARCHITECTURE.md          ← decisiones de diseño y filosofía
├── CHANGELOG.md             ← registro de versiones
├── DOCS.md                  ← este documento
├── README.md                ← overview rápido
├── Personality & SOUL.md    ← identidad de la plataforma
│
├── frontend/                ← aplicación SvelteKit principal
│   ├── package.json         ← dependencias y scripts
│   ├── eslint.config.js     ← config ESLint 9 (flat) — aquí, no en la raíz (deps en frontend/node_modules)
│   ├── .prettierrc          ← config Prettier (tabs) + plugin Svelte
│   ├── .prettierignore      ← excluye style_dump.css y scripts de debug ad-hoc
│   ├── svelte.config.js     ← config SvelteKit (runes mode, adapter-node)
│   ├── vite.config.js       ← config Vite + Vitest
│   ├── jsconfig.json
│   ├── server.js            ← entrypoint de producción (node server.js)
│   ├── src/
│   │   ├── app.html         ← shell HTML raíz
│   │   ├── hooks.server.js  ← middleware global (DB init, rate limit, CSRF, cron, security headers)
│   │   ├── service-worker.js← PWA cache-first (solo assets estáticos)
│   │   ├── lib/
│   │   │   ├── index.js     ← barrel placeholder
│   │   │   ├── api.js       ← cliente HTTP unificado para llamadas al backend
│   │   │   ├── rtc.js       ← lógica WebRTC cliente
│   │   │   ├── components/  ← 31 componentes UI reutilizables + 8 de gamificación
│   │   │   ├── stores/      ← 10 stores reactivos Svelte 5
│   │   │   ├── actions/     ← 2 Svelte actions (clickOutside, twemoji)
│   │   │   ├── server/      ← 19 módulos server-side
│   │   │   ├── utils/       ← utilidades compartidas
│   │   │   └── assets/      ← recursos estáticos importables
│   │   └── routes/          ← sistema de rutas SvelteKit (páginas + API)
│   ├── static/              ← assets públicos (favicon, logo, manifest, robots.txt) + docs/ (portal generado)
│   ├── build/               ← output de producción (generado)
│   └── uploads/             ← archivos subidos (local dev)
│
├── schema_sqlite.sql        ← esquema canónico único (949 líneas, idempotente)
├── database.sqlite          ← base de datos local (desarrollo)
├── migrations/              ← registro histórico de cambios de schema
├── scripts/                 ← utilidades CLI
│   ├── migrate-up.js        ← aplicar migraciones pendientes
│   ├── migrate-down.js      ← revertir última migración
│   └── seed.js              ← sembrar datos iniciales
├── tests/                   ← 8 suites de tests (50 tests)
│   ├── auth.test.js         ← seguridad + conectividad DB
│   ├── reposts.test.js, anonymous_posts.test.js, anon_identities.test.js,
│   ├── custom_assets.test.js, feed-algorithm.test.js,
│   └── moderation_strikes.test.js, verifications.test.js
├── uploads/                 ← directorio de uploads (producción)
├── docker-compose.yml       ← orquestación Docker
├── Dockerfile               ← build multi-stage (alpine, precompress)
├── nginx.conf               ← proxy reverso (WebSocket, buffering off)
└── (eslint.config.js vive en frontend/, ver abajo — sus deps están en frontend/node_modules)
```

---

## 4. Arquitectura de Datos

### 4.1 Principios

- **Idempotente**: `schema_sqlite.sql` se ejecuta en cada arranque con `CREATE TABLE IF NOT EXISTS`.
  Es seguro correrlo contra una DB existente.
- **Single Source of Truth**: El archivo `schema_sqlite.sql` es la fuente canónica. Las migraciones
  en `migrations/` son solo registro histórico.
- **Raw SQL**: Sin ORM. Todas las queries son SQL puro con prepared statements.
- **Transacciones ACID**: WAL mode, foreign keys ON, busy_timeout 5000ms.
- ** Índices estratégicos**: Cada tabla tiene índices para los patrones de consulta más frecuentes.

### 4.2 Dominios del Esquema (14 dominios, 64 tablas)

| Dominio | Tablas | Función |
|---------|--------|---------|
| **1. Users & Auth** | `users`, `user_roles`, `user_titles`, `user_sessions`, `user_settings` | Perfil, roles, sesiones, preferencias. `users` incluye columnas RGPD: `birth_date`, `deleted_at` (soft-delete + ventana 30 días), `terms_accepted_at`, `privacy_accepted_at` (migración `003_gdpr.sql`) |
| **2. Posts & Content** | `posts`, `post_media`, `post_likes`, `post_reactions`, `comments`, `comment_reactions`, `saved_posts`, `hashtags`, `post_hashtags`, `check_ins`, `tags` | Publicaciones (con `mood` y encuesta serializada en `body`), media, reacciones, comentarios anidados, hashtags, check-ins geolocalizados, tags curados por administración (filtro real de `/explore` vía `#slug`) |
| **3. Stories** | `stories`, `story_highlights`, `story_highlight_items` | Historias efímeras (24h) + highlights permanentes |
| **4. Reels** | `reels`, `reel_likes`, `reel_comments` | Videos cortos estilo TikTok/Reels |
| **5. Messaging** | `conversations`, `conversation_participants`, `messages_new`, `message_reactions`, `message_read_receipts` | Chat DM + grupos, voz, media, replies, reacciones, recibos de lectura |
| **6. Notifications** | `notifications` | Motor de actividad social (like, comment, follow, mention, system) |
| **6b. Moderation** | `reports` | Reportes de contenido por usuarios |
| **7. Marketplace** | `marketplace_categories`, `marketplace_listings`, `listing_media` | Categorías, anuncios con precio/condición/ubicación, detección de fraude |
| **8. Gigs** | `gigs`, `gig_applications` | Tablón freelance: encargos y postulaciones |
| **9. Push** | `web_push_subscriptions` | Suscripciones Web Push (tabla; el envío VAPID está pendiente de implementar) |
| **10. System** | `system_settings`, `sponsored_posts`, `cms_pages` | Configuración global, anuncios, páginas CMS |
| **11. Groups & Pages** | `groups`, `group_members`, `group_posts`, `group_events`, `pages`, `page_followers` | Comunidades, páginas públicas, eventos |
| **12. Security** | `oauth_accounts`, `email_tokens`, `blocked_users`, `snoozed_users` | OAuth, verificación email, bloqueos, silenciados temporales |
| **13. Aesthetics** | `profile_customizations` | Glassmorphism 2.0: colores, blur, opacidad, CSS custom, bloques |
| **14. Infrastructure** | `system_cache`, `rtc_signals`, `daily_xp_limits`, `activity_logs` | Caché, señalización WebRTC, gamificación, registro de actividad |

### 4.3 Arquitectura de Persistencia y Concurrencia

- **Índice Único en SQLite**: Dependencia estricta en constraints de SQLite para prevenir condiciones de carrera. Por ejemplo, `unique_activity_idx` asegura que los registros de actividad (vistas, likes) no se dupliquen incluso bajo alta concurrencia.
- **Runes de Svelte 5**: La interfaz utiliza `$state` y `$derived` para reflejar el estado de la base de datos inmediatamente, aplicando un patrón de UI optimista respaldado por sincronización confiable con SQLite.
- **Modo WAL**: Esencial para escalabilidad. Permite lecturas concurrentes mientras ocurren escrituras, manejando de forma efectiva patrones de tráfico viral.

### 4.4 Moods, Encuestas y Creación de Historias

Funcionalidades de creación añadidas sobre el núcleo social:

- **Moods (estados de ánimo):** el creador de posts (`/posts/create`) ofrece un carrusel de 10 moods (Feliz 😄, Creativo 🎨, Jugando 🎮, Música 🎵, Pensando 🤔, Emocionado 🔥, Viajando ✈️, Celebrando 🥳, Trabajando 💻, Comiendo 🍔). El mood seleccionado se envía en el campo `mood` y se persiste en `posts.mood` (`VARCHAR(30)`); se renderiza en el feed. El carrusel implementa física de *drag-to-scroll* con inercia, *overscroll* elástico y *edge fading* (sin *scroll-snap*, scroll libre y fluido), replicando el carrusel de la landing; las flechas de navegación se reemplazaron por esta física.
- **Encuestas (polls):** el creador permite añadir una pregunta con 2-6 opciones y duración (1h / 6h / 24h / 3 días / 7 días). La encuesta **no** tiene tabla propia: se serializa como JSON en un bloque `\n[METADATA]` al final del `body` del post, junto con la ubicación. Estructura: `{ poll: { question, options: [{text, votes}], voted_user_ids: [] } }`.
  - **Votación:** `POST /api/posts/:id/vote` con `{ option_index }`. El servidor parsea el `[METADATA]`, rechaza votos duplicados (comprueba `voted_user_ids`), incrementa `votes` del option elegido, añade el `user_id` al array y reescribe el `body`. Devuelve `{ poll }` actualizado.
  - **Render:** `PostCard.svelte` muestra el widget con botones de opción (si el usuario puede votar) o barras de porcentaje + recuento (tras votar o si no está autenticado), total de votos y marca "Voto registrado".
- **Creación de historias (`/stories/create`):** reescritura completa de mockup a página funcional. Soporta *drag & drop* de archivos, **historias de solo texto** (caption sobre fondo de color), previsualización en vivo dentro de un marco de teléfono, texto arrastrable (posición X/Y, alineación), 10 colores de fondo, 6 de texto y 5 familias tipográficas, con mapeo real a la API de stories.

---

## 5. Sistema de Rutas

### 5.1 Páginas (Frontend) — 40 páginas .svelte + 2 layouts

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/` | `+page.svelte` | Home / feed principal |
| `/login` | `login/+page.svelte` | Inicio de sesión |
| `/register` | `register/+page.svelte` | Registro de usuario |
| `/install` | `install/+page.svelte` | Wizard de instalación inicial |
| `/setup` | `setup/+page.svelte` | Configuración inicial (primer admin) |
| `/feed` | `feed/+page.svelte` | Feed de publicaciones |
| `/explore` | `explore/+page.svelte` | Explorar / descubrir contenido — chips de **tags curados** (tabla `tags`, gestionados en `/admin/tags`) que filtran el feed por hashtag `#slug` |
| `/following` | `following/+page.svelte` | Feed de seguidos |
| `/notifications` | `notifications/+page.svelte` | Centro de notificaciones con pestañas |
| `/messages` | `messages/+page.svelte` | Chat / mensajería |
| `/marketplace` | `marketplace/+page.svelte` | Marketplace catálogo/contacto — el botón "Contactar" abre el enlace P2P (PayPal/Patreon/Ko-fi) del vendedor |
| `/reels` | `reels/+page.svelte` | Feed de Reels (videos cortos) |
| `/reels/[id]` | `reels/[id]/+page.svelte` | Reel individual |
| `/reels/create` | `reels/create/+page.svelte` | Crear Reel |
| `/posts/[id]` | `posts/[id]/+page.svelte` | Post individual con comentarios |
| `/posts/[id]/edit` | `posts/[id]/edit/+page.svelte` | Editar post |
| `/posts/create` | `posts/create/+page.svelte` | Crear post |
| `/stories/create` | `stories/create/+page.svelte` | Crear historia |
| `/u` | `u/+page.svelte` | Índice de perfiles |
| `/u/[username]` | `u/[username]/+page.svelte` | Perfil de usuario público (muestra el enlace P2P del usuario) |
| `/u/[username]/following` | `u/[username]/following/+page.svelte` | Lista de seguidos |
| `/settings` | `settings/+page.svelte` | Configuración de cuenta (perfil, privacidad, notificaciones, algoritmo, **enlace P2P**, **Mis Datos RGPD**) |
| `/settings/design` | `settings/design/+page.svelte` | Personalización de diseño/theme |
| `/settings/activity` | `settings/activity/+page.svelte` | Registro de actividad personal |
| `/leaderboard` | `leaderboard/+page.svelte` | Tabla de clasificación |
| `/admin` | `admin/+page.svelte` | Dashboard de administración (con layout propio) |
| `/admin/users` | `admin/users/+page.svelte` | Gestión de usuarios |
| `/admin/reports` | `admin/reports/+page.svelte` | Gestión de reportes |
| `/admin/content` | `admin/content/+page.svelte` | Moderación de contenido |
| `/admin/settings` | `admin/settings/+page.svelte` | Configuración del sistema |
| `/admin/tags` | `admin/tags/+page.svelte` | CRUD de tags curados (crear, renombrar, icono, eliminar; muestra posts por tag) |
| `/admin/verifications` | `admin/verifications/+page.svelte` | Revisión de solicitudes de verificación |
| `/about` | `about/+page.svelte` | Acerca de VSocial |
| `/about/verified` | `about/verified/+page.svelte` | Info sobre verificación de creadores |
| `/about/verified/apply` | `about/verified/apply/+page.svelte` | Solicitud de verificación |
| `/about/verified/apply/[category]` | `about/verified/apply/[category]/+page.svelte` | Solicitud por categoría (VTuber, gobierno, etc.) |
| `/studio/emotes` | `studio/emotes/+page.svelte` | Estudio de emoticonos / custom assets |
| `/privacy` | `privacy/+page.svelte` | Política de Privacidad (RGPD) |
| `/terms` | `terms/+page.svelte` | Términos de Servicio (RGPD) |
| `/cookies` | `cookies/+page.svelte` | Política de Cookies (RGPD) |
| `/docs` | `static/docs/index.html` | Portal de documentación (README + DOCS + Contributing en pestañas). Generado por `scripts/build_docs.js` |
| `/docs/license` | `static/docs/license.html` | Página de Licencia y Protección (AGPLv3) — HTML estático autocontenido, diseño Glassmorphism 2.0 |

### 5.2 API Endpoints — 26 grupos de endpoints

| Ruta API | Métodos | Función |
|----------|---------|---------|
| `/api/auth/[action]` | POST, GET, PUT | `register`, `login`, `logout`, `me`, `change-password`. *(reset-password/verify-email: maquinaria en `email.js`/`email_tokens`, sin ruta cableada)* |
| `/api/users/[...path]` | GET, POST, PUT, DELETE | Perfiles, follows/unfollow, bloquear/snoozear, búsqueda, avatar/cover, **`/export` (JSON portabilidad RGPD)**, **`/delete-account` (borrado soft + ventana 30 días)** |
| `/api/health` | GET | Health check (`{ status: 'ok', uptime, db }`) |
| `/api/install` | POST | Instalación inicial: crea tablas, admin user, system settings |
| `/api/setup` | POST | Wizard post-instalación |
| `/api/posts/[...path]` | GET, POST, PUT, DELETE | CRUD de posts + like/unlike + save/unsave + pin/unpin + `/:id/vote` (encuestas) + `/:id/restore` + **`/:id/share` / `/:id/repost`** + **comentarios anidados** (`/:id/comments`, `/:id/comments/:commentId`) + posts y comentarios **anónimos**. El POST de creación acepta `mood`, `scheduled_at`, `location_name` y `poll` (JSON con pregunta, opciones y duración) |
| `/api/feed/[...path]` | GET | Feed inteligente, timeline, trending, explore. `GET /explore` acepta `?category=<slug>` para filtrar posts por hashtag `#slug` (tag curado) |
| `/api/reels/[...path]` | GET, POST, PUT, DELETE | CRUD de reels + like/unlike + comentarios |
| `/api/stories/[...path]` | GET, POST, DELETE | CRUD de stories + highlights |
| `/api/notifications/[...path]` | GET, PUT, PATCH | Lista con paginación de cursor, marcar leídas, marcar todas leídas (push en tiempo real vía Socket.IO `new_notification`) |
| `/api/messages/[...path]` | GET, POST | Conversaciones, mensajes, media, creación de grupos |
| `/api/marketplace/[...path]` | GET, POST, PUT, DELETE | Listings, categorías, búsqueda, flag |
| `/api/market/[...path]` | GET, POST | Variante **legacy** de marketplace (el activo es `marketplace`) |
| `/api/gigs/[...path]` | GET, POST, PUT | Gigs freelance + aplicaciones |
| `/api/reports` | POST | Crear reporte de contenido/usuario |
| `/api/upload` | POST | Subida de archivos (imagen, video, audio) a `uploads/` |
| `/api/custom-assets/[...path]` | GET, POST, DELETE | Listar/filtrar activos personalizados, `GET /specs` (dimensiones y reglas), subir y eliminar |
| `/api/verification/[...path]` | GET, POST | `GET /status` (estado de la solicitud), `POST /apply` (solicitar verificación) |
| `/api/rtc/signal` | POST | Señalización WebRTC (oferta/respuesta/ICE) |
| `/api/search` | GET | Búsqueda global (usuarios, posts, hashtags) |
| `/api/gamification/leaderboard` | GET | Rankings de usuarios |
| `/api/gamification/checkin` | POST | Check-in diario |
| `/api/gamification/heartbeat` | POST | Latido de actividad (tracking de sesión; excluido del rate limiter) |
| `/api/activity/view` | POST | Registrar vista de contenido |
| `/api/activity/history` | GET | Historial de actividad del usuario |
| `/api/admin/[...path]` | GET, POST, PUT | Panel admin: dashboard, users, reports, content, settings, **verifications** (listar/aprobar), strikes |
| `/api/tags/[...path]` | GET, POST, PUT, DELETE | Tags curados: `GET /api/tags` (lista pública con `post_count`), `POST` / `PUT /:id` / `DELETE /:id` solo admin (crear, editar nombre/icono, eliminar) |
| `/api/cron` | GET, POST | Workers cron (publicación programada, limpiezas, recuerdos) — protegido con `CRON_SECRET` |
| `/api/gifs/search` | GET | Proxy de búsqueda GIFs (Tenor) |

> Los archivos subidos se sirven **estáticamente** desde `/uploads/` (dev: `fs.allow: ['..']` en `vite.config.js`; prod: `server.js` con `Cache-Control: public, max-age=86400`). No existe `/api/uploads`.

---

## 6. Stores Reactivos (Cliente)

10 stores rune-based en `lib/stores/*.svelte.js`:

| Store | Archivo | Estado |
|-------|---------|--------|
| **auth** | `stores/auth.svelte.js` | `user`, `token`, `role`, `isAuthenticated`, `login()`, `logout()`, `refreshUser()` |
| **notifications** | `stores/notifications.svelte.js` | `list`, `unreadCount`, `markRead()`, `markAllRead()`, `addNotification()` |
| **theme** | `stores/theme.svelte.js` | `mode` (light/dark/auto), `toggle()`, persistencia en localStorage |
| **ui** | `stores/ui.svelte.js` | `sidebarOpen`, `activeModal`, `toasts[]`, `showToast()`, `dismissToast()` |
| **chat** | `stores/chat.svelte.js` | Conversación activa, mensajes, typing indicators (Socket.IO) |
| **rtc** | `stores/rtc.svelte.js` | Estado de llamadas WebRTC (streams local/remoto, señalización) |
| **anonIdentity** | `stores/anonIdentity.svelte.js` | Identidad anónima activa del usuario (alias exclusivo) |
| **features** | `stores/features.svelte.js` | Feature flags del servidor (`reels_enabled`, `stories_enabled`, `groups_enabled`, `marketplace_enabled`, `gamification_enabled`) |
| **mediaViewer** | `stores/mediaViewer.svelte.js` | Visor de medios a pantalla completa (`MediaLightbox`) |
| **perf** | `stores/perf.svelte.js` | Métricas de rendimiento en cliente |

---

## 7. Componentes Reutilizables

| Componente | Descripción |
|------------|-------------|
| `SideNav.svelte` | Barra lateral de navegación (escritorio): Inicio, Explorar, Reels, Marketplace, Mensajes, Notificaciones, Perfil, Ajustes |
| `TopBar.svelte` | Barra superior con búsqueda y acciones rápidas |
| `MobileNav.svelte` | Barra de navegación inferior (móvil) |
| `PostCard.svelte` | Tarjeta de post para feed: avatar, contenido, media, likes, comentarios, compartir |
| `CommentItem.svelte` | Comentario individual con replies anidados |
| `ProfileHoverCard.svelte` | Popup de perfil al hacer hover en username/avatar |
| `VerifiedBadge.svelte` | Insignia de cuenta verificada |
| `MediaPlayer.svelte` | Reproductor de audio/vídeo propio y unificado (sin Vidstack ni `<video>` nativo): PiP, velocidades, atajos, *autoplay* en viewport, *media session* y *tracking* de vistas. Usado en feed, reels y stories (ver §10.1) |
| `VoiceRecorder.svelte` | Widget de grabación de voz para mensajes |
| `KlipyPicker.svelte` | Picker de emojis/GIFs/stickers (integración Klipy) |
| `TwemojiPicker.svelte` | Picker de emojis nativos (Noto Color Emoji). *Nombre legacy* |
| `HashtagTextarea.svelte` | Textarea con soporte de hashtags |
| `ReportModal.svelte` | Modal para reportar contenido |
| `PwaPrompt.svelte` | Banner de instalación PWA |
| `CookieBanner.svelte` | Banner de consentimiento de cookies (RGPD) — localStorage `vsocial_cookie_consent` + cookie `Secure; SameSite=Strict` |
| `QuickChatWidget.svelte` | Widget flotante de chat rápido |
| `CustomSelect.svelte` | Select/dropdown personalizado |
| `PasswordMeter.svelte` | Medidor de fortaleza de contraseña |
| `LiquidBackground.svelte` | Fondo animado con gradiente líquido |
| `ActivityHistory.svelte` | Registro de actividad del usuario |
| `AeroAvatar.svelte` | Avatar con estética aero/glass |
| `AnonIdentityModal.svelte` | Modal para crear/gestionar la identidad anónima |
| `ConfirmModal.svelte` | Modal de confirmación reutilizable |
| `ImageCropperModal.svelte` | Recorte de imagen para avatar/cover |
| `MediaLightbox.svelte` | Visor de medios a pantalla completa |
| `MsnContactCard.svelte` | Tarjeta de contacto estilo MSN |
| `MsnEmoticonPicker.svelte` | Picker de emoticonos retro (catálogo MSN) |
| `MsnStatusDropdown.svelte` | Dropdown de estado de usuario (estilo MSN) |
| `MsnToastContainer.svelte` | Contenedor de toasts estilo MSN |
| `StatusConfigModal.svelte` | Configuración de estado personalizado |
| **Gamificación:** | |
| `gamification/CheckinButton.svelte` | Botón de check-in diario |
| `gamification/LevelBadge.svelte` | Insignia de nivel |
| `gamification/PodiumCard.svelte` | Tarjeta de podium (top 3) en leaderboard |
| `gamification/AuroraPillar.svelte` | Pilar aurora decorativo del leaderboard rediseñado |
| `gamification/LeaderboardTabs.svelte` | Pestañas para cambiar de ranking (nivel/XP/…) |
| `gamification/LeaderboardRow.svelte` | Fila de usuario en el listado del leaderboard |
| `gamification/CurrentUserCard.svelte` | Tarjeta del usuario actual con su posición |
| `gamification/UserTitleBadge.svelte` | Insignia de título personalizado |

---

## 8. Módulos Server-Side (`$lib/server/`)

| Módulo | Función |
|--------|---------|
| **db.js** | Inicialización de DB, adaptador universal (`@libsql/client` \| `better-sqlite3`), ejecución de schema, PRAGMAs (WAL, foreign_keys, busy_timeout, cache_size), utilidades de path |
| **auth.js** | Login, hash de passwords (bcryptjs), creación de sesiones (`user_sessions`), verificación de credenciales |
| **jwt.js** | Creación, decodificación y verificación de JWT tokens |
| **security.js** | Validación de inputs (`validator`), sanitización HTML (`dompurify`), rate limiting, detección CSRF |
| **email.js** | Envío de emails (verificación, reset password) via Nodemailer |
| **oauth.js** | Integración OAuth2 (Google, Apple) |
| **socket.js** | Servidor WebSocket (`socket.io`): chat en tiempo real, presencia, typing indicators |
| **socket-plugin.js** | Plugin Vite para adjuntar el servidor WebSocket al servidor SvelteKit |
| **gamification.js** | Sistema de XP, niveles, check-ins diarios, rachas, badges, límites diarios de XP |
| **activity.js** | Registro de actividad de usuario: vistas, interacciones, heartbeats de sesión |
| **entities.js** | Helpers de entidades para consultas comunes a tablas |
| **cache.js** | Sistema de caché en memoria (TTL-based) |
| **logger.js** | Logging estructurado con Pino |
| **author-reputation.js** | Reputación determinista de autores (0–100): grafo social, madurez de cuenta, engagement, señales negativas. Batch cada 6 h |
| **spam-heuristics.js** | Heurísticas deterministas de spam/bots: desbalance followers/following, ráfagas de publicación, patrones de churn. Batch cada 30 min |
| **batch-writer.js** | Escritor de lotes en memoria (impressions, progreso de video) con flush periódico a SQLite — evita contención de escritura WAL |
| **diversity.js** | Motor de diversidad del feed: previene clustering del mismo creador (cuota máxima por autor y límite de autores consecutivos) |
| **media.js** | Validación de seguridad de medios: verificación de magic numbers (firmas binarias) contra uploads maliciosos |
| **imageMeta.js** | Extractor de metadatos/dimensiones de imagen (PNG, GIF, WebP, JPEG) con parser binario puro |

---

## 9. Sistema de Gamificación

| Mecánica | Descripción |
|----------|-------------|
| **XP Points** | Puntos de experiencia acumulados por acciones (postear, comentar, likear, check-in) |
| **Level** | Nivel basado en XP total, con badge visual |
| **Check-in Streak** | Rachas diarias con recompensa progresiva |
| **Daily XP Limits** | Límites por fuente (`daily_xp_limits`) para prevenir grinding |
| **User Titles** | Títulos personalizados otorgados por admins con color asignado |
| **Leaderboard** | Rankings públicos de usuarios por nivel/XP. Rediseñado (rama `feature/leaderboard-redesign`): podio top-3 (`PodiumCard`), filas para el resto (`LeaderboardRow`), pestañas entre tipos de ranking (`LeaderboardTabs`), tarjeta del usuario actual (`CurrentUserCard`), caché en cliente para transiciones instantáneas. Endpoint `GET /api/gamification/leaderboard?type=`. |
| **Heartbeat** | Tracking de sesión activa para medir engagement |

---

## 10. Diseño: Glassmorphism 2.0 (Neo-Aero)

### Tokens de Diseño Reales (`layout.css`)

| Token | Descripción / Valor Canónico |
|-------|------------------------------|
| `--accent-blue-base` | `#1b85f3` (color primario Neo-Aero canónico) |
| `--glass-bg` | `var(--bg-surface)` / `rgba(242, 255, 252, 0.65)` |
| `--glass-blur` | `blur(14px) saturate(1.2)` |
| `--glass-border-t` | `rgba(255, 255, 255, 0.45)` (brillo especular superior) |
| `--glass-inset-highlight` | `inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -1px 2px rgba(255,255,255,0.15)` |
| `--noise-texture` | SVG `fractalNoise` (anti-plástico a 2–4% de opacidad) |
| `--shadow-btn-primary` | `0 6px 24px rgba(14,165,233,0.25), 0 2px 8px rgba(0,0,0,0.08)` |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` (curva con overshoot característica) |
| `.glass-panel` / `.glass-card` | Paneles con blur, borde sutil translúcido, ruido y brillo especular |
| `.btn-aero-*` | Botones Aero con volumen real, micro-elevación en hover y compresión en active |
| Defensa volumétrica | `style="flex: 0 0 44px; min-width: 44px; min-height: 44px"` en avatares y botones (anti-colapso WebKit/Blink) |
| `LiquidBackground.svelte` | Fondo dinámico líquido con 3 blobs bioluminiscentes CSS, god rays y auto-pausa en `document.hidden` |
| Mood Drag-to-Scroll | Selector de estados en `/posts/create` con física elástica de overscroll e inercia (`requestAnimationFrame`) |

### 10.1 Reproductor Multimedia Unificado

`MediaPlayer.svelte` es el reproductor de audio/vídeo propio de la plataforma. Reemplazó a **Vidstack** (dependencia eliminada) y al `<video>` nativo del navegador en todas las páginas de creación (`stories/create`, `reels/create`) y en el feed (`PostCard`), dando una experiencia consistente. Características:

- Controles: play/pausa, volumen/mute, *seek* con barra y *tooltip* de tiempo, retroceder/avanzar 10s, velocidades (0.5x–2x), pantalla completa, *Picture-in-Picture*, bucle y menú de contexto.
- Atajos de teclado (espacio/k, f, m, flechas, Home/End) y *media session* del SO (controles de bloqueo/notificación).
- *Autoplay* al entrar en el viewport (IntersectionObserver, umbral 35%) y pausa al salir; pausa cualquier otro reproductor activo (un solo audio/vídeo sonando a la vez).
- *Tracking* de vistas: registra `activity.view` cuando el usuario reproduce más del 25% / 3s de un vídeo con `entityType`/`entityId`.
- Panel "Acerca de este reproductor" con la versión del proyecto (v0.6.0-beta.1) y la nota de licencia AGPLv3.

### Personalización de Perfil

Tabla `profile_customizations` permite a cada usuario definir:
- `primary_color` y `bg_color`
- Imagen de fondo (`bg_image_url`)
- Intensidad de blur (`glass_blur`) y opacidad (`glass_opacity`)
- Fuente personalizada (`font_family`, `custom_font_url`)
- CSS custom (`custom_css`)
- Layout de bloques (`blocks_layout`)

---

## 11. Configuración (.env)

### Variables leídas por el código

| Variable | Descripción | Default |
|----------|-------------|---------|
| `NODE_ENV` | Entorno (`development` / `production`) | `development` |
| `PORT` | Puerto del servidor (dev y prod) | `3000` |
| `HOST` | Host de escucha (`server.js` de producción) | `0.0.0.0` |
| `DB_PATH` | Ruta al archivo SQLite | `./database.sqlite` |
| `DATABASE_URL` | URL de LibSQL (local: `file:` o remota: `libsql://`) | derivado de `DB_PATH` |
| `DATABASE_AUTH_TOKEN` | Token de autenticación para Turso remoto | — |
| `JWT_SECRET` | Secreto para firmar JWT (**crítico en producción**) | — |
| `JWT_EXPIRES_IN` | Duración del token | `7d` |
| `LOG_LEVEL` | Nivel de logs de Pino (`logger.js`) | `info` |
| `CRON_SECRET` | Protege `/api/cron` (header `X-Cron-Secret`) | — |

### Variables de referencia (`.env.example`)

| Variable | Nota |
|----------|------|
| `APP_URL` | URL pública del despliegue (referencia; no se lee en runtime hoy) |
| `UPLOAD_DIR`, `MAX_FILE_SIZE` | Referencia; el runtime resuelve uploads siempre a `uploads/` en la raíz del repo (`getUploadsDir`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Referencia; el runtime lee SMTP desde `system_settings` (`email.js`) |
| `INSTALL_LOCK` | El wizard de instalación lo escribe (`INSTALL_LOCK=true`) al finalizar |
| `GOOGLE_CLIENT_ID`/`SECRET`, `APPLE_*`, `VAPID_*`, `TENOR_API_KEY`, `OPENAI_API_KEY`, `DEMO_MODE` | No se leen en runtime hoy (OAuth sin cablear, Web Push sin implementar) |

---

## 12. Operaciones

### 12.1 Desarrollo Local

```bash
cd frontend
npm install
cd ..
cp .env.example .env
# editar .env con valores locales
node scripts/seed.js
cd frontend
npm run dev          # → http://localhost:5173
```

### 12.2 Producción

#### Opción A: Node.js directo

```bash
cd frontend
npm run build
npm start            # → http://localhost:3000 (usa adapter-node + server.js)
```

#### Opción B: Docker

```bash
# configurar .env con JWT_SECRET y demás variables de producción
docker-compose up --build -d
```

El contenedor expone puerto `3000`, monta un volumen `vsocial_data` en `/data` (DB + uploads),
y tiene healthcheck cada 30s contra `/api/health`.

#### Opción C: Nginx + Node.js

```bash
# 1. Arrancar Node.js en puerto 3000
cd frontend && npm start &

# 2. Nginx como proxy reverso
nginx -c /path/to/nginx.conf
```

Nginx maneja WebSocket upgrades, establece headers de IP real, y deshabilita buffering.

### 12.3 Base de Datos

**Migraciones:**
```bash
node scripts/migrate-up.js      # aplicar pendientes
node scripts/migrate-down.js    # revertir última
node scripts/migrate-down.js 3  # revertir últimas 3
```

**Semilla:**
```bash
node scripts/seed.js            # insertar system_settings + marketplace_categories
```

**Documentación y utilidades raíz:**
```bash
node scripts/build_docs.js      # regenerar portal /docs (frontend/static/docs/index.html)
node debug_db.js                # diagnóstico detallado (ad-hoc)
node update_db.js               # actualizar datos (ad-hoc)
node migrate_status.js          # estado de migraciones (ad-hoc)
```

### 12.4 Tests

```bash
cd frontend
npm run test                    # vitest run — 8 suites (50 tests) en tests/ (raíz del repo)
npm run test:watch              # vitest en modo watch
# suite individual desde la raíz del repo:
npx vitest run tests/auth.test.js
npx vitest run tests/reposts.test.js -t "<nombre>"   # filtrar por nombre
```

### 12.5 Linting y Formato

```bash
cd frontend
npm run lint                    # prettier --check + eslint
npm run format                  # prettier --write + eslint --fix
```

---

## 13. Seguridad

| Capa | Implementación |
|------|---------------|
| **Rate Limiting** | In-memory Map en `hooks.server.js`: 1000 req/min por IP y 2000 req/min por usuario autenticado (claves `ip:` / `usr:`). Exentos: staff y localhost. Excluidos del limitador: `/api/gamification/heartbeat` y `/api/health`. GC cada 2 min. |
| **Anti-bots / Spam** | Reputación de autores (batch 6 h) + heurísticas spam/bots (batch 30 min) + `batch-writer.js` para escritura de métricas sin contención WAL |
| **CSRF** | Validación de headers `Origin`/`Referer` contra host en POST/PUT/DELETE. 403 si no coinciden. |
| **Headers HTTP** | Manuales en `hooks.server.js`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security` (max-age=63072000 + includeSubDomains + preload), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (cámara off, mic/geolocalización self). Helmet está en `package.json` pero no se usa |
| **Auth** | JWT en `localStorage` + cookie client-side `SameSite=Strict; Secure` (duración default 365 días). Hash del token (SHA-256) almacenado en `user_sessions` con IP + user-agent. `requireAuth`/`optionalAuth` verifican JWT + sesión no expirada en cada petición. |
| **Passwords** | bcryptjs con coste de hashing (cost 10) |
| **Input** | Validación con expresiones regulares y sanitización propia (`lib/server/security.js`). Sanitización de entidades y HTML seguro (`lib/server/entities.js`). |
| **Helmet** | Middleware de seguridad HTTP (activado en producción) |
| **Bloqueos** | Tabla `blocked_users` (bloqueo bidireccional). Tabla `snoozed_users` (silencio temporal). |
| **Reportes** | Sistema de reportes con estados (pending, reviewed, resolved, dismissed). |

### 13.1 Cumplimiento RGPD (UE)

VSocial implementa los derechos del interesado (arts. 15-21 RGPD) de forma self-service:

| Derecho | Implementación |
|---------|----------------|
| **Información** | Páginas legales públicas `/privacy`, `/terms`, `/cookies` (sin login, listadas en `publicRoutes` del layout). Enlaces en footer, login y registro. |
| **Consentimiento** | Registro con checkbox obligatorio de Términos + Privacidad + confirmación de edad ≥13. Sellado con `terms_accepted_at` / `privacy_accepted_at` (migración `003_gdpr.sql`). Validación autoritativa en servidor (cliente es solo UX). |
| **Edad (art. 8)** | Age gate 13+: campo `birth_date` en registro, validación server-side (rechaza <13 con 403). |
| **Cookies** | `CookieBanner.svelte` muestra consentimiento en la primera visita; elección en `localStorage` + cookie `vsocial_cookie_consent` (`Secure; SameSite=Strict`). Sin analítica/publicidad de terceros — solo cookies esenciales de auth. |
| **Acceso / Portabilidad (art. 20)** | `GET /api/users/export` → JSON descargable (`Content-Disposition: attachment`) con perfil, posts, comentarios, mensajes, reacciones, follows, stories, reels, marketplace, gigs, notificaciones, activity_logs, check_ins, oauth. Omite `password_hash` y tokens OAuth. Botón en Ajustes → Mis Datos. |
| **Supresión / olvido (art. 17)** | `POST /api/users/delete-account` (confirmación con contraseña) → soft-delete (`deleted_at=now`, `is_active=0`) + cierre de todas las sesiones. Reactivación al login dentro de 30 días; pasado ese plazo, el cron diario hard-deletea en cascada + limpia ficheros huérfanos. |

**Notas y límites del MVP:** el consentimiento de cookies se registra solo en cliente (sin log server-side). Quedan pendientes: verificación de email (código muerto en `email.js`), cambio de email, "cerrar todas las sesiones" self-service, purga/retención general de `activity_logs`, refactor a cookies httpOnly.

---

## 14. Workers Cron (en `hooks.server.js`)

Ejecutados en el mismo proceso Node.js, disparados en el primer request:

| Worker | Intervalo | Función |
|--------|-----------|---------|
| **Scheduled Post Publisher** | 60s | Publica posts con `scheduled_at <= now`, envía notificaciones a seguidores |
| **Daily Memories** | 00:01 cada día | Busca posts "en este día" de años anteriores, envía notificación de recuerdo |
| **Expired Stories Cleanup** | 5 min | Elimina stories con `expires_at < now` |
| **Expired Snooze Cleanup** | 1 hora | Limpia snoozes expirados |
| **Rate Limiter GC** | 2 min | Elimina entradas expiradas del Map de rate limiting |
| **GDPR Erasure** | 24 h | Hard-deletea en cascada (`ON DELETE CASCADE`) los usuarios con `deleted_at` > 30 días y borra sus ficheros huérfanos de `uploads/avatars` y `uploads/covers` |
| **Author Reputation Refresh** | 6 h | Recalcula la reputación de autores activos (`batchUpdateReputations`) |
| **Spam & Bot Scanning** | 30 min | Escanea señales de spam/bots en usuarios activos recientes (`batchScanSpamSignals`) |
| **Feed Impressions Cleanup** | 24 h | Purga `feed_impressions` con `seen_at` anterior a 7 días |

---

## 15. Flujo de Instalación Fresh

1. Clonar repo, `npm install` en `frontend/`
2. Copiar `.env.example` → `.env`, configurar `JWT_SECRET`
3. `node scripts/seed.js` (opcional pero recomendado)
4. `npm run dev` → primera visita redirige a `/install`
5. Wizard de instalación: crea tablas y primer admin
6. Redirige a `/setup` para configuración inicial
7. Plataforma lista en `/`

---

## 16. Glosario de Archivos Clave

| Archivo | Rol |
|---------|-----|
| `schema_sqlite.sql` | Fuente canónica del schema. Ejecutado en boot y en install wizard. |
| `hooks.server.js` | Middleware global. DB init, rate limit, CSRF, security headers, cron workers. |
| `db.js` | Adaptador universal de DB. Detecta driver, aplica PRAGMAs, expone API unificada. |
| `auth.js` | Login, hash, creación de sesiones. |
| `jwt.js` | Firmado y verificación de tokens JWT. |
| `security.js` | Validación, sanitización, rate limiting helpers. |
| `api.js` (cliente) | Cliente HTTP unificado para llamadas al backend desde componentes. |
| `auth.svelte.js` | Store de autenticación (reactivo). |
| `notifications.svelte.js` | Store de notificaciones (reactivo). |
| `service-worker.js` | PWA: cache-first para assets estáticos. No cachea API. |
| `vite.config.js` | Config Vite + SvelteKit + Vitest. |
| `author-reputation.js` | Reputación determinista de autores (batch 6 h). |
| `batch-writer.js` | Búfer de escritura en memoria para métricas de alta concurrencia. |
| `spam-heuristics.js` | Heurísticas deterministas de spam/bots (batch 30 min). |
| `features.svelte.js` | Store de feature flags servidos por `system_settings`. |
| `svelte.config.js` | Runes mode forzado (excepto node_modules), adapter-node con precompress. |
| `Dockerfile` | Multi-stage build (alpine), output precomprimido. |
| `docker-compose.yml` | Single service + healthcheck + volumen persistente. |
| `nginx.conf` | Proxy reverso WebSocket-ready, buffering off. |
| `server.js` | Entrypoint de producción standalone. |

---

## 17. Roadmap (Beta v0.1.0)

Pendiente para el salto de Alpha → Beta:

- [ ] Sincronización in-memory para múltiples instancias Node
- [ ] Cola de workers interna para emails, push, thumbnails
- [ ] Optimización continua en Turso/SQLite
- [x] CI/CD pipeline (GitHub Actions) — `.github/workflows/ci.yml` corre `npm run lint` + `npm run build` en Node 22 sobre cada push/PR a `main`, con cancelación de runs obsoletos y subida del artifact `build/`.
- [x] Suites de tests Vitest — 8 suites (50 tests) en `tests/`: auth, reposts, anonymous posts, anon identities, custom assets, feed algorithm, moderation strikes y verifications. Se ejecutan con `cd frontend && npm run test` (vitest resuelve `tests/` de la raíz).
- [ ] Tests de integración y e2e (Playwright)

---

> **VSocial Beta v0.6.0-beta.1** — Una maquinaria completa construida sobre SvelteKit 5, SQLite/LibSQL,
> WebSockets y diseño Glassmorphism propio. 40 páginas .svelte, 25 grupos de API, 63 tablas,
> 19 módulos server-side. Lista para crecer.