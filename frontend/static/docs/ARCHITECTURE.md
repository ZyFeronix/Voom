# V-Social: Documentación Exhaustiva y Registro Arquitectónico (Alpha v0.5)

> [!NOTE]
> Este documento técnico refleja el **espectro completo** del desarrollo, decisiones de arquitectura, módulos implementados, ideologías de diseño y configuraciones de infraestructura de la plataforma **V-Social**. Nada ha sido omitido. Es el plano maestro de la aplicación.

---

## 1. Pila Tecnológica (Tech Stack Completo)

### 1.1 Core Frontend
- **Framework Base:** SvelteKit 5 (Renderizado Híbrido: SSR + CSR).
- **Gestión de Estado:** Runes de Svelte 5 (`$state`, `$derived`, `$props`) reemplazando los stores tradicionales para una reactividad quirúrgica.
- **Estilos & UI:** Tailwind CSS + DaisyUI (base estructural) + CSS Puro para tokens del Glassmorphism avanzado.
- **Iconografía Tipográfica:** Material Icons Round (Google Fonts).

### 1.2 Core Backend (Node.js Integrado)
- **Capa API:** Rutas SvelteKit Server-Side (`src/routes/api/[modulo]/+server.js`).
- **Control de Sesiones:** JSON Web Tokens (JWT) guardados en `localStorage` + cookie client-side `Secure; SameSite=Strict` (no httpOnly — `lib/api.js` lee el token para enviarlo como Bearer). Hash del token en `user_sessions`. Middleware de autenticación en Hooks de SvelteKit (`requireAuth`/`optionalAuth`).
- **Cumplimiento RGPD (UE):** Páginas legales `/privacy` `/terms` `/cookies`; banner de consentimiento de cookies; registro con consentimiento + age gate 13+; borrado de cuenta self-service con ventana de reactivación de 30 días (`deleted_at` + cron diario de hard-delete en cascada); exportación de datos en JSON (`GET /api/users/export`). Ver `DOCS.md` §13.1.

### 1.3 Infraestructura de Datos
- **Motor de Base de Datos:** SQLite 3 transaccional (WAL). Esquema canónico en `schema_sqlite.sql` (~35 tablas, 15 dominios).
- **Driver de Conexión:** `@libsql/client` (preferido, soporta Turso remoto) con fallback `better-sqlite3` (síncrono, hiper-rápido). Adaptador universal async en `db.js`.
- **ORMs:** No se utilizan. La política del proyecto es escribir **Raw SQL** envuelto en sentencias preparadas (Prepared Statements) para asegurar el máximo rendimiento de IO y eliminar la magia oculta y latencia de los mapeadores objeto-relacionales.

---

## 2. Esquema de Base de Datos (Estructura Relacional)

La base de datos (`database.sqlite` en la raíz del repo) está diseñada para normalización de datos relacionales puros. *Nota: esta sección muestra solo las tablas centrales; el esquema completo vive en `schema_sqlite.sql`.*

1. **Tabla `users`:**
   - `id`, `username`, `email`, `password_hash`.
   - Perfilamiento: `display_name`, `bio`, `avatar_url`, `cover_url`.
   - Metadatos: `is_verified` (Creador Oficial), `created_at`.
   - **RGPD:** `birth_date` (age gate 13+), `deleted_at` (soft-delete + ventana 30 días), `terms_accepted_at`, `privacy_accepted_at` (migración `003_gdpr.sql`).
2. **Tabla `posts`:**
   - `id`, `user_id` (FK a users), `content`, `image_url`.
   - Métricas indexadas: `likes_count`, `comments_count`, `created_at`.
3. **Tabla `comments`:**
   - `id`, `post_id` (FK), `user_id` (FK), `content`, `created_at`.
4. **Tabla `likes`:**
   - `id`, `user_id`, `entity_type` (post/comment), `entity_id`.
   - *Nota:* Índice único compuesto para evitar duplicidad de "likes" del mismo usuario a la misma entidad.
5. **Tabla `follows`:**
   - Relación N:M: `follower_id` y `following_id`.
6. **Tabla `notifications`:**
   - El motor de registro de actividad.
   - `id`, `user_id` (receptor), `actor_id` (generador).
   - `type`: `like`, `comment`, `follow`, `mention`, `system`.
   - `entity_id`, `message` (texto base), `is_read` (booleano tracking de lectura).

---

## 3. Topología de Diseño: Neo-Aero & Glassmorphism 2.0

V-Social no utiliza un diseño Material UI o Bootstrap convencional. Emplea un sistema altamente personalizado que evoca cristales virtuales, profundidades abisales y luminiscencia fluida.

