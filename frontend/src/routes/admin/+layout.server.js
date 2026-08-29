/**
 * Voom! — Guard server-side del panel de staff (/admin).
 *
 * Resuelve la sesión desde la cookie mirror, calcula el rol efectivo
 * (user_roles → users.role) y expone permisos + identidad al layout.
 * Non-auth → /login; no-staff → /feed. Los permisos finos por página los
 * re-exige el backend en cada endpoint (requirePerm).
 */
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { getUserIdFromCookies } from '$lib/server/auth.js';
import { getEffectiveRole, permsForRole, ROLE_LEVEL, roleLabel } from '$lib/server/roles.js';

const PANEL_TITLE = {
	super_admin: 'Centro de Control',
	admin: 'Centro de Control',
	moderator: 'Panel de Moderación',
	support: 'Panel de Soporte',
	team: 'Panel de Equipo',
	staff: 'Panel de Equipo'
};

export async function load({ cookies }) {
	const userId = await getUserIdFromCookies(cookies);
	if (!userId) throw redirect(302, '/login');

	const db = getDb();
	const role = await getEffectiveRole(db, userId);
	if ((ROLE_LEVEL[role] ?? 0) < 10) throw redirect(302, '/feed');

	const user = await db
		.prepare('SELECT id, username, display_name, avatar_url FROM users WHERE id = ?')
		.get(userId);

	return {
		staff: {
			id: userId,
			role,
			label: roleLabel(role),
			title: PANEL_TITLE[role] || 'Panel de Staff',
			permissions: permsForRole(role),
			username: user?.username || '',
			display_name: user?.display_name || user?.username || '',
			avatar_url: user?.avatar_url || null
		}
	};
}
