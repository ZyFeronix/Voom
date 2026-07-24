// ── Carga diferida (lazy) de los custom elements de vidstack ───────────────
// vidstack es una dependencia pesada del cliente. Sus imports `vidstack/define/*` son
// side-effect: registran los custom elements <media-player>, <media-outlet> y
// <media-community-skin> en el global. Cargarlos eager mete todo vidstack en el camino
// crítico de la primera visita al feed/composer aunque solo se use para previews de
// stories y compositor (los posts del feed usan <video> nativo vía MediaPlayer).
//
// Con esto se carga en paralelo a los datos (onMount), fuera del parse/execute inicial,
// y gracias al chunk vendor-vidstack (vite.config.js manualChunks) va a su propio archivo.
// Los custom elements se "upgradean" retroactivamente sobre cualquier nodo ya renderizado
// en cuanto el dynamic import resuelve, así que es seguro renderizar <media-player> antes.

let vidstackPromise = null;

/**
 * Garantiza que los custom elements de vidstack estén registrados.
 * Memoizado: todas las llamadas comparten la misma promesa en vuelo.
 * @returns {Promise<void>}
 */
export function ensureVidstack() {
	if (vidstackPromise) return vidstackPromise;
	vidstackPromise = Promise.all([
		import('vidstack/define/media-player.js'),
		import('vidstack/define/media-outlet.js'),
		import('vidstack/define/media-community-skin.js')
	]).then(() => undefined);
	return vidstackPromise;
}
