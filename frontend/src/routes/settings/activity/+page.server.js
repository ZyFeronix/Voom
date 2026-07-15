import { requireAuth } from '$lib/server/auth.js';
import { getActivityHistory } from '$lib/server/activity.js';
import { getDb } from '$lib/server/db.js';

export async function load({ request, url }) {
	const userId = await requireAuth(request);
	const filter = url.searchParams.get('filter') || 'all';
	
	const logs = await getActivityHistory(userId, { limit: 50, filter });
	
	const db = getDb();
	
	// Enriquecer los logs con información de la entidad para mostrarla en la UI
	const enrichedLogs = logs.map(log => {
		let entityPreview = null;
		let metadataObj = null;
		
		try {
			if (log.metadata) metadataObj = JSON.parse(log.metadata);
		} catch(e) {}
		
		if (log.entity_type === 'post') {
			if (['delete', 'update'].includes(log.action_type) && metadataObj?.previous_body) {
				entityPreview = metadataObj.previous_body.substring(0, 100) + '...';
			} else {
				const post = db.prepare('SELECT body FROM posts WHERE id = ?').get(log.entity_id);
				if (post) entityPreview = post.body.substring(0, 100) + '...';
				else entityPreview = '[Publicación eliminada]';
			}
		} else if (log.entity_type === 'comment') {
			if (['delete', 'update'].includes(log.action_type) && metadataObj?.previous_body) {
				entityPreview = metadataObj.previous_body.substring(0, 100) + '...';
			} else {
				const comment = db.prepare('SELECT body FROM comments WHERE id = ?').get(log.entity_id);
				if (comment) entityPreview = comment.body.substring(0, 100) + '...';
				else entityPreview = '[Comentario eliminado]';
			}
		}
		
		return {
			...log,
			entityPreview,
			metadataObj
		};
	});

	return {
		logs: enrichedLogs,
		currentFilter: filter
	};
}
