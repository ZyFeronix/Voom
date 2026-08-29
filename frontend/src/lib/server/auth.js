/**
 * Voom! — Authentication Middleware
 * DB-backed session validation for server endpoints
 * All functions are async (compatible with @libsql/client and better-sqlite3 wrapper)
 */
import { getDb } from './db.js';
import { getBearerToken, decodeToken, encodeToken } from './jwt.js';
import { getEffectiveRole, roleHasPerm, ROLE_LEVEL } from './roles.js';
import { error } from '@sveltejs/kit';
import crypto from 'crypto';

/**
 * Require authentication. Returns userId or throws 401.
 * Usage: const userId = await requireAuth(request);
 */
export async function requireAuth(request) {
	const token = getBearerToken(request);
	if (!token) {
		throw error(401, 'No autorizado. Token faltante.');
	}

	const decoded = decodeToken(token);
	if (!decoded || !decoded.user_id) {
		throw error(401, 'Token inválido o expirado');
	}

	const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
	const db = getDb();

	const session = await db
		.prepare('SELECT id, user_id, expires_at FROM user_sessions WHERE token_hash = ? LIMIT 1')
		.get(tokenHash);

	if (!session) {
		throw error(401, 'Sesión inválida');
	}

	const rawExp = String(session.expires_at || '').trim();
	const isoExp = (rawExp.includes('T') ? rawExp : rawExp.replace(' ', 'T')).replace(/Z?$/, 'Z');
	const expiresAt = new Date(isoExp).getTime();
	if (!isNaN(expiresAt) && expiresAt < Date.now()) {
		await db.prepare('DELETE FROM user_sessions WHERE id = ?').run(session.id);
		throw error(401, 'La sesión ha expirado');
	}

	const user = await db
		.prepare('SELECT id, is_active, is_banned, muted_until FROM users WHERE id = ?')
		.get(session.user_id);

	if (!user) {
		await db.prepare('DELETE FROM user_sessions WHERE id = ?').run(session.id);
		throw error(401, 'Sesión no válida o usuario no encontrado');
	}

	if (user.is_banned || !user.is_active) {
		await db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(session.user_id);
		throw error(403, 'Tu cuenta ha sido suspendida o desactivada.');
	}

	return session.user_id;
}

/**
 * Ensure user is not currently muted. Throws 403 if muted_until is in the future.
 */
export async function checkUserNotMuted(userId) {
	const db = getDb();
	const user = await db.prepare('SELECT muted_until FROM users WHERE id = ?').get(userId);
	if (user && user.muted_until) {
		const raw = String(user.muted_until).trim();
		const iso = (raw.includes('T') ? raw : raw.replace(' ', 'T')).replace(/Z?$/, 'Z');
		const muteEnd = new Date(iso).getTime();
		if (!isNaN(muteEnd) && muteEnd > Date.now()) {
			const formatted = new Date(muteEnd).toLocaleString('es-ES');
			throw error(403, `Tu cuenta se encuentra temporalmente silenciada hasta ${formatted}`);
		}
	}
}

/**
 * Optional authentication. Returns userId or null.
 */
export async function optionalAuth(request) {
	try {
		return await requireAuth(request);
	} catch {
		return null;
	}
}

/**
 * Valida la sesión a partir del token (mismo pipeline que requireAuth).
 * Devuelve la fila de user_sessions o null. No lanza.
 */
async function validateSessionByToken(token) {
	if (!token) return null;
	const decoded = decodeToken(token);
	if (!decoded || !decoded.user_id) return null;

	const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
	const db = getDb();

	const session = await db
		.prepare('SELECT id, user_id, expires_at FROM user_sessions WHERE token_hash = ? LIMIT 1')
		.get(tokenHash);
	if (!session) return null;

	const rawExp = String(session.expires_at || '').trim();
	const isoExp = (rawExp.includes('T') ? rawExp : rawExp.replace(' ', 'T')).replace(/Z?$/, 'Z');
	const expiresAt = new Date(isoExp).getTime();
	if (!isNaN(expiresAt) && expiresAt < Date.now()) {
		await db.prepare('DELETE FROM user_sessions WHERE id = ?').run(session.id);
		return null;
	}
	return session;
}

/**
 * Autenticación para loads server-side de SvelteKit: las navegaciones de página
 * no envían el header Authorization, así que se lee del mirror cookie
 * `vsocial_token` (se sincroniza en login/logout desde auth.svelte.js).
 * Devuelve userId o null — no lanza (el layout decide si redirigir).
 */
export async function getUserIdFromCookies(cookies) {
	try {
		const session = await validateSessionByToken(cookies?.get('vsocial_token'));
		return session?.user_id ?? null;
	} catch {
		return null;
	}
}

/**
 * Igual que requireAuth pero basado en cookies. Lanza error(401) si no hay sesión válida.
 */
export async function requireAuthCookie(cookies) {
	const session = await validateSessionByToken(cookies?.get('vsocial_token'));
	if (!session) throw error(401, 'No autorizado');
	return session.user_id;
}

/**
 * Devuelve { id, user_id } de la sesión correspondiente al Bearer token de la
 * petición, para poder identificar la "sesión actual" en la gestión de sesiones.
 */
export async function getSessionFromRequest(request) {
	return validateSessionByToken(getBearerToken(request));
}

/**
 * Create a session token and store in DB. Returns token string.
 */
export async function createSession(userId, request) {
	const token = encodeToken({ user_id: userId, username: '' });
	const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
	const db = getDb();

	const userAgent = request.headers.get('user-agent') || 'unknown';
	const ip =
		request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
	const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

	await db
		.prepare(
			'INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
		)
		.run(userId, tokenHash, ip, userAgent, expiresAt);

	return token;
}

/**
 * Require admin role (rol EFECTIVO: user_roles → users.role). Returns userId or throws 403.
 */
export async function requireAdmin(request) {
	const { userId } = await requirePerm(request, '*');
	return userId;
}

/**
 * Require un permiso del sistema de staff (lib/server/roles.js).
 * Devuelve { userId, role } o lanza 401/403. '*' equivale a requireAdmin.
 */
export async function requirePerm(request, perm) {
	const userId = await requireAuth(request);
	const db = getDb();

	const role = await getEffectiveRole(db, userId);
	const ok = perm === '*' ? ROLE_LEVEL[role] >= 40 : roleHasPerm(role, perm);
	if (!ok) {
		throw error(403, 'Acceso denegado. No tienes permisos para esta acción del panel.');
	}

	return { userId, role };
}

/**
 * Require Team Voom! badge role or higher staff level.
 * Explicitly rejects regular users (even if verified) and government/institutional roles.
 */
export async function requireTeamOrHigher(request) {
	const userId = await requireAuth(request);
	const db = getDb();

	const role = await getEffectiveRole(db, userId);
	if (ROLE_LEVEL[role] < 10) {
		throw error(
			403,
			'Acceso denegado. Función experimental exclusiva para usuarios con insignia "Equipo Voom!" y rangos superiores.'
		);
	}

	return { userId, role };
}

export default {
	requireAuth,
	checkUserNotMuted,
	optionalAuth,
	createSession,
	requireAdmin,
	requirePerm,
	requireTeamOrHigher
};
