import { getUserIdFromCookies } from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';

/**
 * Carga común para TODAS las subpáginas de /settings:
 * usuario + fila completa de user_settings + contadores de resumen.
 * Las subpáginas heredan estos datos vía $props() — evita waterfalls de
 * fetch('/api/users/settings') en cada cambio de pestaña.
 *
 * Si no hay sesión válida por cookie NO redirige aquí: devuelve authed:false
 * y el layout cliente hace fallback (localStorage → sync cookie → invalidateAll
 * o goto /login), para no romper deep-links de sesiones creadas antes del mirror.
 */
export async function load({ cookies }) {
	const userId = await getUserIdFromCookies(cookies);
	if (!userId) return { authed: false };

	const db = getDb();

	const user = await db
		.prepare(
			`SELECT id, username, display_name, email, bio, location, website,
				avatar_url, cover_url, payment_link, level, xp_points,
				follower_count, following_count, post_count, is_verified, email_verified,
				COALESCE((SELECT role FROM user_roles WHERE user_id = users.id), role, 'user') AS role
			FROM users WHERE id = ? AND is_active = 1 AND is_banned = 0`
		)
		.get(userId);
	if (!user) return { authed: false };

	let settings = await db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
	if (!settings) {
		await db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(userId);
		settings = await db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
	}

	const [{ n: sessionsCount } = { n: 0 }] = await db
		.prepare(
			`SELECT COUNT(*) AS n FROM user_sessions
			 WHERE user_id = ? AND expires_at > datetime('now')`
		)
		.all(userId);
	const [{ n: blockedCount } = { n: 0 }] = await db
		.prepare('SELECT COUNT(*) AS n FROM blocked_users WHERE blocker_id = ?')
		.all(userId);

	return {
		authed: true,
		user,
		settings,
		counts: { sessions: sessionsCount ?? 0, blocked: blockedCount ?? 0 }
	};
}
