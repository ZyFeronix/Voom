import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { logActivity } from '$lib/server/activity.js';

/**
 * POST /api/activity/view
 * Reporta la visualización de un elemento para guardarlo en el historial.
 * Body: { entity_type: 'post'|'reel'|'story', entity_id: 123 }
 */
export async function POST({ request }) {
	const userId = await requireAuth(request).catch(() => null);
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { entity_type, entity_id } = body;

		if (!['reel', 'video'].includes(entity_type) || !entity_id) {
			return json(
				{ error: 'Solo se registran visualizaciones de multimedia (reel/video)' },
				{ status: 400 }
			);
		}

		// El índice único condicional (unique_multimedia_views_idx) en SQLite se encarga del anti-spam.
		// Si ya existe la vista, db.prepare arrojará un error de constraint que logActivity capturará
		// o podemos simplemente intentar loguear.
		await logActivity(userId, 'view', entity_type, entity_id);

		return json({ success: true });
	} catch (e) {
		console.error('[API /api/activity/view]', e);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
