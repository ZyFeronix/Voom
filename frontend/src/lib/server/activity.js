import { getDb } from './db.js';

/**
 * Registra una actividad en el historial general del usuario.
 * @param {number} userId - ID del usuario que realiza la acción
 * @param {string} actionType - 'view', 'like', 'comment', 'create', 'update', 'delete', 'unlike'
 * @param {string} entityType - 'post', 'comment', 'reel', 'story', 'user'
 * @param {number} entityId - ID de la entidad afectada
 * @param {object} [metadata=null] - Objeto JSON opcional con contexto extra (texto borrado, diff, etc.)
 */
export async function logActivity(userId, actionType, entityType, entityId, metadata = null) {
	try {
		const db = getDb();
		const metaStr = metadata ? JSON.stringify(metadata) : null;
		// better-sqlite3 es síncrono — no usar await
		db.prepare(`
			INSERT OR IGNORE INTO activity_logs (user_id, action_type, entity_type, entity_id, metadata)
			VALUES (?, ?, ?, ?, ?)
		`).run(userId, actionType, entityType, entityId, metaStr);
	} catch (e) {
		console.error('[activity.js] Error logging activity:', e);
	}
}

/**
 * Obtiene el historial de actividad de un usuario.
 * @param {number} userId - ID del usuario
 * @param {object} options - { limit: 50, offset: 0, filter: 'all'|'views'|'interactions'|'audit' }
 */
export async function getActivityHistory(userId, options = {}) {
	const db = getDb();
	const limit = options.limit || 50;
	const offset = options.offset || 0;
	const filter = options.filter || 'all';

	let whereClause = 'WHERE user_id = ?';
	const params = [userId];

	if (filter === 'views') {
		whereClause += " AND action_type = 'view'";
	} else if (filter === 'interactions') {
		whereClause += " AND action_type IN ('like', 'comment', 'unlike')";
	} else if (filter === 'audit') {
		whereClause += " AND action_type IN ('create', 'update', 'delete')";
	}

	return db.prepare(`
		SELECT * FROM activity_logs
		${whereClause}
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`).all(...params, limit, offset);
}
