/**
 * Utility to convert third-party GIF/Media URLs (like static.klipy.com) to proxied same-origin URLs
 * to prevent Chrome DevTools 3rd-party Cookie & SameSite warnings.
 */

// URLs que apuntan directamente a un archivo de imagen/vídeo (con extensión)
// son hotlink-friendly y se sirven bien desde su propio CDN. Meterlas por el
// proxy haría que nuestro servidor las descargase y re-sirviese (más ancho
// de banda y latencia) sin ningún beneficio funcional.
const STATIC_FILE_RE = /\.(gif|gifv|jpe?g|png|webp|avif|mp4|webm)$/i;

// Desenche una URL que YA pasó por el proxy (/api/gifs/proxy?url=...) y cuyo
// destino interno es un archivo estático directo. Eso deja de remar el proxy
// (doble salto, más ancho de banda) para contenido heredado guardado con la
// versión anterior que proxeaba todo; los archivos estáticos se sirven mejor
// desde su propio CDN.
function unwrapProxiedStaticFile(proxiedUrl) {
	try {
		const parsed = new URL(proxiedUrl, 'http://voom.local');
		const target = parsed.searchParams.get('url');
		if (target) {
			const targetParsed = new URL(target);
			if (STATIC_FILE_RE.test(targetParsed.pathname)) {
				return target;
			}
		}
	} catch (_e) {
		// URL inválida o sin parámetro, devolverla tal cual
	}
	return proxiedUrl;
}

export function getProxiedMediaUrl(rawUrl) {
	if (!rawUrl || typeof rawUrl !== 'string') return rawUrl || '';

	// Return local URLs, blobs or data URIs as-is
	if (rawUrl.startsWith('/') || rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
		return rawUrl;
	}

	// URLs ya proxeadas: desempaquetarlas si apuntan a un archivo estático
	// directo, o conservarlas tal cual en caso contrario.
	if (rawUrl.includes('/api/gifs/proxy')) {
		return unwrapProxiedStaticFile(rawUrl);
	}

	// Check if the URL is from known 3rd party GIF domains that trigger cookie warnings
	const thirdPartyGifDomains = ['klipy.com', 'klipy.co', 'giphy.com', 'tenor.com'];

	try {
		const parsed = new URL(rawUrl);
		const isThirdPartyGif = thirdPartyGifDomains.some(
			(domain) => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
		);

		// Solo se proxya lo que no sea un archivo estático directo (p. ej. URLs de
		// página como giphy.com/view/... o tenor.com/view/..., que redirigen).
		if (isThirdPartyGif && !STATIC_FILE_RE.test(parsed.pathname)) {
			return `/api/gifs/proxy?url=${encodeURIComponent(rawUrl)}`;
		}
	} catch (_e) {
		// Invalid URL, return as-is
	}

	return rawUrl;
}
