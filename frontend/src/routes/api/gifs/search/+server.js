import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';

// Usaremos fetch dinámico ya que klipy-js podría necesitar configuración específica.
// O si klipy-js falló, fallback a Giphy/Tenor compatible.
// La documentación de Klipy (klipy.co) usa endpoints REST.

export async function GET({ url }) {
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

		// Klipy REST API
		// Si 'klipy-js' fue instalado, lo importamos dinámicamente para no crashear si falla.
		let klipyData = [];
		try {
			const { KlipyClient } = await import('klipy-js');
			const klipy = new KlipyClient({ apiKey });

			let results;
			if (query) {
				results = await klipy.gifs.search({ q: query, limit });
			} else {
				results = await klipy.gifs.trending({ limit });
			}
			klipyData = results.data || [];
		} catch (sdkError) {
			// Fallback si klipy-js no resuelve, usar HTTP Fetch
			console.log('Klipy SDK Error, usando HTTP Fetch', sdkError.message);
			const endpoint = query
				? `https://api.klipy.co/v2/gifs/search?q=${encodeURIComponent(query)}&limit=${limit}`
				: `https://api.klipy.co/v2/gifs/trending?limit=${limit}`;

			const response = await fetch(endpoint, {
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				}
			});
			if (!response.ok) throw new Error('Klipy HTTP request failed: ' + response.statusText);
			const data = await response.json();
			klipyData = data.data || [];
		}

		return json({
			success: true,
			gifs: klipyData
		});
	} catch (err) {
		console.error('Klipy API Error:', err);
		return json({ error: 'Fallo de búsqueda de GIFs', details: err.message }, { status: 500 });
	}
}
