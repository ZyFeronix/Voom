/**
 * Voom! — Zumbido (nudge estilo MSN).
 * Única fuente de verdad para el magic-string y su detección: el texto viaja
 * como cuerpo del mensaje, así que emisor (ChatPane/ChatComposer), receptor
 * (+page.svelte) y render (MessageBubble) deben compartir esta definición.
 */
export const ZUMBIDO_TEXT = '⚡ ¡ZUMBIDO!';

/** true si el mensaje es un zumbido (texto normalizado o comando /zumbido). */
export function isZumbidoMessage(m) {
	if (!m || m.is_deleted) return false;
	const b = (m.body || '').trim();
	const c = (m.content || '').trim();
	return (
		b === ZUMBIDO_TEXT ||
		c === ZUMBIDO_TEXT ||
		b.toLowerCase() === '/zumbido' ||
		c.toLowerCase() === '/zumbido'
	);
}
