/**
 * VSocial — Authentication Middleware
 * DB-backed session validation for server endpoints
 * All functions are async (compatible with @libsql/client and better-sqlite3 wrapper)
 */
import { getDb } from './db.js';
import { getBearerToken, decodeToken, encodeToken } from './jwt.js';
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
 * Require admin role. Returns userId or throws 403.
 */
export async function requireAdmin(request) {
	const userId = await requireAuth(request);
	const db = getDb();

	const user = await db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
	if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
		throw error(403, 'Acceso denegado. Se requiere nivel de administrador.');
	}

	return userId;
}

/**
 * Require Team V-SOCIAL badge role or higher staff level.
 * Allowed roles: 'team', 'support', 'moderator', 'admin', 'super_admin', 'staff'
 * Explicitly rejects regular users (even if verified) and government/institutional roles.
 */
export async function requireTeamOrHigher(request) {
	const userId = await requireAuth(request);
	const db = getDb();

	const user = await db
		.prepare(
			`SELECT u.id, COALESCE(ur.role, u.role, 'user') AS role
			 FROM users u
			 LEFT JOIN user_roles ur ON ur.user_id = u.id
			 WHERE u.id = ? LIMIT 1`
		)
		.get(userId);

	const allowedRoles = ['team', 'support', 'moderator', 'admin', 'super_admin', 'staff'];
	if (!user || !allowedRoles.includes(user.role)) {
		throw error(
			403,
			'Acceso denegado. Función experimental exclusiva para usuarios con insignia "Equipo V-SOCIAL" y rangos superiores.'
		);
	}

	return { userId, role: user.role };
}

export default {
	requireAuth,
	checkUserNotMuted,
	optionalAuth,
	createSession,
	requireAdmin,
	requireTeamOrHigher
};
