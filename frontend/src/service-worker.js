/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `vsocial-cache-${version}`;

// Solo cachear assets estáticos (imágenes, fuentes, JS/CSS del build)
// NUNCA páginas de navegación SSR — esas las maneja SvelteKit
const ASSETS = [
	...build,
	...files
];

// Extensiones que son assets estáticos cacheables
const CACHEABLE_EXTENSIONS = [
	'.js', '.css', '.woff', '.woff2', '.ttf', '.otf',
	'.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg',
	'.gif', '.ico', '.mp4', '.webm', '.mp3', '.ogg'
];

function isStaticAsset(url) {
	const pathname = new URL(url).pathname;
	return CACHEABLE_EXTENSIONS.some(ext => pathname.endsWith(ext));
}

function shouldIntercept(request) {
	const url = new URL(request.url);

	// Solo interceptar misma origin
	if (url.origin !== self.location.origin) return false;

	// Nunca interceptar rutas de API
	if (url.pathname.startsWith('/api/')) return false;

	// Nunca interceptar rutas SSE / WebSocket-like
	if (url.pathname.startsWith('/api/notifications/stream')) return false;

	// Solo interceptar si es un asset estático conocido
	if (!isStaticAsset(url.href) && !ASSETS.includes(url.pathname)) return false;

	// Solo GET
	if (request.method !== 'GET') return false;

	return true;
}

// ── Install: pre-cachear assets del build ──
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
	);
});

// ── Activate: limpiar caches viejos ──
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
		).then(() => self.clients.claim())
	);
});

// ── Fetch: Cache-first para assets estáticos, pass-through para todo lo demás ──
self.addEventListener('fetch', (event) => {
	// Si no debemos interceptar, dejar pasar sin tocar
	if (!shouldIntercept(event.request)) return;

	event.respondWith(
		caches.open(CACHE).then(async (cache) => {
			// Cache-first: si está en caché, servir inmediatamente
			const cached = await cache.match(event.request);
			if (cached) return cached;

			// Network fallback
			try {
				const response = await fetch(event.request);
				if (response instanceof Response && response.status === 200) {
					cache.put(event.request, response.clone());
				}
				return response;
			} catch {
				// Si hay cached stale, usarlo. Si no, dejar que el error burbujee silenciosamente
				const stale = await cache.match(event.request);
				if (stale) return stale;
				// Retornar 503 sin lanzar excepción no controlada
				return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
			}
		})
	);
});
