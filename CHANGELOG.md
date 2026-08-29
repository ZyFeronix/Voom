# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [RELEASED]

## [Unreleased]

### Added
- **Frutiger Aero Engine — superficies Aero (migración `017`):** la pestaña «Aplicación» de `/settings/design` gana la bóveda de presets de 1 clic (`PresetVault.svelte`: Aqua OS 2004, Frutiger Eco, Aero Glass 7, Neo-Aero Orb y Abismo Bio — aplican acento+cristal+geometría+gloss+fuente+densidad+modo de fondo en un solo PUT), control de superficies (`SurfacePanel.svelte`: opacidad de tarjetas 40–100% con cristal `color-mix` sobre las clases reales del sistema de vidrio; geometría de bordes Brutalista/Moderno/Redondeado/Bubble redefiniendo los tokens `--radius-*` sin tocar `--radius-full`; brillo especular curvo Aqua/Win7 vía variable `--gloss-strength`) y modos de wallpaper Cover/Mosaico/Ajustar (tile con `image-rendering: pixelated` para patrones y pixel art). Cinco columnas nuevas en `user_settings`; en perfiles lite el cristal vuelve a sólido automáticamente. Snippets Frutiger Aero añadidos a la galería de CSS del perfil.
- **Apariencia global por usuario (migración `016`):** `/settings/design` se convierte en hub dual con pestañas «Perfil» (editor existente) y «Aplicación»: acento global con paleta derivada HSL automática y badges de contraste WCAG, escala tipográfica 0.85–1.25, densidad compacta/cómoda/amplia, fuente global (Outfit/Inter/JetBrains Mono autoalojada/fuente propia del perfil, inyección idempotente) y wallpaper de la app con oscurecimiento para legibilidad. Seis columnas nuevas en `user_settings` validadas en `user-settings.js`; sincronización multi-dispositivo debouncada (500 ms) con flush `keepalive` al cerrar; anti-flash pre-paint en `app.html` solo con lo crítico del primer fotograma; hidratación desde cuenta (`preferred_*` en `/api/auth/me`, login y register). La pestaña «Perfil» añade galería de snippets CSS insertables en cursor y lint suave del CSS custom.
- **Tags curados administrables (migración `013`):** la tabla `tags` convierte los chips de `/explore` en datos reales gestionados desde `/admin/tags` (crear, renombrar, icono, eliminar). El feed de `/explore` filtra por hashtag `#slug` vía `/api/feed/explore?category=<slug>` y `/api/tags` (lista pública + CRUD admin).
- **Thumbnails automáticos para reels:** al publicar, si el cliente no envía thumbnail se genera un JPEG con `ffmpeg-static` (frame del 25% del vídeo). La migración `015` añade `reels.video_width`/`video_height` para fijar el aspect-ratio antes del primer render y eliminar el reflujo de overlays (CLS 0.307 → ~0).
- **Thumbnails de marketplace:** `listing_media.thumb_url` (máx. 540px) generado en upload; los grids de `/marketplace` sirven el thumbnail en vez del original (LCP medido: 13.1s).
- **Perfiles de rendimiento lite / balanced / high** (`perf.svelte.js`, página `/settings/performance`): efecto especular del cristal escalado por tier, detección de hardware, benchmark de FPS con recomendación automática, HUD de FPS (`FpsHud.svelte`) y preferencias finas (autoplay según red, data saver, precarga al hover). Fuentes autoalojadas (`static/fonts/` + `fonts.css`) y CSP `font-src 'self'`.
- **Gestión de sesiones activas:** `GET/DELETE /api/auth/sessions` (listar, revocar una, cerrar todas las demás) con dispositivo/navegador parseados del user-agent. UI en `/settings/security`. Cron diario que purga sesiones expiradas.
- **Notificaciones centralizadas y respetuosas** (`lib/server/notifications.js`): punto único de creación que respeta los toggles del destinatario (`notify_likes/comments/follows/dms`) y evita auto-notificaciones.
- **Visibilidad de perfil aplicada server-side** (`lib/server/visibility.js`): `profile_visibility` (`public`/`followers`/`friends`) del dueño gobierna el acceso a perfiles y reels vía `getProfileAccess`.
- **Sanitizador isomórfico de CSS custom** (`lib/design/sanitize.js`): reescribe `position:fixed`, acota `z-index`, solo permite `url()` locales, prefija selectores con `.profile-custom-wrapper`. Render centralizado en `ProfileThemeShell.svelte` con paridad WYSIWYG entre perfil público y editor.
- **Página admin `/admin/apis`:** gestión de claves de APIs externas (Klipy) almacenadas en `system_settings`.
- **Curva de XP compartida** (`lib/utils/xp.js`): espejo exacto cliente de la fórmula de niveles del servidor (cap 20).
- **Zumbido estilo MSN Messenger en el chat:** botón en la barra de la conversación (`ChatPane`) con cooldown de 10 s; evento Socket.IO `zumbido` que emite a la sala de la conversación y a las salas personales de los participantes. El mensaje especial `⚡ ¡ZUMBIDO!` se renderiza como burbuja animada propia (`MessageBubble`) y suena vía `lib/utils/sound.js` (`/sounds/nudge.mp3`, precalentado tras el primer gesto para sortear las políticas de autoplay).

