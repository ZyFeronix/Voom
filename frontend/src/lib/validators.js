/**
 * VSocial — Validators compartidos (cliente + servidor)
 *
 * validatePaymentLink: valida el enlace de cobro externo (P2P) de un usuario.
 * Reglas:
 *   - https:// obligatorio
 *   - Dominio en la lista de pasarelas/crowdfunding permitidas
 *   - Longitud ≤ 255
 *   - Vacío = sin enlace (válido)
 */

export const PAYMENT_LINK_HOSTS = ['paypal.me', 'ko-fi.com', 'patreon.com'];

export const PAYMENT_LINK_MAX_LENGTH = 255;

/**
 * @param {string} value
 * @returns {{ ok: boolean, value?: string, host?: string|null, error?: string }}
 */
export function validatePaymentLink(value) {
	if (!value || !value.trim()) return { ok: true, value: '', host: null };

	const raw = value.trim();
	if (raw.length > PAYMENT_LINK_MAX_LENGTH) {
		return { ok: false, error: `Máximo ${PAYMENT_LINK_MAX_LENGTH} caracteres.` };
	}

	let url;
	try {
		url = new URL(raw);
	} catch {
		return { ok: false, error: 'URL inválida. Formato: https://dominio/usuario' };
	}

	if (url.protocol !== 'https:') {
		return { ok: false, error: 'El enlace debe usar https://' };
	}

	let host = url.hostname.toLowerCase();
	if (host.startsWith('www.')) host = host.slice(4);

	const allowed = PAYMENT_LINK_HOSTS.some((h) => host === h || host.endsWith('.' + h));
	if (!allowed) {
		return {
			ok: false,
			error: 'Dominio no permitido. Usa paypal.me, ko-fi.com, o patreon.com.'
		};
	}

	return { ok: true, value: raw, host };
}
