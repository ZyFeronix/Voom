# Voom! — frontend

Aplicación SvelteKit 5 (SSR + CSR) de Voom!. Toda la app vive aquí: rutas de
páginas, API catch-all (`src/routes/api/**`), middleware global
(`src/hooks.server.js`) y módulos de servidor (`src/lib/server/`).

> Documentación completa del proyecto: [`../DOCS.md`](../DOCS.md),
> [`../ARCHITECTURE.md`](../ARCHITECTURE.md) y [`../README.md`](../README.md).

## Comandos

```bash
npm install          # instalar dependencias
npm run dev          # servidor de desarrollo → http://localhost:5173 (Socket.IO via plugin Vite)
npm run build        # build de producción (adapter-node → build/)
npm start            # servidor de producción: node server.js (build/ + Socket.IO en :3000)
npm run lint         # prettier --check . && eslint .
npm run format       # prettier --write . && eslint --fix .
npm run test         # vitest run (las suites viven en ../tests/, gitignored)
npm run test:watch   # vitest en modo watch
```

Migraciones y seed se ejecutan desde la raíz del repo:

```bash
node scripts/migrate-up.js        # aplicar migraciones pendientes
node scripts/migrate-down.js [N]  # revertir últimas N migraciones
node scripts/seed.js              # sembrar system_settings + marketplace_categories
```

## Notas

- Runes de Svelte 5 forzados para todo el código (`svelte.config.js`); los
  stores compartidos son módulos `*.svelte.js` en `src/lib/stores/`.
- Sin ORM: SQL puro con prepared statements sobre el adaptador async de
  `src/lib/server/db.js` (`@libsql/client` con fallback `better-sqlite3`).
- El hook `pre-commit` de Husky ejecuta `npm run lint` y `npm run build`;
  ambos deben pasar para poder commitear.
