/**
 * Voom! — Registro de auditoría para acciones del staff.
 *
 * Único punto de escritura en admin_audit_logs (migración 018). Best-effort:
 * nunca lanza ni rompe la acción principal si el INSERT falla.
 */
import { getDb } from './db.js';

/**
 * Registra una acción de staff.
 * @param {number|null} actorId  quien ejecuta (null = sistema)
 * @param {string} action        p.ej. 'user.ban', 'report.resolve', 'settings.update'
 * @param {string|null} entityType  'user' | 'post' | 'reel' | 'report' | 'verification' | 'settings' | 'announcement' | 'strike'
 * @param {number|string|null} entityId
 * @param {object|null} details  metadatos JSON (cambios, motivo, etc.)
 * @param {string|null} ip
 */
export async function logAdminAction(
	actorId,
	action,
	entityType = null,
	entityId = null,
	details = null,
	ip = null
) {
	try {
		const db = getDb();
		await db
			.prepare(
				`INSERT INTO admin_audit_logs (actor_id, action, entity_type, entity_id, details, ip, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
			)
			.run(
				actorId ?? null,
				action,
				entityType,
				entityId === undefined || entityId === null ? null : String(entityId),
				details ? JSON.stringify(details) : null,
				ip
			);
	} catch (err) {
		// La auditoría nunca debe romper la acción de negocio.
		console.error('[audit] No se pudo registrar la acción:', action, err?.message);
	}
}

export default { logAdminAction };
