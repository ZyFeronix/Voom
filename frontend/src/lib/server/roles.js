/**
 * Voom! — Sistema de roles y permisos del staff (fuente única de verdad).
 *
 * Jerarquía: user < team < staff(legacy) < support < moderator < admin < super_admin.
 * Los permisos se resuelven contra el rol EFECTIVO (COALESCE user_roles → users.role),
 * igual que el resto de la app; `admin`/`super_admin` son superusuarios (todos los permisos).
 *
 * Usar siempre a través de requirePerm() (lib/server/auth.js) en los endpoints.
 */

export const ROLE_LEVEL = {
	user: 0,
	team: 10,
	staff: 10, // legacy, reconocido pero no asignable desde la UI
	support: 20,
	moderator: 30,
	admin: 40,
	super_admin: 50
};

/** Permisos del panel de administración. '*' = todos (admin y super_admin). */
export const ROLE_PERMISSIONS = {
	super_admin: ['*'],
	admin: ['*'],
	moderator: [
		'dashboard.view',
		'reports.view',
		'reports.resolve',
		'content.view',
		'content.moderate',
		'users.view',
		'strikes.view',
		'strikes.issue',
		'strikes.unmute',
		'announcements.view'
	],
	support: [
		'dashboard.view',
		'users.view',
		'reports.view',
		'verifications.view',
		'verifications.review',
		'announcements.view'
	],
	team: ['dashboard.view', 'announcements.view'],
	staff: ['dashboard.view', 'announcements.view']
};

/** Etiquetas y acento de color (var CSS --badge-*) para la UI. */
export const ROLE_META = {
	user: { label: 'Usuario', badge: 'verified' },
	team: { label: 'Equipo Voom!', badge: 'team' },
	staff: { label: 'Staff', badge: 'team' },
	support: { label: 'Soporte', badge: 'support' },
	moderator: { label: 'Moderador', badge: 'moderator' },
	admin: { label: 'Administrador', badge: 'admin' },
	super_admin: { label: 'Super Admin', badge: 'admin' },
	government: { label: 'Institución', badge: 'gov' }
};

/** Roles asignables desde el panel, ordenados por jerarquía. */
export const ASSIGNABLE_ROLES = ['user', 'team', 'support', 'moderator', 'admin', 'super_admin'];

/**
 * Rol efectivo de un usuario: user_roles tiene prioridad sobre users.role.
 * Devuelve 'user' si el usuario no existe.
 */
export async function getEffectiveRole(db, userId) {
	const row = await db
		.prepare(
			`SELECT COALESCE((SELECT role FROM user_roles WHERE user_id = ?), u.role, 'user') AS role
			 FROM users u WHERE u.id = ? LIMIT 1`
		)
		.get(userId, userId);
	return row?.role || 'user';
}

/** Listado canónico de todos los permisos (para expandir '*'). */
export const ALL_PERMISSIONS = [
	'dashboard.view',
	'reports.view',
	'reports.resolve',
	'content.view',
	'content.moderate',
	'users.view',
	'users.manage',
	'verifications.view',
	'verifications.review',
	'strikes.view',
	'strikes.issue',
	'strikes.unmute',
	'settings.manage',
	'announcements.view',
	'announcements.manage'
];

export function roleHasPerm(role, perm) {
	const perms = ROLE_PERMISSIONS[role];
	if (!perms) return false;
	return perms.includes('*') || perms.includes(perm);
}

export function permsForRole(role) {
	const perms = ROLE_PERMISSIONS[role] || [];
	return perms.includes('*') ? [...ALL_PERMISSIONS] : perms;
}

/**
 * ¿Puede `actor` gestionar (asignar/castigar/modificar) a alguien con rol `target`?
 * Solo niveles estrictamente inferiores; admin/super_admin solo los toca un super_admin.
 */
export function canManageRole(actor, target) {
	const actorLevel = ROLE_LEVEL[actor] ?? 0;
	const targetLevel = ROLE_LEVEL[target] ?? 0;
	if (actorLevel < 40) return false; // solo admin+ gestiona personas
	return targetLevel < actorLevel;
}

/**
 * ¿Puede `actor` OTORGAR el rol `role`? Reglas: no por encima de admin salvo super_admin,
 * y nunca un nivel igual o superior al propio.
 */
export function canGrantRole(actor, role) {
	if (!ASSIGNABLE_ROLES.includes(role)) return false;
	const actorLevel = ROLE_LEVEL[actor] ?? 0;
	if (actorLevel < 40) return false;
	if (role === 'super_admin') return actor === 'super_admin';
	if (role === 'admin') return actor === 'super_admin';
	return ROLE_LEVEL[role] < actorLevel;
}

export function roleLabel(role) {
	return ROLE_META[role]?.label || role;
}

export default {
	ROLE_LEVEL,
	ROLE_PERMISSIONS,
	ROLE_META,
	ASSIGNABLE_ROLES,
	getEffectiveRole,
	roleHasPerm,
	permsForRole,
	canManageRole,
	canGrantRole,
	roleLabel
};
