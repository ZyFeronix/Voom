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

	const expiresAt = new Date(session.expires_at + 'Z').getTime();
	if (expiresAt < Date.now()) {
		await db.prepare('DELETE FROM user_sessions WHERE id = ?').run(session.id);
		throw error(401, 'La sesión ha expirado');
	}

	return session.user_id;
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

export default { requireAuth, optionalAuth, createSession, requireAdmin };
