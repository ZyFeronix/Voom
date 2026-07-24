# Guía de empaquetado de releases (.zip) — VSocial

> Guilla de referencia para agentes de IA (y humanos) sobre cómo generar un `.zip`
> de release **limpio, listo para instalar desde cero** y publicar en GitHub.
> Última release generada con este proceso: **v0.5** (`vsocial-v0.5.zip`, ~575 KB).
> Idioma: español, igual que el resto del proyecto.

## 0. El contrato que debe cumplir cada .zip

El usuario final (no avanzado) descarga el `.zip`, lo descomprime en una carpeta
cualquiera, ejecuta `start.bat` (o `cd frontend && npm install && npm run dev`) y,
al abrir `http://localhost:3000` en el navegador, es **redirigido a su propia
instancia `/install`** para levantar la plataforma desde cero.

Implicaciones obligatorias:

- **NO** se incluye `database.sqlite` (ni `-wal`/`-shm`/`.bak`), **NO** `install.lock`,
  **NO** `.env`. El instalador los genera durante `/install`.
- **SÍ** se incluye `schema_sqlite.sql` en la raíz: el instalador
  (`frontend/src/routes/api/install/+server.js`) y `db.js` lo leen directamente
  con `readFileSync` para crear todas las tablas + los datos por defecto
  (categorías del marketplace, `system_settings`).
- El servidor **debe poder bootear sin `.env` ni BD**: `db.js` crea un
  `database.sqlite` vacío vía `@libsql/client`; el guard de instalación
  (`hooks.server.js`, bloque "Setup Wizard Guard") detecta `no such table` y
  redirige a `/install`. Los errores `no such table: users` / `system_settings`
  en el log de arranque **son normales antes de instalar** (están envueltos en
  `try/catch`); no detienen el servidor.

## 1. Estructura del .zip

Al descomprimir debe quedar **una única carpeta superior** `vsocial/` que contenga:

### Raíz (`vsocial/`) — archivos IN
```
schema_sqlite.sql      ← REQUERIDO en runtime (instalador + db.js)
start.bat              ← launcher de desarrollo
.gitignore  .gitattributes  .env.example
LICENSE  README.md  CONTRIBUTING.md  CHANGELOG.md  ARCHITECTURE.md  DOCS.md
nginx.conf  Dockerfile  docker-compose.yml
migrations/            ← 001_schema.sql, 002_phase2.sql, 003_gdpr.sql (tooling opcional)
scripts/               ← build_docs.js, migrate-up.js, migrate-down.js, seed.js
.husky/                ← pre-commit (útil para quienes clonen el repo)
```

