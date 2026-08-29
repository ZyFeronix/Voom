import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';

// Klipy REST API v1: la clave viaja en el path, no en cabeceras.
// Se usa el fetch del evento (no el global) para no disparar el aviso de
// SvelteKit sobre fetch durante SSR ni reintentos anidados del SDK klipy-js.
const KLIPY_BASE = 'https://api.klipy.com/api/v1';

export async function GET({ url, fetch }) {
	const query = url.searchParams.get('q') || '';
	const limit = parseInt(url.searchParams.get('limit')) || 20;

	try {
		const db = getDb();
		const klipyKeyRow = await db
			.prepare("SELECT value FROM system_settings WHERE key = 'klipy_api_key'")
			.get();
		const apiKey = klipyKeyRow?.value;

		if (!apiKey) {
			return json({
				success: false,
				error: 'KLIPY_API_KEY_NOT_CONFIGURED',
				message:
					'La API de Klipy no está configurada. Ve a Panel de Admin > Sistema para configurarla.',
				gifs: []
			});
		}

		const endpoint = query
			? `${KLIPY_BASE}/${apiKey}/gifs/search?q=${encodeURIComponent(query)}&per_page=${limit}`
			: `${KLIPY_BASE}/${apiKey}/gifs/trending?per_page=${limit}`;

		const response = await fetch(endpoint, {
			headers: { 'Content-Type': 'application/json' }
		});
		if (!response.ok) {
			throw new Error('Klipy HTTP request failed: ' + response.statusText);
		}

		const payload = await response.json();
		// Klipy envuelve los resultados: { data: { data: [...gifs], pagination } }
		const gifs = payload?.data?.data ?? payload?.data ?? [];

		return json({
			success: true,
			gifs
		});
	} catch (err) {
		console.error('Klipy API Error:', err);
		return json({ error: 'Fallo de búsqueda de GIFs', details: err.message }, { status: 500 });
	}
}