### Changed
- **Mensajería rediseñada al estilo MSN Messenger:** sidebar de conversaciones rehecha con tarjetas de contacto (`MsnContactCard`), selector de estado personalizado (online/ocupado/aparecer sin conexión + texto libre, persistido en `PUT /api/users/me/status`), búsqueda de contactos y agrupación por estado; composer, burbujas y modales RTC alineados con el nuevo lenguaje visual.
- **Ajustes modularizados** (`refactor(settings)`): `/settings` pasó de una página monolítica a un **hub** con 10 sub-secciones (`profile`, `design`, `algorithm`, `privacy`, `security`, `blocked`, `notifications`, `payments`, `performance`, `data`) con layout compartido (`+layout.server.js` + `settings.css`). Se eliminó la antigua `/settings/activity`.
- **Perfil modular**: `/u/[username]` refactorizado en componentes reutilizables (`ProfileHeaderCard`, `ProfileBlocks`, `ProfileThemeShell`).
- **Leaderboard rediseñado de nuevo**: fondo `ArenaBackdrop` (sustituye a `AuroraPillar`), esqueleto de carga (`LeaderboardSkeleton`), contadores animados (`CountUp`) y modal de subida de nivel (`LevelUpModal`).
- **Tema default corregido (migración `014`)**: `user_settings.theme` solo acepta `light|dark|midnight`; se reconstruyó la tabla y se normalizaron valores legacy `'auto'`.
- **Rediseño UI general** (`ui:`): feed, posts, reels, mensajería, TopBar/SideNav/MobileNav, MediaPlayer (overhaul), MediaLightbox, QuickChatWidget y separación de items en navegación/selects/chats/pickers. Nuevo `QuoteCard` para reposts con cita y `RouteProgress`/`Portal`.
- Tests ampliados a **15 suites / 208 tests** (nuevas: design, settings, gamification, marketplace, appearance, appearance_adversarial, messages_adversarial, moderation_strikes, verifications, voomojis); vitest vuelve a ejecutarse sin errores.
- CI `.github/workflows/sync.yml` limitado a la rama `main` y a cambios de contenido del proyecto.
- **Navegación con View Transitions API** (`+layout.svelte`): crossfade entre rutas con grupos nombrados para el shell; en cruces hacia/desde rutas sin shell (landing, login, admin) la transición se hace root-only para evitar el montaje fragmentado. Las VT encadenadas se saltan (`skipTransition`) para impedir cortes secos y el splash de arranque hereda los tokens del tema activo para fundir sin salto de color.
- **Store de rendimiento ampliado:** luz ambiental reactiva de vídeo (`videoAmbientLight`, glow por fotograma desactivado en lite), ahorro automático con batería baja ≤20% que restaura exactamente los ajustes previos al conectar el cargador, y saneamiento de `localStorage` con lista blanca de valores legítimos (evita estados híbridos de versiones anteriores).

