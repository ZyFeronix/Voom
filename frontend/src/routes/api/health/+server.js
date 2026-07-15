import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';

export async function GET() {
	const health = {
		status: 'ok',
		timestamp: new Date().toISOString(),
		version: '0.0.1'
	};

	try {
		const db = getDb();
		db.prepare('SELECT 1').get();
		health.database = 'connected';
	} catch (err) {
		health.database = 'disconnected';
		health.status = 'degraded';
	}

	return json(health, { status: health.status === 'ok' ? 200 : 503 });
}
