/**
 * Utility to convert third-party GIF/Media URLs (like static.klipy.com) to proxied same-origin URLs
 * to prevent Chrome DevTools 3rd-party Cookie & SameSite warnings.
 */
export function getProxiedMediaUrl(rawUrl) {
	if (!rawUrl || typeof rawUrl !== 'string') return rawUrl || '';

	// Return local URLs, blobs, data URIs or already proxied URLs as-is
	if (
		rawUrl.startsWith('/') ||
		rawUrl.startsWith('blob:') ||
		rawUrl.startsWith('data:') ||
		rawUrl.includes('/api/gifs/proxy')
	) {
		return rawUrl;
	}

	// Check if the URL is from known 3rd party GIF domains that trigger cookie warnings
	const thirdPartyGifDomains = ['klipy.com', 'klipy.co', 'giphy.com', 'tenor.com'];

	// URLs que apuntan directamente a un archivo de imagen/vídeo (con extensión)
	// son hotlink-friendly y se sirven bien desde su propio CDN. Meterlas por el
	// proxy haría que nuestro servidor las descargase y re-sirviese (más ancho
	// de banda y latencia) sin ningún beneficio funcional.
	const STATIC_FILE_RE = /\.(gif|gifv|jpe?g|png|webp|avif|mp4|webm)$/i;

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
