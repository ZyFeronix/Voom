import { error } from '@sveltejs/kit';

const ALLOWED_HOSTS = [
	'static.klipy.com',
	'media.klipy.co',
	'klipy.co',
	'giphy.com',
	'media.giphy.com',
	'tenor.com',
	'media.tenor.com'
];

export async function GET({ url }) {
	const targetUrl = url.searchParams.get('url');
	if (!targetUrl) {
		throw error(400, 'Missing url parameter');
	}

	try {
		const parsed = new URL(targetUrl);
		const isAllowed = ALLOWED_HOSTS.some(
			(host) => parsed.hostname === host || parsed.hostname.endsWith('.' + host)
		);

		if (!isAllowed) {
			throw error(400, 'Host not allowed for proxying');
		}

		const res = await fetch(targetUrl, {
			headers: {
				'User-Agent': 'V-Social/2.0'
			}
		});

		if (!res.ok) {
			throw error(res.status, 'Failed to fetch media');
		}

		const contentType = res.headers.get('content-type') || 'image/gif';
		const arrayBuffer = await res.arrayBuffer();

		return new Response(arrayBuffer, {
			status: 200,
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=86400, immutable',
				'Access-Control-Allow-Origin': '*',
				'Referrer-Policy': 'no-referrer'
			}
		});
	} catch (err) {
		console.error('GIF Proxy error:', err);
		throw error(500, err.message || 'Error proxying media');
	}
}