### Componentes y Tokens Core:
- **`glass-panel` y `glass-card`:** Marcos estructurales. Fondos semitransparentes (`bg-white/5` a `bg-white/10`), acompañados de `backdrop-blur-md` (o `xl`) y sutiles bordes translúcidos (`border-white/5` o `var(--border-subtle)`).
- **Sombras de Neón y Profundidad:** A diferencia de las sombras negras convencionales, los botones y acciones principales irradian sombras del color primario (ej. `shadow-[0_0_15px_rgba(27,133,243,0.15)]`).
- **Transiciones Táctiles:** Cada contenedor incluye un motor de micro-animación. Un hover típicamente levanta la tarjeta en el eje Z (`hover:-translate-y-0.5`), aplica un `scale-105` a las imágenes internas e invoca reflexiones simuladas (divs superpuestos con gradientes).
- **Motor de Renderizado Flex Dinámico:** Construcción a prueba de fallos mediante estructuras en línea estrictas (`flex: 0 0 44px`) en zonas sensibles (como los avatares) para prevenir que motores web problemáticos (como Safari o comportamientos del `<button>`) aplasten elementos elásticos.

---

## 4. Módulos Funcionales Desarrollados

### 4.1. Panel de Navegación Lateral (Sidebar)
- Estructura anclada a la izquierda que contiene todo el enrutamiento primario: *Inicio, Explorar, Reels, Marketplace, Mensajes, Notificaciones*.
- Panel inferior de control: *Mi Perfil, Ajustes, Modo Oscuro*.
- Botones prominentes para llamadas a la acción (*+ Crear*).

### 4.2. Sistema de Notificaciones (Real-Time UI)
Uno de los módulos más complejos construidos y depurados en la plataforma:
- **Agrupamiento y Pestañas Inteligentes:** Filtros en el cliente (`Todas`, `Menciones`, `Likes`, `Seguidores`, `Sistema`) inyectados mediante `filteredNotifications` derivado reactivamente.
- **Mapeo de UI de Estado (`getNotificationIcon`):** A cada tipo de notificación se le asignan colorimetrías y pictogramas fijos (Ej: Likes = Rose, Comentarios = Cyan, Follows = Violet).
- **Lógica de Refactorización de Cadena Rota (`undefined` fix):** Implementación de scripts de BD y un interceptor dinámico en frontend (Svelte `{@html}`) para parchear literales "undefined" inyectados en la base de datos heredada, reconstruyéndolos en hyper-vínculos (tags `<a>`) hacia el perfil del atacante sin destruir las filas previas.
- **Card de Notificación "Bulletproof":** Rediseñado para evitar conflictos del DOM. Separa la lógica semántica entre contenedores `flex` y elementos en bloque puro. Incluye luces de pulso simulado (`animate-pulse`) para no leídos.
- **Acciones Asíncronas:** `markAsRead` y `markAllAsRead` atacan silenciosamente el backend (`/api/notifications`) y actualizan el store síncronamente (optimistic UI rendering) para no congelar la interacción del usuario.

### 4.3. Lógica Backend de Endpoints
- **`/api/follows/+server.js`**: Procesa la acción relacional. Actualiza el grafo social e inyecta la inserción automática (`INSERT INTO notifications`) al receptor de manera paralela.
- **`/api/users/`**: Proveedor del grafo social y la metadata de los usuarios (nombres a mostrar, fotos de perfil) requerida por el feed.

---

## 5. Decisiones Arquitectónicas y Fallbacks (Resolución de Problemas)

El proyecto incluye técnicas avanzadas de depuración y estabilización que ya han sido aplicadas:
1. **Fallback Local de Stores:** Si un endpoint API de SvelteKit falla (ej. timeout de la base de datos), la mutación del DOM (`notificationsStore.markRead()`) se ejecuta en modo fallback para asegurar la continuidad de la experiencia de usuario (Optimistic UI Update).
2. **Defensas contra Colapso Volumétrico:** Todo componente crítico donde interviene flexbox y recursos dinámicos (avatares) tiene un escudo de tamaño máximo y mínimo directamente en el DOM (`style="flex: 0 0 44px; min-width: 44px; min-height: 44px"`) para sobrescribir heurísticas agresivas de WebKit/Blink en contenedores de botones o tablas.
3. **Escudos contra CSS Inválido:** Remoción absoluta de utilidades inyectadas arbitrariamente mediante interpolación si no están en el radar del compilador JIT de Tailwind. (Se resolvieron casos donde gradientes dinámicos rompieron el fondo de los avatares).

> V-Social es una maquinaria construida para no depender de librerías de UI prediseñadas engorrosas, forjando un sistema de diseño propio y de alto rendimiento. Todo el ecosistema ha sido optimizado para la latencia cero.
