import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { getActivityHistory } from '$lib/server/activity.js';
import { getDb } from '$lib/server/db.js';

export async function GET({ request, url }) {
	try {
		const userId = await requireAuth(request);
		const filter = url.searchParams.get('filter') || 'all';

		const logs = await getActivityHistory(userId, { limit: 50, filter });
		const db = getDb();

		const enrichedLogs = await Promise.all(
			logs.map(async (log) => {
				let entityPreview = null;
				let metadataObj = null;

				try {
					if (log.metadata) metadataObj = JSON.parse(log.metadata);
				} catch (_e) {}

				if (log.entity_type === 'post' || log.entity_type === 'video') {
					if (['delete', 'update'].includes(log.action_type) && metadataObj?.previous_body) {
						entityPreview = metadataObj.previous_body.substring(0, 100) + '...';
					} else {
						const post = await db
							.prepare(
								'SELECT body, (SELECT COUNT(*) FROM post_media WHERE post_id = posts.id) as media_count FROM posts WHERE id = ?'
							)
							.get(log.entity_id);
						if (post) {
							if (post.body) entityPreview = post.body.substring(0, 100) + '...';
							else if (post.media_count > 0) entityPreview = '[Contenido Multimedia]';
						} else {
							entityPreview = '[Publicación eliminada]';
						}
					}
				} else if (log.entity_type === 'reel') {
					const reel = await db
						.prepare('SELECT caption FROM reels WHERE id = ?')
						.get(log.entity_id);
					if (reel) {
						if (reel.caption) entityPreview = reel.caption.substring(0, 100) + '...';
						else entityPreview = '[Reel Multimedia]';
					} else {
						entityPreview = '[Reel eliminado]';
					}
				} else if (log.entity_type === 'story') {
					entityPreview = '[Historia Multimedia]';
				} else if (log.entity_type === 'comment') {
					if (['delete', 'update'].includes(log.action_type) && metadataObj?.previous_body) {
						entityPreview = metadataObj.previous_body.substring(0, 100) + '...';
					} else {
						const comment = await db
							.prepare('SELECT body FROM comments WHERE id = ?')
							.get(log.entity_id);
						if (comment && comment.body) entityPreview = comment.body.substring(0, 100) + '...';
						else entityPreview = '[Comentario eliminado]';
					}
				}

				return {
					...log,
					entityPreview,
					metadataObj
				};
			})
		);

		return json({ logs: enrichedLogs, currentFilter: filter });
	} catch (e) {
		console.error('[Activity API Error]:', e);
		return json({ error: e.message || 'No autorizado' }, { status: e.status || 401 });
	}
}
