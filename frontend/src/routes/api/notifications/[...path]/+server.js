/**
 * VSocial — Notifications API
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export async function GET({ request, url }) {
	const userId = await requireAuth(request);
	const db = getDb();
	const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 20));
	const cursor = url.searchParams.get('before'); // notification_id cursor
	const unreadOnly = url.searchParams.get('unread') === '1';

	console.log('[API] /api/notifications called for user', userId);

	let where = "n.recipient_id = ? AND n.type != 'message'";
	const params = [userId];
	
	if (unreadOnly) {
		where += ' AND n.is_read = 0';
	}
	
	if (cursor) {
		where += ' AND n.id < ?';
		params.push(parseInt(cursor));
	}

	const notifs = await db.prepare(`
		SELECT n.*, u.username as actor_username, u.display_name as actor_name, u.avatar_url as actor_avatar
		FROM notifications n LEFT JOIN users u ON n.actor_id = u.id
		WHERE ${where} ORDER BY n.id DESC LIMIT ?
	`).all(...params, limit);

	const countRes = await db.prepare("SELECT COUNT(*) as cnt FROM notifications WHERE recipient_id = ? AND is_read = 0 AND type != 'message'").get(userId);
	const count = countRes ? countRes.cnt : 0;
	
	const hasMore = notifs.length === limit;
	const nextCursor = notifs.length > 0 ? notifs[notifs.length - 1].id : null;

	return json({ 
		notifications: notifs, 
		count,
		pagination: {
			has_more: hasMore,
			next_cursor: nextCursor,
			limit
		}
	});
}

export async function POST({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const userId = await requireAuth(request);
	const db = getDb();

	if (parts[0] === 'read-all') {
		await db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_id = ?').run(userId);
		return json({ success: true });
	}
	if (parts[1] === 'read') {
		await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?').run(parseInt(parts[0]), userId);
		return json({ success: true });
	}
	return json({ error: 'Endpoint no encontrado' }, { status: 404 });
}

export async function DELETE({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const userId = await requireAuth(request);
	const db = getDb();
	if (parts[0]) {
		await db.prepare('DELETE FROM notifications WHERE id = ? AND recipient_id = ?').run(parseInt(parts[0]), userId);
		return json({ success: true });
	}
	return json({ error: 'Endpoint no encontrado' }, { status: 404 });
}
