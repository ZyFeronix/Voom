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

	try {
		const parsed = new URL(rawUrl);
		const isThirdPartyGif = thirdPartyGifDomains.some(
			(domain) => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
		);

		if (isThirdPartyGif) {
			return `/api/gifs/proxy?url=${encodeURIComponent(rawUrl)}`;
		}
	} catch (_e) {
		// Invalid URL, return as-is
	}

	return rawUrl;
}
