# Voom! en tu servidor — Guía de instalación (Docker / Portainer)

Esta guía te lleva de cero a **https://tudominio.com funcionando** en unos
15 minutos, sin necesidad de saber programar. Solo necesitas:

- Un VPS (servidor virtual) con **Ubuntu** — ej. DigitalOcean, Hetzner, Vultr,
  Contabo. Con 2 GB de RAM basta para empezar (4 GB recomendados).
- Un **dominio** comprado (ej. `voom.social`).
- Un cliente **SSH** para conectar (Terminal en Mac/Linux, o la web de tu
  proveedor).

---

## Paso 1 — Crear el servidor y apuntar el dominio

1. Crea un VPS con Ubuntu 24.04 y anota su **IP pública** (ej. `203.0.113.10`).
2. En el panel de tu **dominio**, crea un registro **A**:

   | Tipo | Nombre | Valor       |
   | ---- | ------ | ----------- |
   | A    | `@`    | 203.0.113.10 |

   Espera 5-15 minutos a que el DNS se propague (puedes comprobarlo en
   [dnschecker.org](https://dnschecker.org)).

## Paso 2 — Instalar Docker (una sola vez)

Conéctate por SSH (`ssh root@203.0.113.10`) y ejecuta:

```bash
curl -fsSL https://get.docker.com | sh
```

### ¿Usas Portainer? (panel visual, recomendado para empezar)

```bash
docker volume create portainer_data
docker run -d -p 9443:9443 --name portainer --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:lts
```

Abre `https://IP-del-servidor:9443`, crea el usuario admin y entra en
**Environments → local**. El resto de pasos se hacen desde Portainer
(Stacks → Add stack → Web editor). Si prefieres terminal, usa
`docker compose` directamente como se muestra abajo.

## Paso 3 — Copiar los 3 archivos del stack

En el servidor crea una carpeta, ej. `/opt/voom`, con estos tres archivos
(cópiolos tal cual del repositorio):

| Archivo              | Para qué                                        |
| -------------------- | ----------------------------------------------- |
| `docker-compose.yml` | La definición de los servicios (app + Caddy)    |
| `Caddyfile`          | Configuración del HTTPS automático              |
| `scripts/backup.sh`  | Script de backups diarios (opcional, recomendado) |

Con Portainer: al pegar el stack, **marca "Web editor"** y pega el contenido
de `docker-compose.yml`. Después, usa el mismo stack → Editor para revisar que
el `Caddyfile` esté montado (o súbelo a `/opt/voom/Caddyfile` con
`Files` del stack en Portainer).

## Paso 4 — Definir la variable única: DOMAIN

En Portainer (Create stack → Environment variables) o en un archivo `.env`
junto al compose, define **una sola variable**:

```
DOMAIN=voom.social
```

`JWT_SECRET` no hace falta: si no lo defines, el servidor genera uno el
primer arranque y lo guarda cifrado en el volumen de datos.

## Paso 5 — Levantar

**Terminal:**

```bash
cd /opt/voom
docker compose up -d
docker compose logs -f voom   # espera a ver "Production server running"
```

**Portainer:** Stacks → Add stack → pega el compose → Define la variable
`DOMAIN` → **Deploy the stack**.

La primera vez Caddy puede tardar ~1 minuto en obtener el certificado TLS.

## Paso 6 — Asistente de instalación (en tu navegador)

1. Abre `https://tudominio.com` → te redirige automáticamente al asistente.
2. Rellena **nombre del sitio**, **email del admin** y **contraseña**.
3. Pulsa instalar: se crea la base de datos, el admin y los ajustes iniciales.

## Paso 7 — Configurar la beta cerrada (invitaciones)

1. Entra en `https://tudominio.com/admin` con tu cuenta admin.
2. **Sistema** (Ajustes) → activa **«Registro Solo con Invitación»** → Guardar.
3. **Invitaciones** → Genera un lote (ej. 50 usos, nota "Lote Discord #1").
4. Comparte los códigos en tu servidor de Discord. Cada código se puede
   limitar por usos y fecha de expiración, y el panel muestra quién lo usó.

¡Listo! Tu beta cerrada está en marcha. 🚀

---

## Administración del día a día

### Backups automáticos (recomendado)

**Terminal:**

```bash
docker compose --profile backup up -d   # activa el servicio de backup
```

Crea `/data/backups/voom-FECHA.tar.gz` (BD + uploads) cada día a las 03:30 y
conserva los últimos 7. Para descargar uno:

```bash
docker cp voom_backup:/data/backups/voom-20260901.tar.gz .
```

**Backup manual inmediato:**

```bash
docker exec voom_app sh -c "sqlite3 /data/database.sqlite '.backup /data/manual.sqlite'"
docker cp voom_app:/data/manual.sqlite ./backup-manual.sqlite
```

### Actualizar a una versión nueva

```bash
cd /opt/voom
docker compose pull        # descarga la imagen nueva
docker compose up -d       # reinicia con la nueva versión
```

El entrypoint aplica las migraciones de base de datos pendientes
automáticamente al arrancar (tu contenido y usuarios no se tocan).

### SMTP (emails de verificación y reset de contraseña)

1. Crea una cuenta en un proveedor (Brevo, Resend, SES…) y obtén las
   credenciales SMTP.
2. En Voom!: **Admin → APIs** → sección SMTP → rellena host/puerto/usuario/
   contraseña/remitente → Guardar.
3. (Opcional) En **Admin → Sistema** activa «Verificación de email
   requerida».

> Sin SMTP configurado, la plataforma funciona igual; simplemente no envía
> emails (y no debes activar la verificación).

### Si algo va mal

```bash
docker compose logs -f voom     # logs de la aplicación
docker compose restart voom     # reiniciar la app
docker compose ps               # estado de los servicios
```

**Página de mantenimiento:** en `Admin → Sistema` activa «Modo Mantenimiento»
— todos los usuarios verán una página de aviso (el staff sigue entrando
normalmente) mientras arreglas lo que sea.

### Comandos útiles

```bash
docker exec -it voom_app sh                        # terminal dentro del contenedor
docker exec voom_app node /app/scripts/seed.js     # re-sembrar ajustes base
docker exec voom_app node /app/scripts/migrate-up.js  # forzar migraciones
docker compose exec voom node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(console.log)"  # salud
```

---

## Arquitectura del stack (referencia)

```
Internet ──▶ :80/:443 Caddy (TLS auto + HTTP/3)
                        │ reverse_proxy
                        ▼
              voom:3000  node server.js
              ├── SvelteKit (adapter-node) — la web y la API
              └── Socket.IO — chat/presencia/notificaciones en tiempo real
                        │
                        ▼
              volumen voom_data:/data
              ├── database.sqlite (+ WAL)  ← los datos
              ├── uploads/                 ← imágenes/vídeos subidos
              └── .jwt_secret              ← clave de sesión generada
```

- **Datos en un solo volumen**: para mover de servidor, copia el volumen
  `voom_data` y levanta el stack en el nuevo.
- **Sin base de datos externa**: SQLite en modo WAL es rápido y fiable para
  comunidades de hasta decenas de miles de usuarios. Si algún día necesitas
  más, el adaptador ya soporta Turso (libSQL remoto) vía `DATABASE_URL`.
