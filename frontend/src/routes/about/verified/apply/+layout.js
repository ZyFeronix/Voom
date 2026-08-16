// Rutas de solicitud de verificación — siempre SSR, nunca prerenderizadas.
// Esto evita que el crawler de prerender confunda estas rutas con el HTML estático de /about.
export const prerender = false;
export const ssr = true;