### `frontend/` — archivos IN (el resto del árbol de la app)
- Todo `frontend/src/` (routes, lib, app.html, hooks.server.js, service-worker.js).
- `frontend/static/` (favicon, logo, manifest, robots, LICENSE.txt, **docs/** ya generado).
- Configs: `package.json`, `package-lock.json`, `.npmrc`, `.prettierrc`,
  `.prettierignore`, `.gitignore`, `jsconfig.json`, `svelte.config.js`,
  `vite.config.js`, `README.md`, `server.js`.

## 2. Lista de exclusión (lo que NUNCA va en el .zip)

### Datos de desarrollo / estado instalado
`database.sqlite`, `database.sqlite-shm`, `database.sqlite-wal`,
`database.sqlite*.bak.*`, `install.lock`, `.env`, cualquier `tmp_*.sqlite*`.

### Archivos de agentes IA / herramientas (uso interno, no del proyecto)
`Personality & SOUL.md`, `.agents/`, `.ai-codex/`, `.claude/`, `.codegraph/`,
`.opencode/`, `.qoder/`, `opencode.jsonc`.

### Scaffold raíz muerto (la app real vive en frontend/, nada los referencia)
`vite.config.js` (raíz — frontend tiene el suyo propio y autocontenido),
`tsconfig.json` (raíz — frontend usa `jsconfig.json`),
`package.json` + `package-lock.json` (raíz — solo dependen de `ai-codex`),
`node_modules/` (raíz).

### Scripts de mantenimiento one-off (raíz) — no son runtime
`alter_db.js`, `check_db.js`, `update_db.js`, `debug_db.js`,
`setup_customizations.js`, `test_install.mjs`, `test_imports.mjs`,
`apply_prismatic.py`, `refactor.py`, `evolve_css.mjs`, `fix_css.mjs`,
`force_dark.mjs`, `refactor_css.mjs`, `restore_css.mjs`, `clean_legacy.sh`
(¡destructivo!), `clone_exact.mjs`.

### Basura dentro de `frontend/` (junto al código fuente)
`fix.js`, `fix.cjs`, `fix-params.js`, `fix-params.cjs`, `fix_footer_and_creators.cjs`,
`fix_glass.mjs`, `fix_reels_comments_count.mjs`, `migrate.cjs`, `migrate-async.mjs`,
`patch_stories.cjs`, `cleanup_warnings.mjs`, `cleanup_warnings2.mjs`,
`run_cleanup.mjs`, `debug-explore.js`, `test_admin.mjs`, `test_db.mjs`,
`test_klipy.mjs`, `check_db.cjs`, `update_db.cjs`, `setup_customizations.mjs`,
`setup_customizations_libsql.mjs`, `style_dump.css`, `report.json`, `report2.json`,
`report3.json`, `tmp_*.sqlite*`, `uploads/` (dir vacío; se autocrea).

### Otros
`_auth_migration_backup/`, `temp_svelte_video_player/`, `docs-web/` (scaffold vacío),
`tests/` (Vitest solo de desarrollo), el `.zip` anterior.

> **Regla de oro antes de comprimir:** si una carpeta/archivo no existe en la
> lista IN de §1 y tampoco es runtime del instalador, va fuera.

## 3. Bugs a revisar antes de cada release

Estos dos se encontraron armando v0.5. Volver a verificarlos en cada compilación:

1. **`frontend/src/routes/api/install/+server.js`** — la línea del `import` desde
   `$lib/server/db.js` debe incluir **`initDb`**, porque el POST llama
   `await initDb()` para reinicializar la conexión del servidor en vivo tras
   `closeDb()`. Si falta, el POST devuelve `500 "Error Interno: initDb is not
   defined"` y el servidor queda inutilizable hasta reiniciar manualmente.
   Estado correcto:
   ```js
   import { initDb, closeDb, getDriverInfo } from '$lib/server/db.js';
   ```

2. **`frontend/.prettierrc`** — **no** debe listar `prettier-plugin-tailwindcss`
   ni `tailwindStylesheet`. Ese paquete no está en `package.json` ni instalado,
   y no hay Tailwind en el proyecto. Si está, `npm run lint` (y el hook
   `pre-commit` de Husky) crasheaan en una instalación limpia con
   `Cannot find package 'prettier-plugin-tailwindcss'`. Dejar solo
   `prettier-plugin-svelte` (que sí es dependencia declarada).

> Nota sobre `npm run lint`: aunque esos dos bugs estén resueltos, el lint del
> proyecto hoy **no sale totalmente verde** por dos problemas preexistentes
> ajenos al empaquetado: (a) `<style>{customCss}</style>` en
> `src/routes/settings/design/+page.svelte` que prettier no parsea como CSS, y
> (b) ~114 archivos con style-drift. Ambos ocurren igual en el repo original.
> No bloquean el arranque ni la instalación; tratarlos es trabajo aparte.

## 4. Procedimiento de compilación (Windows, sin `zip` en PATH)

No hay `zip` en el PATH de Git Bash. Se usa PowerShell (`powershell.exe` o
`pwsh`). El flujo es: **staging limpio → Compress-Archive → limpiar staging**.

### 4.1 Crear el árbol de staging
Crear `D:\Vsocial\.dist-stage\vsocial\` y copiar dentro los IN de §1 aplicando
las exclusiones de §2. Para `frontend/` lo más fiable es `robocopy` con `/XD`
(excluir dirs) y `/XF` (excluir archivos), porque respeta los patrones.

Ejemplo esquemático (adaptar a la lista exacta de §1/§2):
```powershell
$ErrorActionPreference = 'Stop'
$root='D:\Vsocial'; $stage=Join-Path $root '.dist-stage'; $target=Join-Path $stage 'vsocial'
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force -Path $target | Out-Null

# Raíz: archivos IN (uno por uno, explícito)
$rootFiles = 'schema_sqlite.sql','start.bat','.gitignore',
 '.gitattributes','.env.example','LICENSE','README.md','CONTRIBUTING.md',
 'CHANGELOG.md','ARCHITECTURE.md','DOCS.md','nginx.conf','Dockerfile','docker-compose.yml'
foreach ($f in $rootFiles) { Copy-Item (Join-Path $root $f) $target -Force }

# Raíz: dirs IN (árboles completos)
Copy-Item -Recurse -Force (Join-Path $root 'migrations') (Join-Path $target 'migrations')
Copy-Item -Recurse -Force (Join-Path $root 'scripts')    (Join-Path $target 'scripts')
Copy-Item -Recurse -Force (Join-Path $root '.husky')     (Join-Path $target '.husky')

# frontend/ con robocopy + exclusiones
$feSrc=Join-Path $root 'frontend'; $feDest=Join-Path $target 'frontend'
$rc = @($feSrc,$feDest,'/E','/NFL','/NDL','/NJH','/NJS','/NP','/R:1','/W:1')
$rc += '/XD'; $rc += (Join-Path $feSrc 'node_modules'),(Join-Path $feSrc 'build'),
                   (Join-Path $feSrc '.svelte-kit'),(Join-Path $feSrc 'uploads')
$rc += '/XF'; $rc += 'fix.js','fix.cjs','fix-params.js','fix-params.cjs',
  'fix_footer_and_creators.cjs','fix_glass.mjs','fix_reels_comments_count.mjs',
  'migrate.cjs','migrate-async.mjs','patch_stories.cjs',
  'cleanup_warnings.mjs','cleanup_warnings2.mjs','run_cleanup.mjs',
  'debug-explore.js','test_admin.mjs','test_db.mjs','test_klipy.mjs',
  'check_db.cjs','update_db.cjs','setup_customizations.mjs',
  'setup_customizations_libsql.mjs','style_dump.css',
  'report.json','report2.json','report3.json',
  'tmp_copy.sqlite','tmp_copy.sqlite-shm','tmp_copy.sqlite-wal',
  'tmp_diff.sqlite','tmp_idem2.sqlite','tmp_verify2.sqlite'
& robocopy @rc | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed: $LASTEXITCODE" }
# robocopy código < 8 = éxito. Quitar frontend/scripts si quedó vacío.
```

**Trampa conocida:** `robocopy` arrastra directorios ocultos como `.vscode`
que no están en la lista de exclusión. Después de copiar, revisar con
`find .dist-stage/vsocial -maxdepth 3 -name '.*'` y borrar cualquier dotdir
no deseado (`.vscode`, etc.). Los dotfiles **deseados** en `frontend/` son:
`.gitignore`, `.npmrc`, `.prettierignore`, `.prettierrc`.

### 4.2 Comprimir y limpiar staging
```powershell
$zipOut = Join-Path $root 'vsocial-vX.Y.zip'
if (Test-Path $zipOut) { Remove-Item -Force $zipOut }
Compress-Archive -Path (Join-Path $stage 'vsocial') -DestinationPath $zipOut -CompressionLevel Optimal
Remove-Item -Recurse -Force $stage
```
El `.zip` final va a la **raíz del repo** y se llama `vsocial-vX.Y.zip`
(sobrescribe cualquier draft previo).

### 4.3 Invocación desde Git Bash
`powershell.exe` (Windows PowerShell v1) suele estar accesible; `pwsh` a veces
da "Permission denied" desde bash. Guardar el script en un archivo `.ps1` y:
```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w /tmp/mi_script.ps1)"
```

## 5. Verificación obligatoria (sin tocar el repo en vivo)

Extraer el `.zip` a un dir de prueba (p.ej. `.dist-test`) y validar:

1. **Sanity del archivo** — una sola carpeta superior `vsocial/`; presentes los
   archivos IN de §1; ausentes todos los de §2; confirmar que las dos correcciones
   de §3 están aplicadas en el extraído.
2. **`npm install`** dentro de `vsocial/frontend` (debe terminar sin errores de
   resolución; ~432 paquetes).
3. **`npm run lint`** — confirma que **no** aparezca el crash
   `Cannot find package 'prettier-plugin-tailwindcss'` (valida el fix de
   `.prettierrc`). Los errores `{customCss}` y style-drift de §3 son esperados
   y no son del empaquetado.
4. **Booteo limpio** — con el dir de prueba en estado *fresh* (sin `.env`,
   `database.sqlite` ni `install.lock`): `npm run dev -- --port <libre> --host`.
   `GET /` debe responder **302 → `/install`**. `GET /api/install` debe devolver
   `{"installed":false, ... "node_ok":true, "sqlite_ok":true}`.
5. **Instalación real (valida el fix de `initDb`)** — `POST /api/install` con
   `{site_name, admin_email, admin_password}` (path exacto `/api/install`; el
   `action` se deriva del último segmento del pathname). Debe responder
   `{"success":true,...}` **y no** `500 "initDb is not defined"`. Tras eso:
   se crean `install.lock` + `.env` (con `JWT_SECRET` aleatorio) +
   `database.sqlite`; `GET /` pasa a **200** (ya hay admin, el servidor sigue
   vivo); el login del admin (`POST /api/auth/login`) devuelve un JWT; las
   categorías del marketplace sembradas aparecen (`GET /api/marketplace/categories`).
6. **Limpieza** — detener el dev server, borrar `.dist-test` (ojo: a veces un
   worker de vite/node retiene el dir y hay que matar `node.exe` por
   `CommandLine -match 'dist-test'` antes de poder borrarlo).

## 6. Notas de versionado

- Desde la release **v0.5** el número del `.zip` (`vsocial-v0.5.zip`) **sí**
  está sincronizado con `frontend/package.json` (ahora `0.5.0`) y con
  `CHANGELOG.md` (encabezado `## [0.5]`). Al armar una nueva release, mantener
  la coherencia actualizando los tres en el mismo cambio:
  `frontend/package.json` → `"version"`, el campo equivalente en
  `frontend/package-lock.json`, la versión mostrada en
  `frontend/src/routes/api/health/+server.js` y el panel "Acerca de" del
  `MediaPlayer`, además de una nueva entrada `## [X.Y]` en `CHANGELOG.md`
  antes de comprimir. (Históricamente 0.0.2 no estaba alineado; v0.5 corrige
  el desfase.)
- Si se publican notas de release en GitHub, documentar el contrato de
  instalación (descomprimir → `start.bat` → `http://localhost:3000` →
  wizard `/install`) para los usuarios no avanzados.

## 7. Cambios que invalidarían esta guía (volver a validar si ocurren)

- Que el instalador deje de leer `schema_sqlite.sql` de la raíz (p.ej. si
  migra a usar solo `migrations/`).
- Que se agregue/quite una dependencia de runtime en la raíz (hoy solo
  `schema_sqlite.sql` y `start.bat`).
- Que `eslint.config.js` vuelva a la raíz (desde 2026-07 vive en `frontend/`,
  junto a sus dependencias en `frontend/node_modules`; si se mueve de nuevo,
  restaurar la entrada en `$rootFiles` y el IN de raíz).
- Que `db.js` o `hooks.server.js` cambien el comportamiento de arranque sin
  BD (hoy bootea y redirige a `/install`).