### Fixed
- **Doble barra de búsqueda en `/explore` y `/marketplace`:** el buscador global del TopBar se oculta en las rutas con buscador propio (hero de explore / filtro de la tienda).
- **Migraciones bajo el adaptador libsql:** `scripts/migrate-up.js` no aplicaba migraciones pendientes porque consumía la API async como si fuera síncrona; corregido con `await` en todo el flujo.

## [Unreleased]

_Saldrá como **v0.6.0-beta.2** — hito de beta cerrada (invitaciones, email operativo, despliegue Docker pegar-y-listo)._

### Added (beta cerrada voom.social)
- **Códigos de invitación (migración `019`):** registro por invitación para la beta cerrada. Nueva tabla `invite_codes` (formato `VOOM-XXXX-XXXX`, usos máximos, expiración, activación, nota interna) + `invite_uses` (trazabilidad de qué usuario entró con cada código). Consumo **atómico** con reversión (`lib/server/invites.js`): tolera registros concurrentes con el último cupo. Gate en la rama `register` con parse tolerante de flags; panel **/admin/invites** (generación por lotes, activar/desactivar, copiar, stats) + toggle «Registro Solo con Invitación» en /admin/settings + endpoint público `GET /api/auth/config`. Suite `tests/invites.test.js` (10 tests).
- **Email operativo — verificación y reset de contraseña:** `lib/server/email.js` reescrito a async (el adaptador async de BD lo tenía roto/latente: nadie lo importaba). Nuevos endpoints: `POST /api/auth/forgot-password` (respuesta neutra + cooldown por cuenta), `POST /api/auth/reset-password` (consume token, revoca todas las sesiones), `GET /api/auth/verify-email?token=` (redirige a /login con resultado) y `POST /api/auth/resend-verification` (acepta email o usuario). Enforcement de `email_verification_required` en login (403 con `code: EMAIL_NOT_VERIFIED`); banners de verificación en /login con botón de reenvío; flujo real de recuperación en el modal de ayuda; nueva página `/reset-password`. Las plantillas renderizan enlaces **absolutos** (el origen llega del request). El transporter se invalida al cambiar SMTP en /admin/apis. Suite `tests/email.test.js`.
- **Modo Mantenimiento y Modo Demo enforcement:** nuevo bloque en `hooks.server.js` — con `maintenance_mode` el tráfico no-staff recibe 503 (API) o la nueva página pública `/maintenance` (el panel /admin, salud, login del staff y assets siguen operativos; bypass staff por Bearer o cookie espejo). Con `demo_mode` las mutaciones de no-staff reciben 403 (plataforma de exhibición de solo lectura). Los toggles de /admin/settings ya son editables (el de mantenimiento estaba deshabilitado como «pendiente»).
- **Despliegue Docker pegar-y-listo (voom.social):** Dockerfile rehecho — layout espejo del dev (rootDir correcto en el bundle), CMD sobre `frontend/server.js` para que **Socket.IO vuelva a funcionar en el contenedor**, dependencias de runtime recortadas (`npm ci --omit=dev`), healthcheck sin wget. `docker-entrypoint.sh`: genera y **persiste** JWT_SECRET en el volumen y aplica migraciones solo en upgrades. Rutas env-first: `getUploadsDir()` honra `UPLOAD_DIR`, el instalador respeta `DB_PATH`/`DATA_DIR`/`SCHEMA_PATH` y **stampa `_migrations`** al instalar (sin ello, la primera upgrade re-aplicaría la migración 001 de dialecto Postgres); `migrate-up.js` hace baseline-stamp de BDs preexistentes. Stack `docker-compose.yml` con **Caddy (HTTPS automático)**, `ORIGIN`/`TRUST_PROXY`/`BODY_SIZE_LIMIT` correctos (el default de 512 KB rechazaba los uploads de 50 MB) y servicio opcional de backups diarios (`scripts/backup.sh`, snapshot WAL-safe + uploads, rotación 7). CI `docker-publish.yml` publica `ghcr.io/<owner>/voom` en cada tag. Guía para no avanzados **DEPLOY.md**. `.dockerignore` nuevo.
- **Validación de dimensiones en /api/upload** (REQUERIMIENTOS 1.3): avatar cuadrado ≥100px y portada banner (2:1–8:1, ≥800px) validados server-side con `image-size`; el servidor es fuente de verdad aunque el crop sea client-side.

