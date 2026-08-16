/**
 * VSocial — Admin API
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAdmin } from '$lib/server/auth.js';
import bcrypt from 'bcryptjs';

export async function GET({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	await requireAdmin(request);
	const db = getDb();

	if (action === 'dashboard') {
		const totalUsers = (await db.prepare('SELECT COUNT(*) as c FROM users').get()).c;
		const totalPosts = (await db.prepare('SELECT COUNT(*) as c FROM posts').get()).c;
		const totalReels = (await db.prepare('SELECT COUNT(*) as c FROM reels').get()).c;
		const totalStories = (
			await db.prepare("SELECT COUNT(*) as c FROM stories WHERE expires_at > datetime('now')").get()
		).c;
		const pendingReports = (
			await db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'pending'").get()
		).c;
		const pendingVerifications = (
			await db
				.prepare(
					"SELECT COUNT(*) as c FROM verification_requests WHERE status IN ('pending', 'reviewing')"
				)
				.get()
		).c;
		const totalListings = (await db.prepare('SELECT COUNT(*) as c FROM marketplace_listings').get())
			.c;
		const newUsersToday = (
			await db.prepare("SELECT COUNT(*) as c FROM users WHERE date(created_at) = date('now')").get()
		).c;

		const recentReports = await db
			.prepare(
				`
			SELECT r.*, u.username as reporter_name,
				CASE r.entity_type WHEN 'post' THEN (SELECT body FROM posts WHERE id = r.entity_id) END as content_preview
			FROM reports r LEFT JOIN users u ON r.reporter_id = u.id
			WHERE r.status = 'pending' ORDER BY r.created_at DESC LIMIT 5
		`
			)
			.all();

		const weeklySignups = await db
			.prepare(
				`
			SELECT strftime('%w', created_at) as day, COUNT(*) as count
			FROM users WHERE created_at >= datetime('now', '-7 days')
			GROUP BY strftime('%w', created_at) ORDER BY day
		`
			)
			.all();

		return json({
			success: true,
			stats: {
				total_users: totalUsers,
				total_posts: totalPosts,
				total_reels: totalReels,
				total_stories: totalStories,
				pending_reports: pendingReports,
				pending_verifications: pendingVerifications,
				total_listings: totalListings,
				new_users_today: newUsersToday
			},
			recent_reports: recentReports,
			weekly_signups: weeklySignups
		});
	}

	if (action === 'users') {
		const q = url.searchParams.get('q') || '';
		const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
		const limit = Math.min(50, parseInt(url.searchParams.get('limit')) || 20);
		const offset = (page - 1) * limit;

		const roleFilter = url.searchParams.get('role') || '';
		const statusFilter = url.searchParams.get('status') || '';

		let clauses = ['1=1'];
		const vals = [];
		if (q) {
			clauses.push('(u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?)');
			vals.push(`%${q}%`, `%${q}%`, `%${q}%`);
		}
		if (roleFilter) {
			clauses.push("COALESCE(ur.role, u.role, 'user') = ?");
			vals.push(roleFilter);
		}
		if (statusFilter === 'active') {
			clauses.push('u.is_active = 1 AND u.is_banned = 0');
		} else if (statusFilter === 'inactive') {
			clauses.push('u.is_active = 0 AND u.is_banned = 0');
		} else if (statusFilter === 'banned') {
			clauses.push('u.is_banned = 1');
		}
		const where = clauses.join(' AND ');

		const users = await db
			.prepare(
				`
			SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.role,
				u.is_verified, u.is_banned, u.is_active, u.created_at, u.follower_count, u.post_count,
				COALESCE(ur.role, u.role, 'user') as effective_role
			FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
			WHERE ${where} GROUP BY u.id ORDER BY u.id DESC LIMIT ? OFFSET ?
		`
			)
			.all(...vals, limit, offset);

		const total = (
			await db
				.prepare(
					`SELECT COUNT(DISTINCT u.id) as c FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id WHERE ${where}`
				)
				.get(...vals)
		).c;
		return json({ success: true, users, total, page, limit });
	}

	if (action === 'reports') {
		const status = url.searchParams.get('status') || '';
		const entityType = url.searchParams.get('type') || '';
		const q = url.searchParams.get('q') || '';

		let whereClauses = ['1=1'];
		const vals = [];

		if (status) {
			whereClauses.push('r.status = ?');
			vals.push(status);
		}
		if (entityType) {
			whereClauses.push('r.entity_type = ?');
			vals.push(entityType);
		}
		if (q) {
			whereClauses.push('(r.reason LIKE ? OR u.username LIKE ?)');
			vals.push(`%${q}%`, `%${q}%`);
		}

		const reports = await db
			.prepare(
				`
			SELECT r.*,
				u.username as reporter_name,
				u.avatar_url as reporter_avatar,
				CASE r.entity_type
					WHEN 'post' THEN (SELECT p.body FROM posts p WHERE p.id = r.entity_id)
					WHEN 'comment' THEN (SELECT c.body FROM comments c WHERE c.id = r.entity_id)
					WHEN 'reel' THEN (SELECT re.caption FROM reels re WHERE re.id = r.entity_id)
					WHEN 'user' THEN (SELECT usr.bio FROM users usr WHERE usr.id = r.entity_id)
				END as content_preview,
				CASE r.entity_type
					WHEN 'post' THEN (SELECT pm.media_url FROM post_media pm WHERE pm.post_id = r.entity_id LIMIT 1)
					WHEN 'reel' THEN (SELECT re.video_url FROM reels re WHERE re.id = r.entity_id)
				END as content_media,
				CASE r.entity_type
					WHEN 'post' THEN (SELECT p.user_id FROM posts p WHERE p.id = r.entity_id)
					WHEN 'comment' THEN (SELECT c.user_id FROM comments c WHERE c.id = r.entity_id)
					WHEN 'reel' THEN (SELECT re.user_id FROM reels re WHERE re.id = r.entity_id)
					WHEN 'user' THEN r.entity_id
				END as target_author_id,
				CASE r.entity_type
					WHEN 'post' THEN (SELECT au.username FROM posts p JOIN users au ON p.user_id = au.id WHERE p.id = r.entity_id)
					WHEN 'comment' THEN (SELECT au.username FROM comments c JOIN users au ON c.user_id = au.id WHERE c.id = r.entity_id)
					WHEN 'reel' THEN (SELECT au.username FROM reels re JOIN users au ON re.user_id = au.id WHERE re.id = r.entity_id)
					WHEN 'user' THEN (SELECT au.username FROM users au WHERE au.id = r.entity_id)
				END as target_author_username,
				CASE r.entity_type
					WHEN 'post' THEN (SELECT au.avatar_url FROM posts p JOIN users au ON p.user_id = au.id WHERE p.id = r.entity_id)
					WHEN 'comment' THEN (SELECT au.avatar_url FROM comments c JOIN users au ON c.user_id = au.id WHERE c.id = r.entity_id)
					WHEN 'reel' THEN (SELECT au.avatar_url FROM reels re JOIN users au ON re.user_id = au.id WHERE re.id = r.entity_id)
					WHEN 'user' THEN (SELECT au.avatar_url FROM users au WHERE au.id = r.entity_id)
				END as target_author_avatar,
				CASE r.entity_type
					WHEN 'post' THEN (SELECT au.strike_count FROM posts p JOIN users au ON p.user_id = au.id WHERE p.id = r.entity_id)
					WHEN 'comment' THEN (SELECT au.strike_count FROM comments c JOIN users au ON c.user_id = au.id WHERE c.id = r.entity_id)
					WHEN 'reel' THEN (SELECT au.strike_count FROM reels re JOIN users au ON re.user_id = au.id WHERE re.id = r.entity_id)
					WHEN 'user' THEN (SELECT au.strike_count FROM users au WHERE au.id = r.entity_id)
				END as target_author_strikes,
				CASE r.entity_type
					WHEN 'post' THEN (SELECT au.muted_until FROM posts p JOIN users au ON p.user_id = au.id WHERE p.id = r.entity_id)
					WHEN 'comment' THEN (SELECT au.muted_until FROM comments c JOIN users au ON c.user_id = au.id WHERE c.id = r.entity_id)
					WHEN 'reel' THEN (SELECT au.muted_until FROM reels re JOIN users au ON re.user_id = au.id WHERE re.id = r.entity_id)
					WHEN 'user' THEN (SELECT au.muted_until FROM users au WHERE au.id = r.entity_id)
				END as target_author_muted_until
			FROM reports r
			LEFT JOIN users u ON r.reporter_id = u.id
			WHERE ${whereClauses.join(' AND ')}
			ORDER BY r.created_at DESC LIMIT 100
		`
			)
			.all(...vals);

		const pendingCount = (
			await db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'pending'").get()
		).c;
		const resolvedCount = (
			await db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'resolved'").get()
		).c;
		const dismissedCount = (
			await db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'dismissed'").get()
		).c;

		return json({
			success: true,
			reports,
			stats: {
				pending: pendingCount,
				resolved: resolvedCount,
				dismissed: dismissedCount,
				total: pendingCount + resolvedCount + dismissedCount
			}
		});
	}

	if (action === 'content') {
		const type = url.searchParams.get('type') || 'posts';
		let content = [];
		if (type === 'posts') {
			content = await db
				.prepare(
					`SELECT p.*, u.username, u.avatar_url FROM posts p JOIN users u ON p.user_id = u.id WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 50`
				)
				.all();
		} else if (type === 'reels') {
			content = await db
				.prepare(
					`SELECT r.*, u.username, u.avatar_url, r.video_url as media FROM reels r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT 50`
				)
				.all();
		} else if (type === 'trash') {
			content = await db
				.prepare(
					`SELECT p.*, u.username, u.avatar_url FROM posts p JOIN users u ON p.user_id = u.id WHERE p.deleted_at IS NOT NULL ORDER BY p.deleted_at DESC LIMIT 50`
				)
				.all();
		}
		return json({ success: true, content });
	}

	if (action === 'settings') {
		const rows = await db.prepare('SELECT key, value FROM system_settings').all();
		const settings = {};
		for (const r of rows) {
			try {
				settings[r.key] = JSON.parse(r.value);
			} catch {
				settings[r.key] = r.value;
			}
		}
		return json({ success: true, settings });
	}

	if (action === 'verifications') {
		const status = url.searchParams.get('status') || '';
		const category = url.searchParams.get('category') || '';
		const q = url.searchParams.get('q') || '';
		let whereClauses = ['1=1'];
		const vals = [];
		if (status) {
			whereClauses.push('vr.status = ?');
			vals.push(status);
		}
		if (category) {
			whereClauses.push('vr.category = ?');
			vals.push(category);
		}
		if (q) {
			whereClauses.push(
				'(vr.folio LIKE ? OR vr.applicant_handle LIKE ? OR vr.legal_name LIKE ? OR u.username LIKE ? OR vr.contact_email LIKE ?)'
			);
			vals.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
		}

		let query = `
			SELECT vr.*,
			       u.username, u.display_name, u.avatar_url, u.email as user_email,
			       u.created_at as user_created_at, u.follower_count as user_follower_count,
			       u.post_count as user_post_count, u.is_verified as user_is_verified,
			       admin.username as reviewer_name
			FROM verification_requests vr
			JOIN users u ON vr.user_id = u.id
			LEFT JOIN users admin ON vr.reviewed_by = admin.id
			WHERE ${whereClauses.join(' AND ')}
			ORDER BY vr.created_at DESC LIMIT 100
		`;
		const verifications = await db.prepare(query).all(...vals);

		const pendingCount = (
			await db
				.prepare("SELECT COUNT(*) as c FROM verification_requests WHERE status = 'pending'")
				.get()
		).c;
		const reviewingCount = (
			await db
				.prepare("SELECT COUNT(*) as c FROM verification_requests WHERE status = 'reviewing'")
				.get()
		).c;
		const approvedCount = (
			await db
				.prepare("SELECT COUNT(*) as c FROM verification_requests WHERE status = 'approved'")
				.get()
		).c;
		const rejectedCount = (
			await db
				.prepare("SELECT COUNT(*) as c FROM verification_requests WHERE status = 'rejected'")
				.get()
		).c;

		return json({
			success: true,
			verifications,
			stats: {
				pending: pendingCount,
				reviewing: reviewingCount,
				approved: approvedCount,
				rejected: rejectedCount,
				total: pendingCount + reviewingCount + approvedCount + rejectedCount
			}
		});
	}

	if (action === 'strikes') {
		const targetUserId = parseInt(url.searchParams.get('user_id') || '0');
		let query = `
			SELECT s.*, u.username as target_username, u.avatar_url as target_avatar, admin.username as issuer_name
			FROM user_strikes s
			JOIN users u ON s.user_id = u.id
			LEFT JOIN users admin ON s.issued_by = admin.id
		`;
		const vals = [];
		if (targetUserId) {
			query += ' WHERE s.user_id = ?';
			vals.push(targetUserId);
		}
		query += ' ORDER BY s.created_at DESC LIMIT 100';
		const strikes = await db.prepare(query).all(...vals);
		return json({ success: true, strikes });
	}

	return json({ error: 'Admin endpoint not found' }, { status: 404 });
}

export async function POST({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subaction = parts[1] || '';
	const adminId = await requireAdmin(request);
	const body = await request.json();
	const db = getDb();

	if (action === 'users' && subaction === 'create') {
		const { username, email, password, role } = body;
		if (!username || !email || !password)
			return json({ error: 'Faltan campos requeridos' }, { status: 400 });

		const existingUser = await db
			.prepare('SELECT id FROM users WHERE username = ? OR email = ?')
			.get(username, email);
		if (existingUser) return json({ error: 'El usuario o email ya existe' }, { status: 400 });

		const passwordHash = await bcrypt.hash(password, 10);
		const userRole = role || 'user';

		const result = await db
			.prepare(
				`
			INSERT INTO users (username, email, password_hash, display_name, role, is_verified, is_active, is_banned)
			VALUES (?, ?, ?, ?, ?, 1, 1, 0)
		`
			)
			.run(username, email, passwordHash, username, userRole);

		const newUserId = result.lastInsertRowid;

		if (userRole !== 'user') {
			await db
				.prepare('INSERT INTO user_roles (user_id, role) VALUES (?, ?)')
				.run(newUserId, userRole);
		}

		return json({ success: true, message: 'Usuario creado exitosamente' });
	}

	if (action === 'users' && subaction === 'ban') {
		const targetId = body.user_id;
		if (!targetId || targetId === adminId)
			return json({ error: 'No puedes banearte' }, { status: 400 });
		if (targetId === 1)
			return json({ error: 'El admin principal no puede ser baneado' }, { status: 400 });
		const reason = body.reason || 'Infraccion de las reglas.';
		await db.prepare('UPDATE users SET is_banned = 1, is_active = 0 WHERE id = ?').run(targetId);
		await db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(targetId);
		await db
			.prepare(
				"INSERT INTO notifications (recipient_id, actor_id, type, message) VALUES (?, ?, 'ban', ?)"
			)
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
		if (!targetId || targetId === adminId || targetId === 1)
			return json({ error: 'Acción no permitida' }, { status: 400 });
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
		await db
			.prepare('UPDATE reports SET status = ? WHERE id = ?')
			.run(resolution === 'resolved' ? 'resolved' : 'dismissed', parseInt(reportId));
		if (resolution === 'resolved' && body.delete_content && body.entity_type && body.entity_id) {
			if (body.entity_type === 'post')
				await db.prepare('DELETE FROM posts WHERE id = ?').run(body.entity_id);
			if (body.entity_type === 'comment')
				await db.prepare('DELETE FROM comments WHERE id = ?').run(body.entity_id);
		}
		return json({ success: true, message: 'Reporte ' + resolution });
	}

	if (action === 'settings' && subaction === 'toggle') {
		const key = body.key;
		if (!key) return json({ error: 'Key requerida' }, { status: 400 });
		await db
			.prepare(
				'INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
			)
			.run(key, typeof body.value === 'string' ? body.value : JSON.stringify(body.value));
		if (globalThis.io) {
			globalThis.io.emit('global_settings_update');
		}
		return json({ success: true, message: 'Ajuste actualizado' });
	}

	if (action === 'verifications' && subaction) {
		const reqId = parseInt(subaction);
		const { resolution, admin_notes } = body;
		const vReq = await db.prepare('SELECT * FROM verification_requests WHERE id = ?').get(reqId);
		if (!vReq) return json({ error: 'Solicitud no encontrada' }, { status: 404 });

		if (resolution === 'approved') {
			await db
				.prepare(
					`UPDATE verification_requests
					 SET status = 'approved', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now')
					 WHERE id = ?`
				)
				.run(admin_notes || null, adminId, reqId);

			await db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(vReq.user_id);

			await db
				.prepare(
					`INSERT INTO notifications (recipient_id, actor_id, type, message)
					 VALUES (?, ?, 'verification_approved', '¡Felicidades! Tu solicitud de verificación ha sido aprobada.')`
				)
				.run(vReq.user_id, adminId);

			if (globalThis.io) {
				globalThis.io
					.to(`user_${vReq.user_id}`)
					.emit('verification_status_change', { status: 'approved' });
			}

			return json({ success: true, message: 'Solicitud aprobada y usuario verificado' });
		} else if (resolution === 'rejected') {
			await db
				.prepare(
					`UPDATE verification_requests
					 SET status = 'rejected', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now')
					 WHERE id = ?`
				)
				.run(admin_notes || 'No cumple los requisitos mínimos.', adminId, reqId);

			await db
				.prepare(
					`INSERT INTO notifications (recipient_id, actor_id, type, message)
					 VALUES (?, ?, 'verification_rejected', ?)`
				)
				.run(
					vReq.user_id,
					adminId,
					`Tu solicitud de verificación ha sido rechazada: ${admin_notes || 'No cumple los requisitos de autoría.'}`
				);

			if (globalThis.io) {
				globalThis.io
					.to(`user_${vReq.user_id}`)
					.emit('verification_status_change', { status: 'rejected' });
			}

			return json({ success: true, message: 'Solicitud rechazada' });
		} else if (resolution === 'reviewing') {
			await db
				.prepare(
					`UPDATE verification_requests
					 SET status = 'reviewing', admin_notes = ?, reviewed_by = ?
					 WHERE id = ?`
				)
				.run(admin_notes || null, adminId, reqId);
			return json({ success: true, message: 'Solicitud marcada en revisión' });
		}
		return json({ error: 'Resolución no válida' }, { status: 400 });
	}

	if (action === 'strikes' && subaction === 'issue') {
		const { user_id, strike_level, reason, report_id } = body;
		const targetId = parseInt(user_id);
		if (!targetId || targetId === adminId) {
			return json({ error: 'Usuario inválido para sanción' }, { status: 400 });
		}
		if (targetId === 1) {
			return json({ error: 'El administrador principal no puede ser sancionado' }, { status: 400 });
		}
		if (!reason) {
			return json({ error: 'Debe especificar un motivo para la sanción' }, { status: 400 });
		}

		const level = parseInt(strike_level) || 1;
		let actionTaken = 'warning';
		let expiresAt = null;

		if (level === 1) {
			actionTaken = 'warning';
			await db
				.prepare(
					`INSERT INTO notifications (recipient_id, actor_id, type, message)
					 VALUES (?, ?, 'warning', ?)`
				)
				.run(targetId, adminId, `Advertencia oficial de moderación: ${reason}`);
		} else if (level === 2) {
			actionTaken = 'timeout';
			await db
				.prepare("UPDATE users SET muted_until = datetime('now', '+24 hours') WHERE id = ?")
				.run(targetId);
			expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
			await db
				.prepare(
					`INSERT INTO notifications (recipient_id, actor_id, type, message)
					 VALUES (?, ?, 'timeout', ?)`
				)
				.run(targetId, adminId, `Tu cuenta ha sido silenciada por 24 horas: ${reason}`);
		} else if (level === 3) {
			actionTaken = 'temp_ban';
			await db
				.prepare(
					"UPDATE users SET muted_until = datetime('now', '+7 days'), is_active = 0 WHERE id = ?"
				)
				.run(targetId);
			await db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(targetId);
			expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
			await db
				.prepare(
					`INSERT INTO notifications (recipient_id, actor_id, type, message)
					 VALUES (?, ?, 'temp_ban', ?)`
				)
				.run(targetId, adminId, `Tu cuenta ha sido suspendida por 7 días: ${reason}`);
		} else if (level === 4) {
			actionTaken = 'perm_ban';
			await db.prepare('UPDATE users SET is_banned = 1, is_active = 0 WHERE id = ?').run(targetId);
			await db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(targetId);
			await db
				.prepare(
					`INSERT INTO notifications (recipient_id, actor_id, type, message)
					 VALUES (?, ?, 'perm_ban', ?)`
				)
				.run(targetId, adminId, `Tu cuenta ha sido suspendida permanentemente: ${reason}`);
		}

		await db
			.prepare(
				`INSERT INTO user_strikes (user_id, issued_by, strike_level, action_taken, reason, report_id, expires_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.run(targetId, adminId, level, actionTaken, reason, report_id || null, expiresAt);

		await db.prepare('UPDATE users SET strike_count = strike_count + 1 WHERE id = ?').run(targetId);

		if (report_id) {
			await db
				.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?")
				.run(parseInt(report_id));
		}

		return json({ success: true, message: `Sanción aplicada (${actionTaken})` });
	}

	if (action === 'strikes' && subaction === 'unmute') {
		const targetId = parseInt(body.user_id);
		if (!targetId) return json({ error: 'Usuario inválido' }, { status: 400 });
		await db.prepare('UPDATE users SET muted_until = NULL WHERE id = ?').run(targetId);
		return json({ success: true, message: 'Silencio levantado' });
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

export async function PUT({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subId = parts[1] || '';
	await requireAdmin(request);
	const body = await request.json();
	const db = getDb();

	if (action === 'settings') {
		for (const [key, value] of Object.entries(body)) {
			await db
				.prepare(
					'INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
				)
				.run(key, typeof value === 'string' ? value : JSON.stringify(value));
		}
		if (globalThis.io) {
			globalThis.io.emit('global_settings_update');
		}
		return json({ success: true, message: 'Configuracion guardada' });
	}

	if (action === 'users' && subId) {
		const userId = parseInt(subId);
		const allowedFields = ['role', 'is_verified'];
		const updates = [];
		const vals = [];
		for (const f of allowedFields) {
			if (f in body) {
				updates.push(`${f} = ?`);
				vals.push(body[f]);
			}
		}
		if (!updates.length) return json({ error: 'Nada que actualizar' }, { status: 400 });
		vals.push(userId);
		await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
		if (body.role) {
			await db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
			await db
				.prepare('INSERT INTO user_roles (user_id, role) VALUES (?, ?)')
				.run(userId, body.role);
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
	const adminId = await requireAdmin(request);
	const db = getDb();

	if (action === 'reports' && subId) {
		await db.prepare('DELETE FROM reports WHERE id = ?').run(parseInt(subId));
		return json({ success: true, message: 'Reporte eliminado' });
	}

	if (action === 'content') {
		const type = subId;
		const id = parseInt(subId2);
		if (type === 'post') {
			await db.prepare("UPDATE posts SET deleted_at = datetime('now') WHERE id = ?").run(id);
		} else if (type === 'reel') {
			await db.prepare('DELETE FROM reels WHERE id = ?').run(id);
		} else if (type === 'trash') {
			await db.prepare('DELETE FROM posts WHERE id = ?').run(id);
		}
		return json({ success: true, message: 'Contenido eliminado' });
	}

	if (action === 'users' && subId) {
		const targetId = parseInt(subId);
		if (targetId === 1)
			return json({ error: 'El admin principal no puede ser eliminado' }, { status: 400 });
		if (targetId === adminId)
			return json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 });

		await db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
		return json({ success: true, message: 'Usuario eliminado' });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}
