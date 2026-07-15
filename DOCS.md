# VSocial — Documentación Completa de Proyecto (Alpha v0.0.2)

> Documento técnico maestro. Arquitectura, stack, módulos, API, base de datos, configuración,
> operaciones y guía de desarrollo. Todo en un solo archivo.

---

## 1. Visión General

**VSocial** es una red social full-stack construida con SvelteKit 5, SQLite/LibSQL,
WebSockets y diseño Glassmorphism 2.0 propio. Cubre el espectro completo de una plataforma
social moderna: feed, posts, reels, stories, marketplace, mensajería en tiempo real,
grupos, notificaciones push, gamificación y panel administrativo.

- **Versión:** Alpha v0.0.2
- **Licencia:** GPLv3
- **Estado:** Funcional completo — 16+ módulos implementados

---

## 2. Tech Stack

### 2.1 Frontend

| Capa | Tecnología |
|------|-----------|
| Framework | SvelteKit 5 (SSR + CSR híbrido) |
| Reactividad | Runes de Svelte 5 (`$state`, `$derived`, `$props`) |
| Estilos | Tailwind CSS + DaisyUI base + CSS puro para Glassmorphism |
| Iconografía | Material Icons Round (Google Fonts) |
| Emojis | Twemoji (renderizado via Svelte action) |
| Empaquetado | Vite 8 |
| Adapter | `@sveltejs/adapter-node` (servidor Node.js standalone) |
| PWA | Service worker cache-first, manifest.json |

### 2.2 Backend

| Capa | Tecnología |
|------|-----------|
| API | Rutas SvelteKit `+server.js` (mismo proceso Node.js) |
| Auth | JWT (`jsonwebtoken`) en cookies `httpOnly` |
| Sesiones | Tabla `user_sessions` con token hash + IP + user-agent |
| OAuth | Google, Apple (estructura lista, implementación parcial) |
| Hashing | bcryptjs |
| Validación | `validator` + módulo `security.js` propio |
| Rate Limiting | In-memory (150 req/min por IP) en `hooks.server.js` |
| Email | Nodemailer (verificación, reset password) |
| Logging | Pino + pino-pretty (structured JSON logs) |
| Seguridad HTTP | Helmet + headers manuales (HSTS, X-Frame-Options, etc.) |
| CSRF | Validación de Origin/Referer en `hooks.server.js` |

### 2.3 Base de Datos

| Capa | Tecnología |
|------|-----------|
| Motor primario | `@libsql/client` (soporta local WAL + remoto Turso) |
| Fallback | `better-sqlite3` (nativo, síncrono envuelto en async) |
| API unificada | Adaptador universal en `db.js` — misma interfaz para ambos |
| Esquema | 783 líneas SQL idempotente (`schema_sqlite.sql`) |
| Migraciones | Carpeta `migrations/` + scripts `migrate-up.js` / `migrate-down.js` |
| ORM | No se usa. Raw SQL con prepared statements |

### 2.4 Tiempo Real

| Capa | Tecnología |
|------|-----------|
| WebSockets | `socket.io` (servidor + cliente) |
| Chat | Mensajería DM + grupos con media, voz, reacciones, replies |
| WebRTC | Señalización para llamadas via `rtc_signals` |
| SSE | Stream de notificaciones via `/api/notifications` |

### 2.5 Infraestructura / DevOps