### Fixed (beta cerrada voom.social)
- **Regresión anti-gaming del feed asida con tests** (veredicto del council): suite nueva que verifica vía endpoint real que el autor NO suma `author_replies_count` con comentarios top-level propios ni auto-respuestas, y que SÍ suma al responder a comentarios de terceros (+ trazabilidad del decremento). Over-fetch de candidatos subido a `min(80, limit*4)` (rango 60-80 que pedía el council).
- **Instalador alineado:** la cuenta admin creada por /api/install ahora es `super_admin` (igual que /api/setup, era `admin` sin permisos completos en el panel multi-rol) y nace con `email_verified=1`; los flags se escriben como `'1'/'0'` (antes `'true'/'false'` — inconsistencia con el resto de lectores).
- **Mensajería móvil:** `.chat-pane` en ≤768px pasa a overlay absoluto (`inset:0`) que se desliza ENCIMA de la sidebar — cierra el pendiente de la pasada de fixes (el deslizamiento por transform con retención de layout empujaba el panel fuera de pantalla).
- **CustomSelect:** `backdrop-filter` migrado al token `--glass-blur` (respetaba perfiles lite/subtle al abrir el dropdown; antes usaba blur(18px) hardcoded).

### Changed (beta cerrada voom.social)
- **Página /reset-password y /maintenance:** nuevas rutas públicas sin shell, registradas en `SHELLLESS_ROUTES`/`publicExact` del layout raíz (VT root-only en cruces).
- **TwemojiPicker:** buscador con keywords ES/EN + renderizado por lotes («Ver más», 64 por página) — reduce los nodos DOM iniciales de cada picker (feed/chat/lightbox montan varios a la vez).
- **Like:** press del botón de like más profundo y rápido (`scale(0.82)`, 90 ms) según REQUERIMIENTOS 2.3.

## [0.6.0-beta.1] - 2026-08-16

### Added
- **Identidades Anónimas y Publicaciones Anónimas:** soporte completo para identidades anónimas persistentes y exclusivas, protección estricta de privacidad y flags de anonimato en publicaciones.
- **Mejoras del Algoritmo de Feed y Reputación de Autores:** motor de reputación de autores, mitigación heurística de bots/spam, escritor de lotes en memoria (*In-Memory Batch Writer*) y sub-caps de popularidad.
- **Sistema de Reposts y Shares:** funcionalidad de republicaciones y citas con conteo optimizado en tiempo real.
- **Custom Assets & Emojis Clásicos:** soporte para activos personalizados por rol y catálogo ampliado de emoticonos retro estilo MSN.
- **Flujo de Verificaciones de Creadores y VTubers:** workflow administrativo para aprobación/rechazo de insignias de verificación y control de strikes de moderación.

## [0.5] - 2026-07-23

