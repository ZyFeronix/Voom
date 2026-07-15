/**
 * VSocial — Auth API
 * POST /api/auth/register, login, logout
 * GET  /api/auth/me
 * PUT  /api/auth/change-password
 */
import { json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { getDb } from '$lib/server/db.js';
import { requireAuth, createSession } from '$lib/server/auth.js';
import crypto from 'crypto';

export async function POST({ request, url }) {
	const action = url.pathname.split('/').pop();
	const body = await request.json();
	const db = getDb();

	if (action === 'register') {
		const username = (body.username || '').trim();
		const email = (body.email || '').trim();
		const password = body.password || '';
		const displayName = (body.display_name || username).trim();
		const category = (body.category || '').trim();

		if (!username || !email || !password) return json({ error: 'Faltan campos obligatorios' }, { status: 400 });
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Formato de email inválido' }, { status: 400 });
		if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
		if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) return json({ error: 'Usuario inválido' }, { status: 400 });

		const existing = await db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
		if (existing) return json({ error: 'El usuario o email ya está en uso' }, { status: 409 });

		const passwordHash = await bcrypt.hash(password, 10);
		const result = await db.prepare(
			"INSERT INTO users (username, email, password_hash, display_name, category, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
		).run(username, email, passwordHash, displayName || username, category);
		const userId = Number(result.lastInsertRowid);

		await db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'user')").run(userId);

		const token = await createSession(userId, request);
		const user = await db.prepare(`
			SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.cover_url,
				u.bio, u.category, u.is_verified, u.wallet_balance, u.follower_count, u.following_count,
				COALESCE(ur.role, u.role, 'user') AS role
			FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id WHERE u.id = ? LIMIT 1
		`).get(userId);

		return json({ token, user }, { status: 201 });
	}

	if (action === 'login') {
		const loginId = (body.login || body.identifier || body.email || '').trim();
		const password = body.password || '';
		if (!loginId || !password) return json({ error: 'Credenciales requeridas' }, { status: 400 });

		const user = await db.prepare(`
			SELECT u.id, u.username, u.email, u.password_hash, u.display_name, u.avatar_url,
				u.cover_url, u.bio, u.category, u.is_verified, u.wallet_balance,
				u.follower_count, u.following_count, u.is_banned,
				COALESCE(ur.role, u.role, 'user') AS role
			FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
			WHERE u.email = ? OR u.username = ? LIMIT 1
		`).get(loginId, loginId);

		if (!user) return json({ error: 'Credenciales incorrectas' }, { status: 401 });
		if (user.is_banned) return json({ error: 'Esta cuenta ha sido suspendida' }, { status: 403 });

		const valid = await bcrypt.compare(password, user.password_hash);
		if (!valid) return json({ error: 'Credenciales incorrectas' }, { status: 401 });

		await db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(user.id);

		const token = await createSession(user.id, request);
		delete user.password_hash;
		delete user.is_banned;

		return json({ token, user });
	}

	if (action === 'logout') {
		const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
		if (token) {
			const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
			await db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(tokenHash);
		}
		return json({ success: true });
	}

	return json({ error: 'Endpoint no encontrado' }, { status: 404 });
}

export async function GET({ request, url }) {
	const action = url.pathname.split('/').pop();

	if (action === 'me') {
		const userId = await requireAuth(request);
		const db = getDb();
		const user = await db.prepare(`
			SELECT id, username, email, display_name, avatar_url, cover_url, bio, category, role,
				is_verified, wallet_balance, follower_count, following_count, created_at
			FROM users WHERE id = ?
		`).get(userId);
		if (!user) return json({ error: 'Usuario no encontrado' }, { status: 404 });
		return json({ user });
	}

	return json({ error: 'Endpoint no encontrado' }, { status: 404 });
}

export async function PUT({ request, url }) {
	const action = url.pathname.split('/').pop();

	if (action === 'change-password') {
		const userId = await requireAuth(request);
		const body = await request.json();
		const { currentPassword, newPassword } = body;
		if (!currentPassword || !newPassword) return json({ error: 'Faltan campos de contraseña' }, { status: 400 });
		if (newPassword.length < 8) return json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }, { status: 400 });

		const db = getDb();
		const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
		if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
			return json({ error: 'Contraseña actual incorrecta' }, { status: 401 });
		}

		const newHash = await bcrypt.hash(newPassword, 10);
		await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);
		return json({ success: true, message: 'Contraseña actualizada' });
	}

	return json({ error: 'Endpoint no encontrado' }, { status: 404 });
}