| Capa | Tecnología |
|------|-----------|
| Contenedores | Docker + docker-compose (single service + healthcheck) |
| Proxy reverso | nginx.conf (WebSocket-ready, buffering off) |
| Redis | `ioredis` instalado (uso actual: limitado/opcional) |
| Tests | Vitest (`tests/auth.test.js`) |
| Linting | ESLint 9 + Prettier 3 + plugin Svelte |
| Git hooks | Husky (`.husky/`) |
| CI/CD | Pre-commit linting + build verification |

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
│   │   │   ├── components/  ← 20 componentes UI reutilizables
│   │   │   ├── stores/      ← 4 stores reactivos Svelte 5
│   │   │   ├── actions/     ← 1 Svelte action (twemoji)
│   │   │   ├── server/      ← 13 módulos server-side
│   │   │   ├── utils/       ← utilidades compartidas
│   │   │   └── assets/      ← recursos estáticos importables
│   │   └── routes/          ← sistema de rutas SvelteKit (páginas + API)
│   ├── static/              ← assets públicos (favicon, logo, manifest, robots.txt)
│   ├── build/               ← output de producción (generado)
│   └── uploads/             ← archivos subidos (local dev)
│
├── schema_sqlite.sql        ← esquema canónico único (783 líneas, idempotente)
├── database.sqlite          ← base de datos local (desarrollo)
├── migrations/              ← registro histórico de cambios de schema
├── scripts/                 ← utilidades CLI
│   ├── migrate-up.js        ← aplicar migraciones pendientes
│   ├── migrate-down.js      ← revertir última migración
│   └── seed.js              ← sembrar datos iniciales
├── tests/                   ← suite de tests
│   └── auth.test.js         ← tests de seguridad + conectividad DB
├── uploads/                 ← directorio de uploads (producción)
├── docker-compose.yml       ← orquestación Docker
├── Dockerfile               ← build multi-stage (alpine, precompress)
├── nginx.conf               ← proxy reverso (WebSocket, buffering off)
└── eslint.config.js         ← config ESLint 9
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

### 4.2 Dominios del Esquema (15 dominios, ~35 tablas)

| Dominio | Tablas | Función |
|---------|--------|---------|
| **1. Users & Auth** | `users`, `user_roles`, `user_titles`, `user_sessions`, `user_settings` | Perfil, roles, sesiones, preferencias |
| **2. Posts & Content** | `posts`, `post_media`, `post_likes`, `post_reactions`, `comments`, `comment_reactions`, `saved_posts`, `hashtags`, `post_hashtags`, `check_ins` | Publicaciones, media, reacciones, comentarios anidados, hashtags, check-ins geolocalizados |
| **3. Stories** | `stories`, `story_highlights`, `story_highlight_items` | Historias efímeras (24h) + highlights permanentes |
| **4. Reels** | `reels`, `reel_likes`, `reel_comments` | Videos cortos estilo TikTok/Reels |
| **5. Messaging** | `conversations`, `conversation_participants`, `messages_new`, `message_reactions`, `message_read_receipts` | Chat DM + grupos, voz, media, replies, reacciones, recibos de lectura |
| **6. Notifications** | `notifications` | Motor de actividad social (like, comment, follow, mention, system) |
| **6b. Moderation** | `reports` | Reportes de contenido por usuarios |
| **7. Marketplace** | `marketplace_categories`, `marketplace_listings`, `listing_media` | Categorías, anuncios con precio/condición/ubicación, detección de fraude |
| **8. Wallet** | `wallets`, `wallet_transactions`, `transactions` | Monedero virtual y transacciones |
| **9. Gigs** | `gigs`, `gig_applications` | Tablón freelance: encargos y postulaciones |
| **10. Push** | `web_push_subscriptions` | Suscripciones Web Push (VAPID) |
| **11. System** | `system_settings`, `sponsored_posts`, `cms_pages` | Configuración global, anuncios, páginas CMS |
| **12. Groups & Pages** | `groups`, `group_members`, `group_posts`, `group_events`, `pages`, `page_followers` | Comunidades, páginas públicas, eventos |
| **13. Security** | `oauth_accounts`, `email_tokens`, `blocked_users`, `snoozed_users` | OAuth, verificación email, bloqueos, silenciados temporales |
| **14. Aesthetics** | `profile_customizations` | Glassmorphism 2.0: colores, blur, opacidad, CSS custom, bloques |
| **15. Infrastructure** | `system_cache`, `rtc_signals`, `daily_xp_limits`, `activity_logs` | Caché, señalización WebRTC, gamificación, registro de actividad |

---

## 5. Sistema de Rutas