### Added
- **Sistema de Moods (estados de ánimo) en posts:** el creador de publicaciones (`/posts/create`) incluye un carrusel de 10 moods (Feliz, Creativo, Jugando, Música, Pensando, Emocionado, Viajando, Celebrando, Trabajando, Comiendo) que se persiste en la columna `posts.mood` (VARCHAR(30)) y se muestra en el feed. El carrusel usa física de *drag-to-scroll* con inercia, *overscroll* elástico y *edge fading*, replicando el comportamiento del carrusel de la landing.
- **Encuestas (polls) en posts:** el creador permite añadir una pregunta con 2-6 opciones y duración (1h / 6h / 24h / 3 días / 7 días). La encuesta se serializa como JSON en un bloque `\n[METADATA]` al final del `body` del post. Votación vía `POST /api/posts/:id/vote` (un voto por usuario, registrado en `voted_user_ids`). `PostCard.svelte` renderiza el widget con barras de porcentaje, total de votos y confirmación "Voto registrado".
- **Reescritura completa de `/stories/create`:** la página pasó de mockup no funcional a plenamente operativa — *drag & drop* de archivos, historias de solo texto (caption + fondo de color + tipografía), previsualización en vivo dentro de un marco de teléfono, texto arrastrable con alineación, colores de fondo/texto y cinco familias tipográficas, mapeo real a la API de stories.
- **Unificación del reproductor multimedia (`MediaPlayer.svelte`):** se eliminó la dependencia de Vidstack y se reemplazó el `<video>` nativo del navegador por el `MediaPlayer` propio de la plataforma en todas las páginas de creación (`stories/create`, `reels/create`) y en el feed. Reproductor con PiP, *Picture-in-Picture*, velocidades, atajos de teclado, *autoplay* al entrar en viewport y *media session* del SO. La versión mostrada en su panel "Acerca de" ahora refleja la versión del proyecto.
- **Página de Licencia y Protección independiente:** se trasladó la licencia a una página HTML estática autocontenida en `/docs/license.html` con diseño Glassmorphism 2.0; la ruta SvelteKit anterior quedó retirada. El *service worker* excluye los HTML de documentación de la caché para evitar versiones stale.
- **Cumplimiento RGPD (UE):** páginas legales públicas `/privacy` `/terms` `/cookies` (en `publicRoutes` del layout, enlaces en footer, login y registro); banner de consentimiento de cookies (`CookieBanner.svelte`) con elección en `localStorage` + cookie `vsocial_cookie_consent` (`Secure; SameSite=Strict`); registro con consentimiento obligatorio de Términos + Privacidad + age gate 13+ (sellado con `terms_accepted_at` / `privacy_accepted_at`, validación autoritativa en servidor); borrado de cuenta self-service (`POST /api/users/delete-account`, confirmación con contraseña) → soft-delete + cierre de sesiones, reactivación al login dentro de 30 días; exportación de datos (portabilidad, art. 20 RGPD) vía `GET /api/users/export` → JSON descargable; pestaña "Mis Datos" en Ajustes; migración `003_gdpr.sql`; cron diario de erasure que hard-deletea en cascada los usuarios con `deleted_at` > 30 días y limpia ficheros huérfanos.
- **Leaderboard rediseñado (rama `feature/leaderboard-redesign`):** podio top-3 (`PodiumCard`), filas para el resto (`LeaderboardRow`), pestañas entre tipos de ranking (`LeaderboardTabs`), tarjeta del usuario actual (`CurrentUserCard`) y caché en cliente para transiciones instantáneas. Nuevos componentes: `AuroraPillar`, `LeaderboardTabs`, `LeaderboardRow`, `CurrentUserCard`.
- **CI de GitHub Actions (`.github/workflows/ci.yml`):** job `lint-and-build` que corre `npm run lint` + `npm run build` en Node 22 sobre cada push/PR a `main`, con cancelación de runs obsoletos y subida del artifact `build/`. El job de tests queda deshabilitado hasta arreglar el entorno de test (vitest roto + better-sqlite3 no instalado).

