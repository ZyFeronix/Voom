/**
 * VSocial — Market API (catálogo + ofertas P2P)
 * Las ofertas ya NO mueven dinero de la plataforma: el pago se cierra
 * externamente con el enlace personal del vendedor (payment_link).
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export async function GET({ params }) {
	const parts = params.path || [];
	const action = parts[0] || '';
	const db = getDb();

	if (action === 'listings') {
		const rows = await db
			.prepare(
				`SELECT m.*, u.username, u.display_name, u.avatar_url
			 FROM listings m JOIN users u ON m.user_id = u.id
			 WHERE m.status = 'active' ORDER BY m.created_at DESC`
			)
			.all();
		return json({ success: true, data: rows });
	}

	if (action === 'jobs') {
		const rows = await db
			.prepare(
				`SELECT j.*, u.username, u.display_name, u.avatar_url
			 FROM jobs j JOIN users u ON j.user_id = u.id
			 WHERE j.status = 'open' ORDER BY j.created_at DESC`
			)
			.all();
		return json({ success: true, data: rows });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function POST({ request }) {
	await requireAuth(request);
	return json({ error: 'Endpoint not found' }, { status: 404 });
}
