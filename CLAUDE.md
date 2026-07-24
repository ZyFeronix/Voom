# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VSocial — a full-stack social network (posts, reels, stories, messaging, marketplace, gigs, groups, wallet, gamification, admin panel) built with SvelteKit 5. Docs and code comments are primarily in Spanish; match the existing language when editing a file.

The `.ai-codex/` index referenced by older tooling is currently empty — explore the actual source instead.

## Commands

All app commands run from the `frontend/` directory:

```bash
cd frontend
npm install          # install deps
npm run dev          # Vite dev server → http://localhost:5173 (Socket.IO attaches via vite plugin)
npm run build        # production build (adapter-node → build/)
npm start            # production server: node server.js (serves build/ + Socket.IO on :3000)
npm run lint         # prettier --check . && eslint .
npm run format       # prettier --write . && eslint --fix .
npm run test         # vitest run
npm run test:watch   # vitest
```

Migrations and seeding run from the repo root:

```bash
node scripts/migrate-up.js        # apply pending migrations/*.sql (tracked in _migrations table)
node scripts/migrate-down.js [N]  # revert last N migrations
node scripts/seed.js              # seed system_settings + marketplace_categories
```

Tests live in the repo-root `tests/` directory and import from `../frontend/src/...`. There is a single suite (`tests/auth.test.js`). Run a single test with `npx vitest run tests/auth.test.js` or filter by name with `-t "<name>"`.

The Husky `pre-commit` hook runs `npm run lint` and `npm run build` inside `frontend/` — both must pass to commit.

## Architecture

### Universal DB adapter — everything is async
`frontend/src/lib/server/db.js` auto-detects the driver at boot: `@libsql/client` (preferred, supports local WAL + remote Turso) with a `better-sqlite3` fallback. Both are wrapped into one **async** API: `db.prepare(sql).run(...args) / .get(...args) / .all(...args)` all return Promises. Always `await` DB calls even though better-sqlite3 is synchronous underneath. No ORM — write raw SQL with `?` placeholders and prepared statements. `getDb()` returns the shared handle; `getUploadsDir(sub)` resolves the repo-root `uploads/` folder.

Canonical schema is `schema_sqlite.sql` at the repo root. The SQLite DB file (`database.sqlite`) also lives at the root, with WAL/SHM sidecars.

### API routing — catch-all with internal dispatch
API endpoints are **not** one-file-per-route. Each module is a single catch-all handler at `frontend/src/routes/api/<module>/[...path]/+server.js` (or `[action]` for auth). The handler exports `GET/POST/PUT/DELETE`, splits `params.path` on `/`, and dispatches internally by segment count and keywords. Example: `api/posts/[...path]/+server.js` handles `/api/posts/:id`, `/api/posts/:id/like`, `/api/posts/:id/comments/:commentId`, etc. When adding an endpoint, extend the path-parsing logic inside the existing handler rather than creating a new route file. The header comment block in each handler is the source of truth for its sub-routes.

### Auth — JWT + DB-backed sessions
`requireAuth(request)` / `optionalAuth(request)` (`lib/server/auth.js`) are the endpoint guards: they extract the Bearer token, verify the JWT (`lib/server/jwt.js`), then confirm a matching `user_sessions` row (token stored as SHA-256 hash) that hasn't expired. `requireAuth` throws SvelteKit `error(401)`; `optionalAuth` returns `null`. The client sends the token from `localStorage` (`vsocial_token`) via `lib/api.js` (the token is NOT in an httpOnly cookie — `lib/api.js` reads it from localStorage and sends it as a Bearer header; a non-httpOnly client-side cookie mirror exists with `Secure; SameSite=Strict`). Roles resolve as `COALESCE(user_roles.role, users.role, 'user')` — this effective-role pattern recurs across queries. The login handler reactivates soft-deleted accounts (RGPD 30-day window) after verifying the password — see `deleted_at` handling in the login branch.

### RGPD compliance — self-service data-subject rights
Implemented across migrations + backend + frontend (verified end-to-end). Schema migration `003_gdpr.sql` (+ mirrored in `schema_sqlite.sql`) adds `users.deleted_at`, `terms_accepted_at`, `privacy_accepted_at` (`birth_date` already existed). Legal pages `/privacy`, `/terms`, `/cookies` are public routes. Registration captures consent + age gate 13+ (server is source of truth). `POST /api/users/delete-account` (password-confirmed) soft-deletes + purges sessions; login reactivates within 30d. `GET /api/users/export` returns downloadable JSON of the user's data (omits `password_hash` and OAuth tokens). A daily cron in `hooks.server.js` hard-deletes past-30d users + cleans orphaned upload files. UI: `CookieBanner.svelte` + the "Mis Datos" tab in `settings/+page.svelte`. See [[rgpd-compliance]] memory for the migration-apply gotcha and out-of-scope items.

### Global middleware — `frontend/src/hooks.server.js`
`handle` runs on every request and layers, in order: in-memory sliding-window rate limiter (150 req/min per IP, bypassed for staff roles via JWT), strict Origin/Referer CSRF guard on mutating methods, security response headers (HSTS, X-Frame-Options DENY, etc.), first-request cron startup, and a setup-wizard guard that redirects to `/setup` (no users) or `/install` (no tables). `handleError` maps DB errors to generic 500s without leaking internals. DB is initialized once at module load via `initDb()`.

### Background crons — in-process `setInterval`
`startCrons()` (in `hooks.server.js`, started on first request) runs: scheduled-post publisher (60s), "un día como hoy" memories (checks for 00:01), expired stories cleanup (5min), expired snooze cleanup (1h), rate-limiter GC (2min), and GDPR erasure (24h — hard-deletes via `ON DELETE CASCADE` users soft-deleted >30 days ago and removes their orphaned avatar/cover files). These are plain intervals in the Node process — no external scheduler.

### Real-time
Socket.IO (chat, typing, presence) is attached to the underlying HTTP server both in dev (`socket-plugin.js` via Vite `configureServer`) and prod (`server.js` via `initSocketIO`); logic in `lib/server/socket.js`. Notifications also use SSE, and calls use WebRTC (`lib/rtc.js`).

### State — Svelte 5 runes only
Runes mode is forced for all non-`node_modules` files (`svelte.config.js`). Use `$state`, `$derived`, `$props`. Shared client state lives in `lib/stores/*.svelte.js` (auth, notifications, theme, ui) — these are rune-based modules, not classic Svelte stores. Several UIs use optimistic updates (mutate the store, then fire the API).

### Server lib modules (`frontend/src/lib/server/`)
`activity` (activity log), `cache`, `email` (Nodemailer), `entities` (XSS-safe `#hashtag`/`@mention`/URL → `<a>` parsing), `gamification` (`awardXP` etc.), `logger` (Pino), `oauth` (Google/Apple), `security` (validators + `sanitizeInput`).

## Conventions
- Prettier uses tabs (see existing files); ESLint config is `frontend/eslint.config.js`.
- Production build strips all `console.*` and `debugger` via Terser — don't rely on console output in prod.
- Uploads are served from the repo-root `uploads/` dir; Vite `fs.allow: ['..']` permits serving it in dev.
- The repo root has many one-off maintenance scripts (`fix_css.mjs`, `apply_prismatic.py`, `clone_exact.mjs`, `_auth_migration_backup/`, etc.). These are ad-hoc tooling, not part of the app runtime — ignore them unless a task explicitly targets them.