### Changed
- `eslint.config.js` reubicado de la raíz del repo a `frontend/` (sus dependencias viven en `frontend/node_modules`); ahora ESLint carga correctamente. Config actualizado para reconocer las runas de Svelte 5 (`$state`, `$derived`, etc.) en los módulos `*.svelte.js` y afinar reglas (`no-unused-vars` con prefijo `_`, `allowEmptyCatch`, `svelte/no-at-html-tags` off por saneamiento DOMPurify server-side). `.prettierignore` ampliado (`style_dump.css`, scripts de debug ad-hoc).
- Flag `Secure` añadido a la cookie del token de auth (`auth.svelte.js`).
- **Versión del proyecto bumpada de `0.0.2` a `0.5`** en `frontend/package.json`, `frontend/src/routes/api/health/+server.js`, el panel "Acerca de" del `MediaPlayer` y la cabecera del portal de documentación, alineando el código con la convención de releases (`voom-vX.Y.zip`).
- Eliminadas las menciones a criptomonedas de la landing; eliminadas dependencias de Redis y PostgreSQL para reforzar la arquitectura pura SQLite; badges de gamificación rediseñadas a Glassmorphism 2.0; feeds transparentes movidos del roadmap a características implementadas (tres algoritmos: Radar en Vivo cronológico global, Feed Inteligente personalizado, Descubrimiento por tendencia/frescura).

### Fixed
- Lint del proyecto: estaba completamente roto (ESLint no podía cargar el config por resolución de módulos). Corregido + limpiados ~200 errores preexistentes (imports no usados, variables muertas, a11y, catch vacíos). `npm run lint` pasa limpio (exit 0).
- Bugs reales que el lint recién funcionando sacó a la luz: `ReportModal.svelte` y `CommentItem.svelte` usaban transiciones (`fade`/`scale`/`backOut`/`expoOut`) sin importarlas; `QuickChatWidget.svelte` llamaba a `handleReact` inexistente (ahora implementada con toggle optimista + `messagesApi.react`).
- Enlaces "Términos"/"Privacidad" de login y registro que apuntaban a `/` (rotos) → ahora a `/terms` y `/privacy`.
- **Recorte de vídeo en el feed:** se eliminó el `aspect-ratio` forzado y se envolvió el vídeo en un contenedor 16:9 con `object-fit: contain`, de modo que el `MediaPlayer` se auto-dimensione a sus proporciones nativas sin recortar.
- **Creador de posts (`/posts/create`):** *overhaul* de Glassmorphism 2.0 con corrección de bugs severos de flex-squash, recorte del picker de emojis y refuerzo de los escudos volumétricos anti-colapso WebKit/Blink; recorte duro de las *mood pills* resuelto moviendo la máscara CSS al contenedor padre estático; las flechas de navegación del mood scroller se reemplazaron por la física de *drag-scroll* con inercia de la landing.
- Espacios irregulares U+2001 en varios títulos/etiquetas.

## [0.0.2] - 2026-06-22

### Added
- Initial release of Voom!, a full-stack social network application.
- User authentication (JWT, local and OAuth), registration, and profile management.
- Core social features: posts, comments, likes, stories, reels, and follows.
- Real-time messaging (DMs and group chats) with media and voice notes.
- Marketplace for buying and selling with category listings.
- Gigs / Freelance board for posting and applying to commissions.
- Groups and Pages functionality with events.
- Wallet and transaction system for in-app monetization.
- Notifications system with push support and read receipts.
- Admin panel and moderation tools (reports, user management).
- Structured logging with Pino.
- Database migration system (`_migrations` table) for versioned schema updates.
- Basic security module (rate limiting, input sanitization, validation).
- Health check endpoint at `/api/health`.
- Unit tests setup using Vitest for core utilities and database connectivity.
- Docker and docker-compose configuration for containerized deployment.
- CI/CD hooks with pre-commit linting and build verification.
- `.env.example` with comprehensive production configuration.
