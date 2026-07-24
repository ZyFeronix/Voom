# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [RELEASED]

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
- **Versión del proyecto bumpada de `0.0.2` a `0.5`** en `frontend/package.json`, `frontend/src/routes/api/health/+server.js`, el panel "Acerca de" del `MediaPlayer` y la cabecera del portal de documentación, alineando el código con la convención de releases (`vsocial-vX.Y.zip`).
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
- Initial release of VSocial, a full-stack social network application.
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
