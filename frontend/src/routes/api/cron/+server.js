// frontend/src/routes/api/cron/+server.js
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';

export async function GET({ request, url }) {
	const authHeader = request.headers.get('Authorization');
	const tokenParam = url.searchParams.get('token');
	const token = authHeader?.replace('Bearer ', '') || tokenParam;
	const secret = process.env.CRON_SECRET;

	if (!secret || token !== secret) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const db = getDb();

	try {
		const storiesResult = await db.prepare(`DELETE FROM stories WHERE created_at < datetime('now', '-24 hours')`).run();
		const sessionsResult = await db.prepare(`DELETE FROM user_sessions WHERE expires_at < datetime('now')`).run();

		return json({
			success: true,
			changes: {
				stories: storiesResult.changes,
				sessions: sessionsResult.changes
			}
		});
	} catch (error) {
		return json({ error: error.message }, { status: 500 });
	}
}