### 5.1 Páginas (Frontend) — 31 páginas .svelte

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/` | `+page.svelte` | Home / feed principal |
| `/login` | `login/+page.svelte` | Inicio de sesión |
| `/register` | `register/+page.svelte` | Registro de usuario |
| `/install` | `install/+page.svelte` | Wizard de instalación inicial |
| `/setup` | `setup/+page.svelte` | Configuración inicial (primer admin) |
| `/feed` | `feed/+page.svelte` | Feed de publicaciones |
| `/explore` | `explore/+page.svelte` | Explorar / descubrir contenido |
| `/notifications` | `notifications/+page.svelte` | Centro de notificaciones con pestañas |
| `/messages` | `messages/+page.svelte` | Chat / mensajería |
| `/marketplace` | `marketplace/+page.svelte` | Marketplace de compra/venta |
| `/reels` | `reels/+page.svelte` | Feed de Reels (videos cortos) |
| `/reels/[id]` | `reels/[id]/+page.svelte` | Reel individual |
| `/reels/create` | `reels/create/+page.svelte` | Crear Reel |
| `/posts/[id]` | `posts/[id]/+page.svelte` | Post individual con comentarios |
| `/posts/[id]/edit` | `posts/[id]/edit/+page.svelte` | Editar post |
| `/posts/create` | `posts/create/+page.svelte` | Crear post |
| `/stories/create` | `stories/create/+page.svelte` | Crear historia |
| `/u/[username]` | `u/[username]/+page.svelte` | Perfil de usuario público |
| `/u/[username]/following` | `u/[username]/following/+page.svelte` | Lista de seguidos |
| `/settings` | `settings/+page.svelte` | Configuración de cuenta |
| `/settings/design` | `settings/design/+page.svelte` | Personalización de diseño/theme |
| `/settings/activity` | `settings/activity/+page.svelte` | Registro de actividad personal |
| `/leaderboard` | `leaderboard/+page.svelte` | Tabla de clasificación |
| `/admin` | `admin/+page.svelte` | Dashboard de administración |
| `/admin/users` | `admin/users/+page.svelte` | Gestión de usuarios |
| `/admin/reports` | `admin/reports/+page.svelte` | Gestión de reportes |
| `/admin/content` | `admin/content/+page.svelte` | Moderación de contenido |
| `/admin/settings` | `admin/settings/+page.svelte` | Configuración del sistema |
| `/admin/apis` | `admin/apis/+page.svelte` | Gestión de APIs |
| `/about` | `about/+page.svelte` | Acerca de VSocial |
| `/about/verified` | `about/verified/+page.svelte` | Info sobre verificación |

### 5.2 API Endpoints — 24 grupos de endpoints

| Ruta API | Métodos | Función |
|----------|---------|---------|
| `/api/auth/[action]` | POST | login, register, logout, reset-password, verify-email |
| `/api/health` | GET | Health check (`{ status: 'ok', uptime, db }`) |
| `/api/install` | POST | Instalación inicial: crea tablas, admin user, system settings |
| `/api/setup` | POST | Wizard post-instalación |
| `/api/posts/[...path]` | GET, POST, PUT, DELETE | CRUD de posts + like/unlike + save/unsave + pin/unpin |
| `/api/feed/[...path]` | GET | Feed inteligente, timeline, trending, explore |
| `/api/reels/[...path]` | GET, POST, PUT, DELETE | CRUD de reels + like/unlike + comentarios |
| `/api/stories/[...path]` | GET, POST, DELETE | CRUD de stories + highlights |
| `/api/comments/[...path]` | GET, POST, DELETE | Comentarios anidados en posts/reels |
| `/api/users/[...path]` | GET, PUT | Perfiles, follows/unfollow, bloquear/snoozear, búsqueda |
| `/api/notifications/[...path]` | GET, PUT, PATCH, SSE | Lista, marcar leídas, marcar todas leídas, stream SSE |
| `/api/messages/[...path]` | GET, POST | Conversaciones, mensajes, media, creación de grupos |
| `/api/marketplace/[...path]` | GET, POST, PUT, DELETE | Listings, categorías, búsqueda, flag |
| `/api/market/[...path]` | GET, POST | Variante de marketplace |
| `/api/gigs/[...path]` | GET, POST, PUT | Gigs freelance + aplicaciones |
| `/api/wallet/[...path]` | GET, POST | Balance, transacciones |
| `/api/reports` | POST | Crear reporte de contenido/usuario |
| `/api/upload` | POST | Subida de archivos (imagen, video, audio) |
| `/api/rtc/signal` | POST | Señalización WebRTC (oferta/respuesta/ICE) |
| `/api/search` | GET | Búsqueda global (usuarios, posts, hashtags) |
| `/api/gamification/leaderboard` | GET | Rankings de usuarios |
| `/api/gamification/checkin` | POST | Check-in diario |
| `/api/gamification/heartbeat` | POST | Latido de actividad (tracking de sesión) |
| `/api/activity/view` | POST | Registrar vista de contenido |
| `/api/activity/history` | GET | Historial de actividad del usuario |
| `/api/admin/[...path]` | GET, POST, PUT | Panel admin: users, reports, settings, content |
| `/api/cron` | GET, POST | Workers cron (publicación programada, limpieza, recuerdos) |
| `/api/gifs/search` | GET | Proxy de búsqueda GIFs (Tenor) |
| `/api/uploads/[...path]` | GET | Servir archivos estáticos subidos |

---

## 6. Stores Reactivos (Cliente)

| Store | Archivo | Estado |
|-------|---------|--------|
| **auth** | `stores/auth.svelte.js` | `user`, `token`, `role`, `isAuthenticated`, `login()`, `logout()`, `refreshUser()` |
| **notifications** | `stores/notifications.svelte.js` | `list`, `unreadCount`, `markRead()`, `markAllRead()`, `addNotification()` |
| **theme** | `stores/theme.svelte.js` | `mode` (light/dark/auto), `toggle()`, persistencia en localStorage |
| **ui** | `stores/ui.svelte.js` | `sidebarOpen`, `activeModal`, `toasts[]`, `showToast()`, `dismissToast()` |

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
| `MediaPlayer.svelte` | Reproductor de audio/video |
| `VoiceRecorder.svelte` | Widget de grabación de voz para mensajes |
| `KlipyPicker.svelte` | Picker de emojis/GIFs/stickers (integración Klipy) |
| `TwemojiPicker.svelte` | Picker de emojis Twemoji |
| `HashtagTextarea.svelte` | Textarea con soporte de hashtags |
| `ReportModal.svelte` | Modal para reportar contenido |
| `PwaPrompt.svelte` | Banner de instalación PWA |
| `QuickChatWidget.svelte` | Widget flotante de chat rápido |
| `CustomSelect.svelte` | Select/dropdown personalizado |
| `PasswordMeter.svelte` | Medidor de fortaleza de contraseña |
| `LiquidBackground.svelte` | Fondo animado con gradiente líquido |
| `ActivityHistory.svelte` | Registro de actividad del usuario |
| **Gamificación:** | |
| `gamification/CheckinButton.svelte` | Botón de check-in diario |
| `gamification/LevelBadge.svelte` | Insignia de nivel |
| `gamification/PodiumCard.svelte` | Tarjeta de podium en leaderboard |
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

---

## 9. Sistema de Gamificación

| Mecánica | Descripción |
|----------|-------------|
| **XP Points** | Puntos de experiencia acumulados por acciones (postear, comentar, likear, check-in) |
| **Level** | Nivel basado en XP total, con badge visual |
| **Check-in Streak** | Rachas diarias con recompensa progresiva |
| **Daily XP Limits** | Límites por fuente (`daily_xp_limits`) para prevenir grinding |
| **User Titles** | Títulos personalizados otorgados por admins con color asignado |
| **Leaderboard** | Rankings públicos de usuarios por nivel/XP |
| **Heartbeat** | Tracking de sesión activa para medir engagement |

---

## 10. Diseño: Glassmorphism 2.0 (Neo-Aero)

### Tokens de Diseño

| Token | Valor |
|-------|-------|
| `glass-panel` / `glass-card` | `bg-white/5` a `bg-white/10` + `backdrop-blur-md` (o `xl`) + `border-white/5` |
| Sombras primarias | `shadow-[0_0_15px_rgba(27,133,243,0.15)]` (neón, no negras) |
| Hover lift | `hover:-translate-y-0.5` + `scale-105` en imágenes internas |
| Reflexiones | Divs superpuestos con gradientes simulando reflexión de cristal |
| Defensa volumétrica | `flex: 0 0 44px; min-width: 44px; min-height: 44px` en avatares (anti-colapso WebKit/Blink) |

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

### Variables Requeridas

| Variable | Descripción | Default |
|----------|-------------|---------|
| `NODE_ENV` | Entorno (`development` / `production`) | `development` |
| `PORT` | Puerto del servidor | `3000` |
| `DB_PATH` | Ruta al archivo SQLite | `./database.sqlite` |
| `DATABASE_URL` | URL de LibSQL (local: `file:` o remota: `libsql://`) | derivado de `DB_PATH` |
| `DATABASE_AUTH_TOKEN` | Token de autenticación para Turso remoto | — |
| `JWT_SECRET` | Secreto para firmar JWT (**crítico en producción**) | — |
| `JWT_EXPIRES_IN` | Duración del token | `7d` |

