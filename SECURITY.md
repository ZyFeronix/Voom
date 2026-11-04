# Política de seguridad

## Versiones soportadas

Solo la última release recibe correcciones de seguridad.

| Versión | Soporte |
| --- | --- |
| `0.6.x` | ✅ |
| Anteriores | ❌ |

## Reportar una vulnerabilidad

**No abras un issue público.** Usa el reporte privado de GitHub:

<https://github.com/ZyFeronix/Voom/security/advisories/new>

Incluye:

- Impacto y tipo de vulnerabilidad (XSS, SQLi, SSRF, escalada de privilegios, IDOR…).
- Versión y forma de despliegue (Docker, Node directo, Turso remoto).
- Pasos mínimos para reproducirlo, con rol y ruta implicados.
- Prueba de concepto, si la tienes.

### Qué esperar

- Confirmación de recepción en un plazo de 7 días.
- Evaluación y plan de corrección tras la confirmación.
- Crédito en el aviso publicado, si lo deseas.

## Alcance

Entran en alcance:

- Autenticación, sesiones y control de acceso por rol.
- Rutas de API, validación de entrada y subida de archivos.
- Aislamiento entre usuarios (mensajería, notificaciones, datos privados).
- Sanitización de HTML y CSS personalizado.
- Configuración de despliegue: secretos, cabeceras, proxy y healthcheck.

Quedan fuera: instancias de terceros mal configuradas, ataques que requieran acceso físico y vulnerabilidades ya reportadas upstream en dependencias.

## Buenas prácticas para quien autohospeda

- Define `JWT_SECRET` propio y no lo reutilices entre instancias.
- Sirve siempre sobre HTTPS y mantén el proxy actualizado.
- Revisa `/admin/team` y los roles con permisos elevados.
- Activa las alertas de seguridad del repositorio y mantén las dependencias al día.
