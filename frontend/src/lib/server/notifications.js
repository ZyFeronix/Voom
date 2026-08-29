/**
 * Voom! — Helper centralizado de notificaciones.
 *
 * Único punto de creación de notificaciones: respeta las preferencias del
 * DESTINATARIO (toggles de /settings/notifications) y evita auto-notificaciones.
 * Los avisos de sistema (ban/warn/offer…) no tienen toggle y siempre se crean.
 */

// Columna de user_settings que controla cada tipo (null = sin preferencia).
const PREF_BY_TYPE = {
	like: 'notify_likes',
	comment: 'notify_comments',
	follow: 'notify_follows',
	message: 'notify_dms',
	message_reaction: 'notify_dms'
};

async function isTypeEnabled(db, recipientId, type) {
	const column = PREF_BY_TYPE[type];
	if (!column) return true;
	try {
		// Sin fila de settings → defaults activos (enviar).
		const row = await db
			.prepare(`SELECT ${column} AS enabled FROM user_settings WHERE user_id = ?`)
			.get(recipientId);
		return !row || row.enabled === 1 || row.enabled === true;
	} catch {
		return true;
	}
}

/**
 * Crea una notificación respetando las preferencias del destinatario.
 * @returns {Promise<number|null>} id de la fila creada, o null si se omitió
 *   (preferencia desactivada / auto-notificación / sin destinatario).
 */
export async function createNotification(
	db,
	{ recipientId, actorId = null, type, entityType = null, entityId = null, message = null }
) {
	if (!recipientId) return null;
	if (actorId != null && Number(actorId) === Number(recipientId)) return null;
	if (!(await isTypeEnabled(db, recipientId, type))) return null;

	const res = await db
		.prepare(
			`INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id, message)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(recipientId, actorId, type, entityType, entityId, message);
	return Number(res.lastInsertRowid) || null;
}

export default { createNotification };
