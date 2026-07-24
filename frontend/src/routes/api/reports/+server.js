/**
 * VSocial — Reports API
 * POST /api/reports — Create report
 * GET  /api/reports — List user's reports
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export async function POST({ request }) {
	const userId = await requireAuth(request);
	const body = await request.json();
	const db = getDb();

	const entityType = body.entity_type;
	const entityId = body.entity_id;
	const reason = (body.reason || '').trim();

	if (!entityType || !entityId)
		return json({ error: 'Tipo y ID de entidad requeridos' }, { status: 400 });
	if (!reason || reason.length < 5)
		return json({ error: 'Motivo requerido (min 5 caracteres)' }, { status: 400 });
	if (!['post', 'comment', 'user', 'reel'].includes(entityType))
		return json({ error: 'Tipo de entidad invalido' }, { status: 400 });

	const existing = await db
		.prepare(
			"SELECT id FROM reports WHERE reporter_id = ? AND entity_type = ? AND entity_id = ? AND status = 'pending'"
		)
		.get(userId, entityType, entityId);
	if (existing) return json({ error: 'Ya reportaste este contenido.' }, { status: 409 });

	await db
		.prepare(
			'INSERT INTO reports (reporter_id, entity_type, entity_id, reason, status) VALUES (?, ?, ?, ?, ?)'
		)
		.run(userId, entityType, parseInt(entityId), reason, 'pending');

	return json({ success: true, message: 'Reporte enviado.' }, { status: 201 });
}

export async function GET({ request }) {
	const userId = await requireAuth(request);
	const db = getDb();
	const reports = await db
		.prepare('SELECT * FROM reports WHERE reporter_id = ? ORDER BY created_at DESC LIMIT 20')
		.all(userId);
	return json({ success: true, reports });
}
