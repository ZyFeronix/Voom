/**
 * VSocial — Admin API
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAdmin } from '$lib/server/auth.js';

export async function GET({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	await requireAdmin(request);
	const db = getDb();

	if (action === 'dashboard') {
		const totalUsers = (await db.prepare('SELECT COUNT(*) as c FROM users').get()).c;
		const totalPosts = (await db.prepare('SELECT COUNT(*) as c FROM posts').get()).c;
		const totalReels = (await db.prepare('SELECT COUNT(*) as c FROM reels').get()).c;
		const totalStories = (await db.prepare("SELECT COUNT(*) as c FROM stories WHERE expires_at > datetime('now')").get()).c;
		const pendingReports = (await db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'pending'").get()).c;
		const totalListings = (await db.prepare('SELECT COUNT(*) as c FROM marketplace_listings').get()).c;
		const newUsersToday = (await db.prepare("SELECT COUNT(*) as c FROM users WHERE date(created_at) = date('now')").get()).c;

		const recentReports = await db.prepare(`
			SELECT r.*, u.username as reporter_name,
				CASE r.entity_type WHEN 'post' THEN (SELECT body FROM posts WHERE id = r.entity_id) END as content_preview
			FROM reports r LEFT JOIN users u ON r.reporter_id = u.id
			WHERE r.status = 'pending' ORDER BY r.created_at DESC LIMIT 5
		`).all();

		const weeklySignups = await db.prepare(`
			SELECT strftime('%w', created_at) as day, COUNT(*) as count
			FROM users WHERE created_at >= datetime('now', '-7 days')
			GROUP BY strftime('%w', created_at) ORDER BY day
		`).all();

		return json({
			success: true,
			stats: { total_users: totalUsers, total_posts: totalPosts, total_reels: totalReels, total_stories: totalStories, pending_reports: pendingReports, total_listings: totalListings, new_users_today: newUsersToday },
			recent_reports: recentReports,
			weekly_signups: weeklySignups
		});
	}

	if (action === 'users') {
		const q = url.searchParams.get('q') || '';
		const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
		const limit = Math.min(50, parseInt(url.searchParams.get('limit')) || 20);
		const offset = (page - 1) * limit;

		let where = '1=1';
		const vals = [];
		if (q) {
			where = '(u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?)';
			vals.push(`%${q}%`, `%${q}%`, `%${q}%`);
		}

		const users = await db.prepare(`
			SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.role,
				u.is_verified, u.is_banned, u.is_active, u.created_at, u.follower_count, u.post_count,
				COALESCE(ur.role, u.role, 'user') as effective_role
			FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
			WHERE ${where} GROUP BY u.id ORDER BY u.id DESC LIMIT ? OFFSET ?
		`).all(...vals, limit, offset);

		const total = (await db.prepare(`SELECT COUNT(*) as c FROM users u WHERE ${where}`).get(...vals)).c;
		return json({ success: true, users, total, page, limit });
	}

	if (action === 'reports') {
		const status = url.searchParams.get('status') || 'pending';
		const reports = await db.prepare(`
			SELECT r.*, u.username as reporter_name, u.avatar_url as reporter_avatar,
				CASE r.entity_type
					WHEN 'post' THEN (SELECT body FROM posts WHERE id = r.entity_id)
					WHEN 'comment' THEN (SELECT body FROM comments WHERE id = r.entity_id)
				END as content_preview
			FROM reports r LEFT JOIN users u ON r.reporter_id = u.id
			WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 50
		`).all(status);
		return json({ success: true, reports });
	}

	if (action === 'content') {
		const type = url.searchParams.get('type') || 'posts';
		let content = [];
		if (type === 'posts') {
			content = await db.prepare(`SELECT p.*, u.username, u.avatar_url FROM posts p JOIN users u ON p.user_id = u.id WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 50`).all();
		} else if (type === 'reels') {
			content = await db.prepare(`SELECT r.*, u.username, u.avatar_url, r.video_url as media FROM reels r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT 50`).all();
		} else if (type === 'trash') {
			content = await db.prepare(`SELECT p.*, u.username, u.avatar_url FROM posts p JOIN users u ON p.user_id = u.id WHERE p.deleted_at IS NOT NULL ORDER BY p.deleted_at DESC LIMIT 50`).all();
		}
		return json({ success: true, content });
	}

	if (action === 'settings') {
		const rows = await db.prepare('SELECT key, value FROM system_settings').all();
		const settings = {};
		for (const r of rows) {
			try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; }
		}
		return json({ success: true, settings });
	}

	if (action === 'logs') {
		const logs = await db.prepare(`
			SELECT t.*, u.username FROM transactions t
			LEFT JOIN wallets w ON t.wallet_id = w.id
			LEFT JOIN users u ON w.user_id = u.id
			ORDER BY t.created_at DESC LIMIT 50
		`).all();
		return json({ success: true, logs });
	}

	if (action === 'activity') {
		const limit = Math.min(50, parseInt(url.searchParams.get('limit')) || 10);
		const activity = await db.prepare(`
			SELECT n.*, u.username as actor_username, u.avatar_url as actor_avatar
			FROM notifications n LEFT JOIN users u ON n.actor_id = u.id
			ORDER BY n.created_at DESC LIMIT ?
		`).all(limit);
		return json({ success: true, activity });
	}

	return json({ error: 'Admin endpoint not found' }, { status: 404 });
}

export async function POST({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subaction = parts[1] || '';
	const adminId = await requireAdmin(request);
	const body = await request.json();
	const db = getDb();

	if (action === 'users' && subaction === 'ban') {
		const targetId = body.user_id;
		if (!targetId || targetId === adminId) return json({ error: 'No puedes banearte' }, { status: 400 });
		if (targetId === 1) return json({ error: 'El admin principal no puede ser baneado' }, { status: 400 });
		const reason = body.reason || 'Infraccion de las reglas.';
		await db.prepare('UPDATE users SET is_banned = 1, is_active = 0 WHERE id = ?').run(targetId);
		await db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(targetId);
		await db.prepare("INSERT INTO notifications (recipient_id, actor_id, type, message) VALUES (?, ?, 'ban', ?)")
			.run(targetId, adminId, 'Tu cuenta ha sido suspendida: ' + reason);
		return json({ success: true, message: 'Usuario baneado' });
	}

	if (action === 'users' && subaction === 'unban') {
		const targetId = body.user_id;
		if (!targetId) return json({ error: 'Usuario invalido' }, { status: 400 });
		await db.prepare('UPDATE users SET is_banned = 0, is_active = 1 WHERE id = ?').run(targetId);
		return json({ success: true, message: 'Usuario desbaneado' });
	}

	if (action === 'users' && subaction === 'disable') {
		const targetId = body.user_id;
		if (!targetId || targetId === adminId || targetId === 1) return json({ error: 'Acción no permitida' }, { status: 400 });
		await db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(targetId);
		await db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(targetId);
		return json({ success: true, message: 'Usuario deshabilitado' });
	}

	if (action === 'users' && subaction === 'enable') {
		const targetId = body.user_id;
		if (!targetId) return json({ error: 'Usuario invalido' }, { status: 400 });
		await db.prepare('UPDATE users SET is_active = 1 WHERE id = ? AND is_banned = 0').run(targetId);
		return json({ success: true, message: 'Usuario habilitado' });
	}

	if (action === 'reports') {
		const reportId = subaction;
		if (!reportId) return json({ error: 'Report ID requerido' }, { status: 400 });
		const resolution = body.resolution || 'dismissed';
		await db.prepare("UPDATE reports SET status = ? WHERE id = ?").run(resolution === 'resolved' ? 'resolved' : 'dismissed', parseInt(reportId));
		if (resolution === 'resolved' && body.delete_content && body.entity_type && body.entity_id) {
			if (body.entity_type === 'post') await db.prepare('DELETE FROM posts WHERE id = ?').run(body.entity_id);
			if (body.entity_type === 'comment') await db.prepare('DELETE FROM comments WHERE id = ?').run(body.entity_id);
		}
		return json({ success: true, message: 'Reporte ' + resolution });
	}

	if (action === 'settings' && subaction === 'toggle') {
		const key = body.key;
		if (!key) return json({ error: 'Key requerida' }, { status: 400 });
		await db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
			.run(key, typeof body.value === 'string' ? body.value : JSON.stringify(body.value));
		return json({ success: true, message: 'Ajuste actualizado' });
	}

	if (action === 'content') {
		const type = subaction; // 'trash'
		const id = parseInt(parts[2] || '0');
		if (type === 'trash' && id) {
			await db.prepare('UPDATE posts SET deleted_at = NULL WHERE id = ?').run(id);
			return json({ success: true, message: 'Post restaurado por admin' });
		}
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function PUT({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subId = parts[1] || '';
	await requireAdmin(request);
	const body = await request.json();
	const db = getDb();

	if (action === 'settings') {
		for (const [key, value] of Object.entries(body)) {
			await db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
				.run(key, typeof value === 'string' ? value : JSON.stringify(value));
		}
		return json({ success: true, message: 'Configuracion guardada' });
	}

	if (action === 'users' && subId) {
		const userId = parseInt(subId);
		const allowedFields = ['role', 'is_verified'];
		const updates = [];
		const vals = [];
		for (const f of allowedFields) {
			if (f in body) { updates.push(`${f} = ?`); vals.push(body[f]); }
		}
		if (!updates.length) return json({ error: 'Nada que actualizar' }, { status: 400 });
		vals.push(userId);
		await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
		if (body.role) {
			await db.prepare("DELETE FROM user_roles WHERE user_id = ?").run(userId);
			await db.prepare("INSERT INTO user_roles (user_id, role) VALUES (?, ?)").run(userId, body.role);
		}
		return json({ success: true, message: 'Usuario actualizado' });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function DELETE({ request, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subId = parts[1] || '';
	const subId2 = parts[2] || '';
	await requireAdmin(request);
	const db = getDb();

	if (action === 'reports' && subId) {
		await db.prepare('DELETE FROM reports WHERE id = ?').run(parseInt(subId));
		return json({ success: true, message: 'Reporte eliminado' });
	}

	if (action === 'content') {
		const type = subId;
		const id = parseInt(subId2);
		if (type === 'post') {
			await db.prepare('UPDATE posts SET deleted_at = datetime("now") WHERE id = ?').run(id);
		} else if (type === 'reel') {
			await db.prepare('DELETE FROM reels WHERE id = ?').run(id);
		} else if (type === 'trash') {
			await db.prepare('DELETE FROM posts WHERE id = ?').run(id);
		}
		return json({ success: true, message: 'Contenido eliminado' });
	}

	if (action === 'users' && subId) {
		const targetId = parseInt(subId);
		if (targetId === 1) return json({ error: 'El admin principal no puede ser eliminado' }, { status: 400 });
		if (targetId === adminId) return json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 });
		await db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
		return json({ success: true, message: 'Usuario eliminado' });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}
