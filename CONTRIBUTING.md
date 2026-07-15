# Contributing to VSocial

Thanks for your interest in contributing to VSocial. This document outlines the
rules, conventions, and workflow for submitting changes.

---

## Code of Conduct

- Be respectful, constructive, and professional.
- No toxicity, no gatekeeping, no bikeshedding.
- Critique ideas, not people.

---

## Project Philosophy (Read Before Coding)

VSocial has strong architectural convictions documented in:
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — design decisions and ideology
- [`DOCS.md`](./DOCS.md) — complete technical reference
- [`Personality & SOUL.md`](./Personality & SOUL.md) — engineering standards

Key principles you must respect:

| Principle | What it means |
|-----------|---------------|
| **Raw SQL only** | No ORMs. Every query is prepared SQL in `+server.js` or `$lib/server/`. |
| **Svelte 5 Runes** | `$state`, `$derived`, `$props` for reactivity. Traditional stores only for complex global state. |
| **libSQL-first** | DB adapter in `db.js` prefers `@libsql/client`. `better-sqlite3` is fallback only. |
| **Glassmorphism 2.0** | Use tokenized design system. No arbitrary colors, no raw hex values. |
| **Deploy-ready always** | No `// TODO`, no stubs, no half-implemented features. PR is production code. |
| **Security by default** | Every input validated. Every endpoint rate-limited or auth-gated. Prepared statements always. |

---

## Development Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd vsocial/frontend
npm install

# 2. Configure environment
cd ..
cp .env.example .env
# edit .env — at minimum set JWT_SECRET

# 3. Seed database (optional but recommended)
node scripts/seed.js

# 4. Start dev server
cd frontend
npm run dev
```

---

## Branch Strategy

- `main` — production-ready code. Protected.
- Feature branches: `feature/<name>` or `fix/<name>`.
- No direct commits to `main`. Always via PR.

---

## Commit Convention

```
<type>(<scope>): <subject>

[optional body]
```

Types: `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `chore`, `perf`

Scopes: `auth`, `feed`, `posts`, `reels`, `stories`, `marketplace`, `messages`,
`notifications`, `wallet`, `gigs`, `admin`, `groups`, `pages`, `db`, `ui`, 
`security`, `api`, `gamification`, `docs`, `deps`

Examples:
```
feat(feed): add intelligent ranking with cursor-based pagination
fix(notifications): prevent undefined actor link crash
docs(docs): add API endpoint reference section
perf(db): add composite index on posts(user_id, created_at)
```

---

## Code Conventions

### SvelteKit Routes

- Pages: `src/routes/<path>/+page.svelte`
- API: `src/routes/api/<path>/+server.js`
- Catch-all APIs use `[...path]/+server.js` pattern.
- Export named functions (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`).

### Database

- Schema changes go into `schema_sqlite.sql` (idempotent, `CREATE TABLE IF NOT EXISTS`).
- Non-destructive migrations go into `migrations/<NNN>_<description>.sql`.
- Rollback scripts go into `migrations/<NNN>_<description>.down.sql`.
- Never concatenate strings into SQL. Always prepared statements:
  ```js
  db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  ```

### Components

- File: `src/lib/components/<Name>.svelte`
- Use runes for internal state.
- Accept `$props()` for public API.
- Use `class:` directive for conditional Tailwind classes.
- Dynamic class names must be in Tailwind safelist OR use inline styles.

### Stores

- File: `src/lib/stores/<name>.svelte.js`
- Export reactive state with runes.
- Export action functions that mutate state AND call API.

### Server Modules

- File: `src/lib/server/<name>.js`
- Functions are async (compatible with libSQL wrapper).
- Import `getDb()` from `$lib/server/db.js`.
- Never call `initDb()` directly — it's handled by `hooks.server.js`.

---

## Testing

```bash
cd frontend
npm run test        # run all tests
npm run test:watch  # watch mode
```

- Unit tests for server modules and utilities.
- Integration tests for API endpoints.
- Current test file: `tests/auth.test.js` (security validators + DB connectivity).
- Add tests in `tests/` with `.test.js` extension.

---

## Linting & Formatting

Before submitting a PR:

```bash
cd frontend
npm run format   # prettier --write + eslint --fix
npm run lint     # verify everything passes
```

Husky pre-commit hooks will also run lint checks automatically.

---

## Pull Request Checklist

- [ ] Code follows project conventions (Runes, Raw SQL, Glassmorphism tokens).
- [ ] No `// TODO`, no commented-out code, no debug logs.
- [ ] Security reviewed: inputs validated, SQL parameterized, auth checked.
- [ ] Performance considered: DB queries indexed, pagination cursor-based.
- [ ] `npm run lint` passes cleanly.
- [ ] `npm run test` passes cleanly.
- [ ] Schema changes are in `schema_sqlite.sql` (idempotent).
- [ ] New migrations have corresponding `.down.sql` rollback.
- [ ] PR description explains WHAT, WHY, and HOW to test.

---

## Where to Start

Good first contributions:

1. **Add tests** — coverage is minimal. Add Vitest tests for API endpoints and DB queries.
2. **Improve error handling** — many endpoints have basic try/catch. Add structured error responses.
3. **Document API** — add OpenAPI/Swagger annotations or a dedicated API reference.
4. **Testing** – `tests/auth.test.js` exists. Need more Vitest unit tests and Playwright E2E for critical flows (messaging, reels).
6. **Email templates** — improve verification and password reset email HTML.

---

## Questions?

Open an issue or discuss in the repository. For architectural decisions,
consult [`ARCHITECTURE.md`](./ARCHITECTURE.md) first.