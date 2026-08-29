/**
 * Voom! — Control de acceso por visibilidad de perfil.
 *
 * Respeta user_settings.profile_visibility del DUEÑO del contenido:
 *  - 'public'    → cualquiera
 *  - 'followers' → solo quien le sigue
 *  - 'friends'   → solo seguimiento mutuo
 * El dueño siempre ve su contenido.
 */

export async function getProfileAccess(db, viewerId, targetId) {
	if (!targetId) return { allowed: false, restricted: true };
	if (viewerId != null && Number(viewerId) === Number(targetId)) {
		return { allowed: true, restricted: false };
	}

	const row = await db
		.prepare(
			`SELECT COALESCE(s.profile_visibility, 'public') AS vis
			 FROM users u LEFT JOIN user_settings s ON s.user_id = u.id
			 WHERE u.id = ?`
		)
		.get(targetId);
	const vis = row?.vis || 'public';

	if (vis === 'public') return { allowed: true, restricted: false };
	if (!viewerId) return { allowed: false, restricted: true };

	if (vis === 'followers') {
		const f = await db
			.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
			.get(viewerId, targetId);
		return { allowed: !!f, restricted: !f };
	}

	if (vis === 'friends') {
		const [a, b] = await Promise.all([
			db
				.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
				.get(viewerId, targetId),
			db
				.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
				.get(targetId, viewerId)
		]);
		const mutual = !!(a && b);
		return { allowed: mutual, restricted: !mutual };
	}

	// Valor desconocido → tratar como público (no bloquear por datos corruptos)
	return { allowed: true, restricted: false };
}
