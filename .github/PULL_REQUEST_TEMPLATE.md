> **Rama base:** todo entra por `dev`. Promoción: `dev` → `beta` → `main`.
> Un PR a `beta` solo puede abrirse desde `dev`, y uno a `main` solo desde `beta`.

## Qué cambia

<!-- Resumen en una o dos frases. -->

## Tipo de cambio

- [ ] Corrección de error
- [ ] Mejora o nueva función
- [ ] Refactor sin cambio de comportamiento
- [ ] Documentación
- [ ] Rendimiento
- [ ] Infraestructura / despliegue

## Cómo probarlo

<!-- Pasos concretos. Indica ruta, rol necesario y resultado esperado. -->

## Verificación

- [ ] `npm run lint` pasa
- [ ] `npm run build` pasa
- [ ] `npm run test` (si la suite aplica al cambio)
- [ ] Probado con datos reales de una instancia, no solo en el navegador de desarrollo
- [ ] Sin migraciones destructivas sin plan de reversión

## Notas

<!-- Capturas, decisiones, deuda pendiente. Ver CONTRIBUTING.md. -->