### Variables Opcionales

| Variable | Función |
|----------|---------|
| `UPLOAD_DIR` | Directorio de uploads | `./uploads` |
| `MAX_FILE_SIZE` | Tamaño máximo de archivo (bytes) | `10485760` (10MB) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Configuración de email |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | OAuth Apple |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push |
| `OPENAI_API_KEY` | Integración OpenAI |
| `TENOR_API_KEY` | GIF search (Tenor) |
| `INSTALL_LOCK` | Bloquear reinstalación | `false` |
| `DEMO_MODE` | Modo demo (datos ficticios) | — |

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

**Inspección:**
```bash
node check_db.js                # verificar estado de DB
node debug_db.js                # diagnóstico detallado
node alter_db.js                # modificar schema manualmente
node update_db.js               # actualizar datos
```

### 12.4 Tests

```bash
cd frontend
npm run test                    # vitest run (1 archivo: auth.test.js)
npm run test:watch              # vitest en modo watch
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
| **Rate Limiting** | In-memory Map en `hooks.server.js`: 150 req/min por IP para `/api/`. Staff exento. GC cada 2 min. |
| **CSRF** | Validación de headers `Origin`/`Referer` contra host en POST/PUT/DELETE. 403 si no coinciden. |
| **Headers HTTP** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security` (max-age=63072000 + includeSubDomains + preload), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (cámara off, mic/geolocalización self) |
| **Auth** | JWT en cookie `httpOnly` + Secure + SameSite=Lax. Tokens hasheados en `user_sessions`. |
| **Passwords** | bcryptjs con salt automático |
| **Input** | Validación con `validator` (email, username, password strength). Sanitización HTML con `dompurify`. |
| **Helmet** | Middleware de seguridad HTTP (activado en producción) |
| **Bloqueos** | Tabla `blocked_users` (bloqueo bidireccional). Tabla `snoozed_users` (silencio temporal). |
| **Reportes** | Sistema de reportes con estados (pending, reviewed, resolved, dismissed). |

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
| `svelte.config.js` | Runes mode forzado (excepto node_modules), adapter-node con precompress. |
| `Dockerfile` | Multi-stage build (alpine), output precomprimido. |
| `docker-compose.yml` | Single service + healthcheck + volumen persistente. |
| `nginx.conf` | Proxy reverso WebSocket-ready, buffering off. |
| `server.js` | Entrypoint de producción standalone. |

---

## 17. Roadmap (Beta v0.1.0)

Pendiente para el salto de Alpha → Beta:

- [ ] Redis como caché distribuida real (feeds, sesiones, rate limiting)
- [ ] Cola de workers (BullMQ/Redis) para emails, push, thumbnails
- [ ] CDN para uploads + transformación de imágenes (sharp/imgproxy)
- [ ] Separación backend/frontend en servicios independientes
- [ ] PostgreSQL o Turso distribuido como DB primaria en producción
- [ ] Monitoreo (OpenTelemetry, Sentry, health checks avanzados)
- [ ] Feed algorítmico con ML/recomendación real
- [ ] CI/CD pipeline completo (GitHub Actions)
- [ ] Tests de integración y e2e (Playwright)

---

> **VSocial Alpha v0.0.2** — Una maquinaria completa construida sobre SvelteKit 5, SQLite/LibSQL,
> WebSockets y diseño Glassmorphism propio. 31 páginas, 24 API endpoints, 35 tablas,
> 13 módulos server-side. Lista para crecer.