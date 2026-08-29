/**
 * Voom! — Admin API (panel de staff, multi-rol)
 *
 * Guard por ruta vía requirePerm(request, perm) — matriz en lib/server/roles.js.
 * Toda mutación escribe en admin_audit_logs vía logAdminAction().
 *
 * GET  /admin/dashboard                          dashboard.view
 * GET  /admin/analytics                          '*' (solo admin)
 * GET  /admin/users?q&page&limit&role&status     users.view
 * GET  /admin/users/:id                          users.view  (ficha completa)
 * GET  /admin/reports?status&type&q&page&limit   reports.view
 * GET  /admin/content?type=posts|reels|trash     content.view
 * GET  /admin/verifications?status&category&q&page&limit   verifications.view
 * GET  /admin/strikes?user_id                    strikes.view
 * GET  /admin/audit?actor&action&q&page&limit    '*' (solo admin)
 * GET  /admin/announcements                      announcements.view
 * GET  /admin/settings                           settings.manage
 *
 * POST /admin/users/create                       users.manage
 * POST /admin/users/ban|unban|disable|enable     users.manage
 * POST /admin/reports/:id                        reports.resolve   { resolution, delete_content }
 * POST /admin/verifications/:id                  verifications.review { resolution, admin_notes }
 * POST /admin/strikes/issue                      strikes.issue
 * POST /admin/strikes/unmute                     strikes.unmute
 * POST /admin/content/trash/:id                  content.moderate  (restaurar)
 * POST /admin/announcements                      announcements.manage { title, body }
 * POST /admin/announcements/:id/pin              announcements.manage
 *
 * PUT  /admin/settings                           settings.manage
 * PUT  /admin/users/:id                          users.manage { role?, is_verified? }
 *
 * DELETE /admin/reports/:id                      '*' (solo admin)
 * DELETE /admin/content/post/:id                 content.moderate  (soft-delete)
 * DELETE /admin/content/reel/:id                 content.moderate
 * DELETE /admin/content/trash/:id                '*' (purga irreversible, solo admin)
 * DELETE /admin/users/:id                        users.manage
 * DELETE /admin/announcements/:id                announcements.manage
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requirePerm } from '$lib/server/auth.js';
import { canGrantRole, canManageRole, getEffectiveRole, roleLabel } from '$lib/server/roles.js';
import { logAdminAction } from '$lib/server/audit.js';
import { resetTransporter } from '$lib/server/email.js';
import { createNotification } from '$lib/server/notifications.js';
import {
	validateUsername,
	validateEmail,
	validatePassword,
	sanitizeInput
} from '$lib/server/security.js';
import { parsePostMetadata, cleanPostBody } from '$lib/server/entities.js';
import bcrypt from 'bcryptjs';

/** Claves modificables de system_settings (whitelist anti-inyección de claves). */
const SETTINGS_WHITELIST = new Set([
	'site_name',
	'allow_registration',
	'require_invite_code',
	'max_upload_size_mb',
	'reels_enabled',
	'stories_enabled',
	'groups_enabled',
	'marketplace_enabled',
	'gamification_enabled',
	'platform_mode',
	'klipy_api_key',
	'tenor_api_key',
	'maintenance_mode',
	'demo_mode',
	'email_verification_required',
	'oauth_google_enabled',
	'oauth_apple_enabled',
	'smtp_host',
	'smtp_port',
	'smtp_user',
	'smtp_pass',
	'smtp_from',
	'vapid_public_key',
	'vapid_private_key'
]);

function clientIp(request) {
	return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
}

async function parseBody(request) {
	try {
		return await request.json();
	} catch {
		return {};
	}
}

function pageParams(url, defaultLimit = 20, maxLimit = 50) {
	const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
	const limit = Math.min(
		maxLimit,
		Math.max(1, parseInt(url.searchParams.get('limit')) || defaultLimit)
	);
	return { page, limit, offset: (page - 1) * limit };
}

/** Rol efectivo del usuario objetivo, para comprobaciones de jerarquía. */
async function targetRole(db, targetId) {
	return getEffectiveRole(db, targetId);
}

/** Bloquea actuar sobre uno mismo, sobre el admin principal (id 1) o sobre nivel ≥ al propio. */
async function assertCanTarget(db, actorId, actorRole, targetId, verb = 'modificar') {
	if (!Number.isInteger(targetId) || targetId <= 0) {
		return 'Usuario inválido';
	}
	if (targetId === actorId) return `No puedes ${verb} a ti mismo`;
	if (targetId === 1) return 'La cuenta principal del sistema no puede ser modificada';
	const tRole = await targetRole(db, targetId);
	if (!canManageRole(actorRole, tRole)) {
		return `No puedes ${verb} a un miembro del staff con rango ${roleLabel(tRole)}`;
	}
	return null;
}

export async function GET({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const sub = parts[1] || '';
	const db = getDb();

	// ─── Dashboard: KPIs generales ───────────────────────────────────────────
	if (action === 'dashboard') {
		await requirePerm(request, 'dashboard.view');

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
		const activeStrikes = (
			await db
				.prepare(
					"SELECT COUNT(*) as c FROM user_strikes WHERE expires_at IS NULL OR expires_at > datetime('now')"
				)
				.get()
		).c;
		const staffCount = (
			await db
				.prepare(
					`SELECT COUNT(DISTINCT u.id) as c FROM users u
					 WHERE COALESCE((SELECT role FROM user_roles WHERE user_id = u.id), u.role, 'user')
					 IN ('team', 'support', 'moderator', 'admin', 'super_admin')`
				)
				.get()
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
		for (const r of recentReports) {
			if (r.content_preview) r.content_preview = cleanPostBody(r.content_preview);
		}

		const weeklySignups = await db
			.prepare(
				`
			SELECT strftime('%w', created_at) as day, COUNT(*) as count
			FROM users WHERE created_at >= datetime('now', '-7 days')
			GROUP BY strftime('%w', created_at) ORDER BY day
		`
			)
			.all();

		const recentAnnouncements = await db
			.prepare(
				`SELECT a.*, u.username as author_name
				 FROM staff_announcements a LEFT JOIN users u ON a.author_id = u.id
				 ORDER BY a.pinned DESC, a.created_at DESC LIMIT 3`
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
				new_users_today: newUsersToday,
				active_strikes: activeStrikes,
				staff_count: staffCount
			},
			recent_reports: recentReports,
			weekly_signups: weeklySignups,
			announcements: recentAnnouncements
		});
	}

	// ─── Analytics: series temporales (solo admin) ───────────────────────────
	if (action === 'analytics') {
		await requirePerm(request, '*');

		const signups14d = await db
			.prepare(
				`SELECT date(created_at) as date, COUNT(*) as count
				 FROM users WHERE created_at >= datetime('now', '-14 days')
				 GROUP BY date(created_at) ORDER BY date`
			)
			.all();

		const posts7d = await db
			.prepare(
				`SELECT date(created_at) as date, COUNT(*) as count
				 FROM posts WHERE created_at >= datetime('now', '-7 days')
				 GROUP BY date(created_at) ORDER BY date`
			)
			.all();

		const reels7d = await db
			.prepare(
				`SELECT date(created_at) as date, COUNT(*) as count
				 FROM reels WHERE created_at >= datetime('now', '-7 days')
				 GROUP BY date(created_at) ORDER BY date`
			)
			.all();

		const topPosts = await db
			.prepare(
				`SELECT p.id, p.body, p.like_count, p.comment_count, u.username, u.avatar_url
				 FROM posts p JOIN users u ON p.user_id = u.id
				 WHERE p.deleted_at IS NULL AND p.created_at >= datetime('now', '-7 days')
				 ORDER BY p.like_count DESC LIMIT 5`
			)
			.all();
		for (const p of topPosts) {
			parsePostMetadata(p);
		}

		const reportsTrend = await db
			.prepare(
				`SELECT status, COUNT(*) as count FROM reports
				 WHERE created_at >= datetime('now', '-7 days') GROUP BY status`
			)
			.all();

		const roleDistribution = await db
			.prepare(
				`SELECT COALESCE((SELECT role FROM user_roles WHERE user_id = u.id), u.role, 'user') as role,
					COUNT(*) as count
				 FROM users u GROUP BY role ORDER BY count DESC`
			)
			.all();

		return json({
			success: true,
			signups_14d: signups14d,
			posts_7d: posts7d,
			reels_7d: reels7d,
			top_posts: topPosts,
			reports_trend: reportsTrend,
			role_distribution: roleDistribution
		});
	}

	// ─── Usuarios: lista paginada ────────────────────────────────────────────
	if (action === 'users' && !sub) {
		await requirePerm(request, 'users.view');
		const { page, limit, offset } = pageParams(url);
		const q = url.searchParams.get('q') || '';
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
				u.strike_count, u.muted_until,
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

	// ─── Usuario: ficha completa (perfil + sanciones + reportes + sesiones) ──
	if (action === 'users' && sub) {
		await requirePerm(request, 'users.view');
		const userId = parseInt(sub);
		if (!Number.isInteger(userId) || userId <= 0) {
			return json({ error: 'ID de usuario inválido' }, { status: 400 });
		}

		const user = await db
			.prepare(
				`
			SELECT u.id, u.username, u.display_name, u.email, u.avatar_url, u.cover_url, u.bio,
				u.role, u.is_verified, u.is_banned, u.is_active, u.created_at, u.last_seen_at,
				u.follower_count, u.post_count, u.strike_count, u.muted_until, u.reputation_score,
				COALESCE((SELECT role FROM user_roles WHERE user_id = u.id), u.role, 'user') as effective_role,
				(SELECT COUNT(*) FROM user_sessions s WHERE s.user_id = u.id) as active_sessions
			FROM users u WHERE u.id = ?
		`
			)
			.get(userId);
		if (!user) return json({ error: 'Usuario no encontrado' }, { status: 404 });

		const strikes = await db
			.prepare(
				`SELECT s.*, a.username as issuer_name FROM user_strikes s
				 LEFT JOIN users a ON s.issued_by = a.id
				 WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 20`
			)
			.all(userId);

		const reportsAgainst = await db
			.prepare(
				`SELECT r.*, ru.username as reporter_name FROM reports r
				 LEFT JOIN users ru ON r.reporter_id = ru.id
				 WHERE r.entity_type = 'user' AND r.entity_id = ?
				 ORDER BY r.created_at DESC LIMIT 10`
			)
			.all(userId);

		return json({ success: true, user, strikes, reports_against: reportsAgainst });
	}

	// ─── Reportes: lista paginada ────────────────────────────────────────────
	if (action === 'reports') {
		await requirePerm(request, 'reports.view');
		const { page, limit, offset } = pageParams(url, 20, 50);
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
		const where = whereClauses.join(' AND ');

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
			WHERE ${where}
			ORDER BY r.created_at DESC LIMIT ? OFFSET ?
		`
			)
			.all(...vals, limit, offset);

		const total = (
			await db
				.prepare(
					`SELECT COUNT(*) as c FROM reports r LEFT JOIN users u ON r.reporter_id = u.id WHERE ${where}`
				)
				.get(...vals)
		).c;
		for (const r of reports) {
			if (r.content_preview) r.content_preview = cleanPostBody(r.content_preview);
		}
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
			total,
			page,
			limit,
			stats: {
				pending: pendingCount,
				resolved: resolvedCount,
				dismissed: dismissedCount,
				total: pendingCount + resolvedCount + dismissedCount
			}
		});
	}

	// ─── Contenido: posts/reels/papelera con media y paginación ──────────────
	if (action === 'content') {
		await requirePerm(request, 'content.view');
		const type = url.searchParams.get('type') || 'posts';
		const { page, limit, offset } = pageParams(url, 20, 50);

		let content = [];
		let total = 0;
		if (type === 'posts') {
			content = await db
				.prepare(
					`
				SELECT p.id, p.user_id, p.body, p.like_count, p.comment_count, p.created_at,
					u.username, u.avatar_url,
					(SELECT pm.media_url FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.position, pm.id LIMIT 1) as media,
					(SELECT pm.media_type FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.position, pm.id LIMIT 1) as media_type,
					(SELECT COUNT(*) FROM post_media pm WHERE pm.post_id = p.id) as media_count
				FROM posts p JOIN users u ON p.user_id = u.id
				WHERE p.deleted_at IS NULL
				ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
				)
				.all(limit, offset);
			total = (await db.prepare('SELECT COUNT(*) as c FROM posts WHERE deleted_at IS NULL').get())
				.c;
		} else if (type === 'reels') {
			content = await db
				.prepare(
					`
				SELECT r.id, r.user_id, r.caption as body, r.like_count, r.created_at,
					u.username, u.avatar_url, r.video_url as media, 'video' as media_type
				FROM reels r JOIN users u ON r.user_id = u.id
				ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
				)
				.all(limit, offset);
			total = (await db.prepare('SELECT COUNT(*) as c FROM reels').get()).c;
		} else if (type === 'trash') {
			content = await db
				.prepare(
					`
				SELECT p.id, p.user_id, p.body, p.like_count, p.created_at, p.deleted_at,
					u.username, u.avatar_url,
					(SELECT pm.media_url FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.position, pm.id LIMIT 1) as media,
					(SELECT pm.media_type FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.position, pm.id LIMIT 1) as media_type
				FROM posts p JOIN users u ON p.user_id = u.id
				WHERE p.deleted_at IS NOT NULL
				ORDER BY p.deleted_at DESC LIMIT ? OFFSET ?`
				)
				.all(limit, offset);
			total = (
				await db.prepare('SELECT COUNT(*) as c FROM posts WHERE deleted_at IS NOT NULL').get()
			).c;
		} else {
			return json({ error: 'Tipo de contenido no válido' }, { status: 400 });
		}

		for (const item of content) {
			if (type === 'posts' || type === 'trash') {
				parsePostMetadata(item);
			}
		}

		return json({ success: true, content, total, page, limit });
	}

	// ─── Configuración del sistema ───────────────────────────────────────────
	if (action === 'settings') {
		await requirePerm(request, 'settings.manage');
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

	// ─── Verificaciones de autoría ───────────────────────────────────────────
	if (action === 'verifications') {
		await requirePerm(request, 'verifications.view');
		const { page, limit, offset } = pageParams(url, 20, 50);
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
		const where = whereClauses.join(' AND ');

		const verifications = await db
			.prepare(
				`
			SELECT vr.*,
			       u.username, u.display_name, u.avatar_url, u.email as user_email,
			       u.created_at as user_created_at, u.follower_count as user_follower_count,
			       u.post_count as user_post_count, u.is_verified as user_is_verified,
			       admin.username as reviewer_name
			FROM verification_requests vr
			JOIN users u ON vr.user_id = u.id
			LEFT JOIN users admin ON vr.reviewed_by = admin.id
			WHERE ${where}
			ORDER BY vr.created_at DESC LIMIT ? OFFSET ?
		`
			)
			.all(...vals, limit, offset);

		const total = (
			await db
				.prepare(
					`SELECT COUNT(*) as c FROM verification_requests vr JOIN users u ON vr.user_id = u.id WHERE ${where}`
				)
				.get(...vals)
		).c;
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
			total,
			page,
			limit,
			stats: {
				pending: pendingCount,
				reviewing: reviewingCount,
				approved: approvedCount,
				rejected: rejectedCount,
				total: pendingCount + reviewingCount + approvedCount + rejectedCount
			}
		});
	}

	// ─── Sanciones ───────────────────────────────────────────────────────────
	if (action === 'strikes') {
		await requirePerm(request, 'strikes.view');
		const { page, limit, offset } = pageParams(url, 20, 50);
		const q = (url.searchParams.get('q') || url.searchParams.get('user_id') || '')
			.trim()
			.replace(/^@/, '');
		let where = '';
		const vals = [];
		if (q !== '') {
			const targetUserId = parseInt(q);
			if (!Number.isNaN(targetUserId) && String(targetUserId) === q) {
				where = ' WHERE (s.user_id = ? OR u.username LIKE ?)';
				vals.push(targetUserId, `%${q}%`);
			} else {
				where = ' WHERE u.username LIKE ?';
				vals.push(`%${q}%`);
			}
		}
		const strikes = await db
			.prepare(
				`
			SELECT s.*, u.username as target_username, u.avatar_url as target_avatar, admin.username as issuer_name
			FROM user_strikes s
			JOIN users u ON s.user_id = u.id
			LEFT JOIN users admin ON s.issued_by = admin.id${where}
			ORDER BY s.created_at DESC LIMIT ? OFFSET ?`
			)
			.all(...vals, limit, offset);
		const countSql = where
			? `SELECT COUNT(*) as c FROM user_strikes s JOIN users u ON s.user_id = u.id${where}`
			: `SELECT COUNT(*) as c FROM user_strikes s`;
		const total = (await db.prepare(countSql).get(...vals)).c;
		return json({ success: true, strikes, total, page, limit });
	}

	// ─── Auditoría (solo admin) ──────────────────────────────────────────────
	if (action === 'audit') {
		await requirePerm(request, '*');
		const { page, limit, offset } = pageParams(url, 30, 100);
		const actor = url.searchParams.get('actor') || '';
		const filterAction = url.searchParams.get('action') || '';
		const q = url.searchParams.get('q') || '';

		let whereClauses = ['1=1'];
		const vals = [];
		if (actor) {
			whereClauses.push('l.actor_id = ?');
			vals.push(parseInt(actor) || 0);
		}
		if (filterAction) {
			whereClauses.push('l.action = ?');
			vals.push(filterAction);
		}
		if (q) {
			whereClauses.push(
				'(l.action LIKE ? OR l.entity_type LIKE ? OR l.entity_id LIKE ? OR au.username LIKE ?)'
			);
			vals.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
		}
		const where = whereClauses.join(' AND ');

		const logs = await db
			.prepare(
				`
			SELECT l.*, au.username as actor_name, au.avatar_url as actor_avatar, au.role as actor_base_role
			FROM admin_audit_logs l
			LEFT JOIN users au ON l.actor_id = au.id
			WHERE ${where}
			ORDER BY l.created_at DESC, l.id DESC LIMIT ? OFFSET ?`
			)
			.all(...vals, limit, offset);
		const total = (
			await db
				.prepare(
					`SELECT COUNT(*) as c FROM admin_audit_logs l LEFT JOIN users au ON l.actor_id = au.id WHERE ${where}`
				)
				.get(...vals)
		).c;
		return json({ success: true, logs, total, page, limit });
	}

	// ─── Anuncios internos del staff ─────────────────────────────────────────
	if (action === 'announcements') {
		await requirePerm(request, 'announcements.view');
		const announcements = await db
			.prepare(
				`SELECT a.*, u.username as author_name, u.avatar_url as author_avatar
				 FROM staff_announcements a LEFT JOIN users u ON a.author_id = u.id
				 ORDER BY a.pinned DESC, a.created_at DESC LIMIT 50`
			)
			.all();
		return json({ success: true, announcements });
	}

	return json({ error: 'Admin endpoint not found' }, { status: 404 });
}

export async function POST({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subaction = parts[1] || '';
	const db = getDb();
	const ip = clientIp(request);

	// ─── Crear usuario ───────────────────────────────────────────────────────
	if (action === 'users' && subaction === 'create') {
		const { userId, role: actorRole } = await requirePerm(request, 'users.manage');
		const body = await parseBody(request);
		const { username, email, password, role } = body;

		if (!username || !email || !password) {
			return json({ error: 'Faltan campos requeridos' }, { status: 400 });
		}
		if (!validateUsername(username)) {
			return json(
				{ error: 'Nombre de usuario inválido (3-20 caracteres alfanuméricos)' },
				{ status: 400 }
			);
		}
		if (!validateEmail(email)) {
			return json({ error: 'Email inválido' }, { status: 400 });
		}
		if (!validatePassword(password)) {
			return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
		}
		const userRole = role || 'user';
		if (userRole !== 'user' && !canGrantRole(actorRole, userRole)) {
			return json(
				{ error: `No puedes crear cuentas con rango ${roleLabel(userRole)}` },
				{ status: 403 }
			);
		}

		const existingUser = await db
			.prepare('SELECT id FROM users WHERE username = ? OR email = ?')
			.get(username, email);
		if (existingUser) return json({ error: 'El usuario o email ya existe' }, { status: 400 });

		const passwordHash = await bcrypt.hash(password, 10);
		const result = await db
			.prepare(
				`
			INSERT INTO users (username, email, password_hash, display_name, role, is_verified, is_active, is_banned)
			VALUES (?, ?, ?, ?, ?, 0, 1, 0)
		`
			)
			.run(username, email, passwordHash, username, userRole);

		const newUserId = result.lastInsertRowid;
		if (userRole !== 'user') {
			await db
				.prepare('INSERT INTO user_roles (user_id, role) VALUES (?, ?)')
				.run(newUserId, userRole);
		}

		await logAdminAction(
			userId,
			'user.create',
			'user',
			newUserId,
			{ username, role: userRole },
			ip
		);
		return json({ success: true, message: 'Usuario creado exitosamente', user_id: newUserId });
	}

	// ─── Ban / Unban / Disable / Enable ──────────────────────────────────────
	if (action === 'users' && ['ban', 'unban', 'disable', 'enable'].includes(subaction)) {
		const { userId, role: actorRole } = await requirePerm(request, 'users.manage');
		const body = await parseBody(request);
		const targetId = parseInt(body.user_id);
		const err = await assertCanTarget(
			db,
			userId,
			actorRole,
			targetId,
			subaction === 'ban' ? 'banear' : 'modificar'
		);
		if (err) return json({ error: err }, { status: 400 });

		if (subaction === 'ban') {
			const reason = sanitizeInput(String(body.reason || 'Infracción de las reglas.')).slice(
				0,
				300
			);
			await db.prepare('UPDATE users SET is_banned = 1, is_active = 0 WHERE id = ?').run(targetId);
			await db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(targetId);
			await createNotification(db, {
				recipientId: targetId,
				actorId: userId,
				type: 'ban',
				message: 'Tu cuenta ha sido suspendida: ' + reason
			});
			await logAdminAction(userId, 'user.ban', 'user', targetId, { reason }, ip);
			return json({ success: true, message: 'Usuario baneado' });
		}

		if (subaction === 'unban') {
			await db.prepare('UPDATE users SET is_banned = 0, is_active = 1 WHERE id = ?').run(targetId);
			await logAdminAction(userId, 'user.unban', 'user', targetId, null, ip);
			return json({ success: true, message: 'Usuario desbaneado' });
		}

		if (subaction === 'disable') {
			await db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(targetId);
			await db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(targetId);
			await logAdminAction(userId, 'user.disable', 'user', targetId, null, ip);
			return json({ success: true, message: 'Usuario deshabilitado' });
		}

		// enable
		await db.prepare('UPDATE users SET is_active = 1 WHERE id = ? AND is_banned = 0').run(targetId);
		await logAdminAction(userId, 'user.enable', 'user', targetId, null, ip);
		return json({ success: true, message: 'Usuario habilitado' });
	}

	// ─── Resolver / descartar reporte ────────────────────────────────────────
	if (action === 'reports' && subaction) {
		const { userId } = await requirePerm(request, 'reports.resolve');
		const reportId = parseInt(subaction);
		if (!Number.isInteger(reportId) || reportId <= 0) {
			return json({ error: 'ID de reporte inválido' }, { status: 400 });
		}
		const body = await parseBody(request);
		const resolution = body.resolution;
		if (!['resolved', 'dismissed'].includes(resolution)) {
			return json({ error: 'Resolución no válida (resolved | dismissed)' }, { status: 400 });
		}

		const report = await db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
		if (!report) return json({ error: 'Reporte no encontrado' }, { status: 404 });

		await db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(resolution, reportId);

		let contentDeleted = false;
		if (resolution === 'resolved' && body.delete_content) {
			const entityType = body.entity_type || report.entity_type;
			const entityId = parseInt(body.entity_id || report.entity_id);
			// Soft-delete (reversible desde la papelera de contenido), nunca DELETE duro.
			if (entityType === 'post' && entityId) {
				await db
					.prepare(
						"UPDATE posts SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL"
					)
					.run(entityId);
				contentDeleted = true;
			} else if (entityType === 'comment' && entityId) {
				await db
					.prepare(
						"UPDATE comments SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL"
					)
					.run(entityId);
				contentDeleted = true;
			}
		}

		await logAdminAction(
			userId,
			'report.resolve',
			'report',
			reportId,
			{
				resolution,
				delete_content: contentDeleted,
				entity_type: report.entity_type,
				entity_id: report.entity_id
			},
			ip
		);
		return json({
			success: true,
			message: resolution === 'resolved' ? 'Reporte resuelto' : 'Reporte descartado'
		});
	}

	// ─── Revisar verificación ────────────────────────────────────────────────
	if (action === 'verifications' && subaction) {
		const { userId } = await requirePerm(request, 'verifications.review');
		const reqId = parseInt(subaction);
		if (!Number.isInteger(reqId)) return json({ error: 'ID inválido' }, { status: 400 });
		const body = await parseBody(request);
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
				.run(admin_notes || null, userId, reqId);

			await db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(vReq.user_id);

			await createNotification(db, {
				recipientId: vReq.user_id,
				actorId: userId,
				type: 'verification_approved',
				message: '¡Felicidades! Tu solicitud de verificación ha sido aprobada.'
			});

			if (globalThis.io) {
				globalThis.io
					.to(`user_${vReq.user_id}`)
					.emit('verification_status_change', { status: 'approved' });
			}
		} else if (resolution === 'rejected') {
			await db
				.prepare(
					`UPDATE verification_requests
					 SET status = 'rejected', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now')
					 WHERE id = ?`
				)
				.run(admin_notes || 'No cumple los requisitos mínimos.', userId, reqId);

			await createNotification(db, {
				recipientId: vReq.user_id,
				actorId: userId,
				type: 'verification_rejected',
				message: `Tu solicitud de verificación ha sido rechazada: ${admin_notes || 'No cumple los requisitos de autoría.'}`
			});

			if (globalThis.io) {
				globalThis.io
					.to(`user_${vReq.user_id}`)
					.emit('verification_status_change', { status: 'rejected' });
			}
		} else if (resolution === 'reviewing') {
			await db
				.prepare(
					`UPDATE verification_requests SET status = 'reviewing', admin_notes = ?, reviewed_by = ? WHERE id = ?`
				)
				.run(admin_notes || null, userId, reqId);
		} else {
			return json({ error: 'Resolución no válida' }, { status: 400 });
		}

		await logAdminAction(userId, 'verification.review', 'verification', reqId, { resolution }, ip);
		return json({
			success: true,
			message:
				resolution === 'approved'
					? 'Solicitud aprobada y usuario verificado'
					: resolution === 'rejected'
						? 'Solicitud rechazada'
						: 'Solicitud marcada en revisión'
		});
	}

	// ─── Emitir sanción ──────────────────────────────────────────────────────
	if (action === 'strikes' && subaction === 'issue') {
		const { userId, role: actorRole } = await requirePerm(request, 'strikes.issue');
		const body = await parseBody(request);
		const { user_id, strike_level, reason, report_id } = body;
		const targetId = parseInt(user_id);
		const err = await assertCanTarget(db, userId, actorRole, targetId, 'sancionar');
		if (err) return json({ error: err }, { status: 400 });

		const cleanReason = sanitizeInput(String(reason || '')).trim();
		if (!cleanReason) {
			return json({ error: 'Debe especificar un motivo para la sanción' }, { status: 400 });
		}

		const level = parseInt(strike_level);
		if (![1, 2, 3, 4].includes(level)) {
			return json({ error: 'Nivel de sanción inválido (1-4)' }, { status: 400 });
		}

		if (report_id) {
			const report = await db
				.prepare('SELECT id FROM reports WHERE id = ?')
				.get(parseInt(report_id));
			if (!report) return json({ error: 'El reporte vinculado no existe' }, { status: 400 });
		}

		let actionTaken = 'warning';
		let expiresAt = null;

		if (level === 1) {
			actionTaken = 'warning';
			await createNotification(db, {
				recipientId: targetId,
				actorId: userId,
				type: 'warning',
				message: `Advertencia oficial de moderación: ${cleanReason}`
			});
		} else if (level === 2) {
			actionTaken = 'timeout';
			await db
				.prepare("UPDATE users SET muted_until = datetime('now', '+24 hours') WHERE id = ?")
				.run(targetId);
			expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
			await createNotification(db, {
				recipientId: targetId,
				actorId: userId,
				type: 'timeout',
				message: `Tu cuenta ha sido silenciada por 24 horas: ${cleanReason}`
			});
		} else if (level === 3) {
			actionTaken = 'temp_ban';
			await db
				.prepare(
					"UPDATE users SET muted_until = datetime('now', '+7 days'), is_active = 0 WHERE id = ?"
				)
				.run(targetId);
			await db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(targetId);
			expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
			await createNotification(db, {
				recipientId: targetId,
				actorId: userId,
				type: 'temp_ban',
				message: `Tu cuenta ha sido suspendida por 7 días: ${cleanReason}`
			});
		} else if (level === 4) {
			actionTaken = 'perm_ban';
			await db.prepare('UPDATE users SET is_banned = 1, is_active = 0 WHERE id = ?').run(targetId);
			await db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(targetId);
			await createNotification(db, {
				recipientId: targetId,
				actorId: userId,
				type: 'perm_ban',
				message: 'Tu cuenta ha sido suspendida permanentemente: ' + cleanReason
			});
		}

		await db
			.prepare(
				`INSERT INTO user_strikes (user_id, issued_by, strike_level, action_taken, reason, report_id, expires_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.run(targetId, userId, level, actionTaken, cleanReason, report_id || null, expiresAt);

		await db.prepare('UPDATE users SET strike_count = strike_count + 1 WHERE id = ?').run(targetId);

		if (report_id) {
			await db
				.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?")
				.run(parseInt(report_id));
		}

		await logAdminAction(
			userId,
			'strike.issue',
			'strike',
			targetId,
			{ level, action_taken: actionTaken, reason: cleanReason, report_id: report_id || null },
			ip
		);
		return json({ success: true, message: `Sanción aplicada (${actionTaken})` });
	}

	// ─── Levantar silencio ───────────────────────────────────────────────────
	if (action === 'strikes' && subaction === 'unmute') {
		const { userId } = await requirePerm(request, 'strikes.unmute');
		const body = await parseBody(request);
		const targetId = parseInt(body.user_id);
		if (!Number.isInteger(targetId) || targetId <= 0) {
			return json({ error: 'Usuario inválido' }, { status: 400 });
		}
		await db.prepare('UPDATE users SET muted_until = NULL WHERE id = ?').run(targetId);
		await createNotification(db, {
			recipientId: targetId,
			actorId: userId,
			type: 'system',
			message: 'Tu silencio ha sido levantado por el equipo de moderación.'
		});
		await logAdminAction(userId, 'strike.unmute', 'user', targetId, null, ip);
		return json({ success: true, message: 'Silencio levantado' });
	}

	// ─── Restaurar contenido de la papelera ──────────────────────────────────
	if (action === 'content' && subaction === 'trash') {
		const { userId } = await requirePerm(request, 'content.moderate');
		const id = parseInt(parts[2] || '0');
		if (!Number.isInteger(id) || id <= 0) return json({ error: 'ID inválido' }, { status: 400 });
		await db.prepare('UPDATE posts SET deleted_at = NULL WHERE id = ?').run(id);
		await logAdminAction(userId, 'content.restore', 'post', id, null, ip);
		return json({ success: true, message: 'Post restaurado' });
	}

	// ─── Anuncios internos ───────────────────────────────────────────────────
	if (action === 'announcements' && !subaction) {
		const { userId } = await requirePerm(request, 'announcements.manage');
		const body = await parseBody(request);
		const title = sanitizeInput(String(body.title || '')).trim();
		const content = sanitizeInput(String(body.body || '')).trim();
		if (!title || !content) {
			return json({ error: 'Título y cuerpo son obligatorios' }, { status: 400 });
		}
		const result = await db
			.prepare('INSERT INTO staff_announcements (author_id, title, body) VALUES (?, ?, ?)')
			.run(userId, title.slice(0, 160), content.slice(0, 4000));
		await logAdminAction(
			userId,
			'announcement.create',
			'announcement',
			result.lastInsertRowid,
			{ title },
			ip
		);
		return json({ success: true, message: 'Anuncio publicado' });
	}

	if (action === 'announcements' && parts[2] === 'pin') {
		const { userId } = await requirePerm(request, 'announcements.manage');
		const id = parseInt(subaction);
		if (!Number.isInteger(id) || id <= 0) return json({ error: 'ID inválido' }, { status: 400 });
		const existing = await db
			.prepare('SELECT id, pinned FROM staff_announcements WHERE id = ?')
			.get(id);
		if (!existing) return json({ error: 'Anuncio no encontrado' }, { status: 404 });
		await db
			.prepare(
				"UPDATE staff_announcements SET pinned = ?, updated_at = datetime('now') WHERE id = ?"
			)
			.run(existing.pinned ? 0 : 1, id);
		await logAdminAction(
			userId,
			'announcement.pin',
			'announcement',
			id,
			{ pinned: !existing.pinned },
			ip
		);
		return json({
			success: true,
			message: existing.pinned ? 'Anuncio desfijado' : 'Anuncio fijado'
		});
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function PUT({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subId = parts[1] || '';
	const db = getDb();
	const ip = clientIp(request);

	// ─── Guardar configuración (whitelist de claves) ─────────────────────────
	if (action === 'settings') {
		const { userId } = await requirePerm(request, 'settings.manage');
		const body = await parseBody(request);
		const changed = {};
		for (const [key, value] of Object.entries(body)) {
			if (!SETTINGS_WHITELIST.has(key)) continue;
			await db
				.prepare(
					'INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
				)
				.run(key, typeof value === 'string' ? value : JSON.stringify(value));
			changed[key] = typeof value === 'string' ? value : JSON.stringify(value);
		}
		if (!Object.keys(changed).length) {
			return json({ error: 'Ninguna clave válida para actualizar' }, { status: 400 });
		}
		// Cambios SMTP: invalidar el transporter cacheado del motor de email.
		if (Object.keys(changed).some((k) => k.startsWith('smtp_'))) {
			resetTransporter();
		}
		if (globalThis.io) {
			globalThis.io.emit('global_settings_update');
		}
		await logAdminAction(
			userId,
			'settings.update',
			'settings',
			null,
			{ keys: Object.keys(changed) },
			ip
		);
		return json({ success: true, message: 'Configuración guardada' });
	}

	// ─── Editar usuario (rol / verificación) ─────────────────────────────────
	if (action === 'users' && subId) {
		const { userId, role: actorRole } = await requirePerm(request, 'users.manage');
		const targetId = parseInt(subId);
		if (!Number.isInteger(targetId) || targetId <= 0) {
			return json({ error: 'ID de usuario inválido' }, { status: 400 });
		}
		const body = await parseBody(request);

		const existing = await db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
		if (!existing) return json({ error: 'Usuario no encontrado' }, { status: 404 });

		const updates = [];
		const vals = [];
		const auditDetails = {};

		if ('role' in body) {
			const newRole = body.role;
			if (!canGrantRole(actorRole, newRole)) {
				return json({ error: `No puedes asignar el rango ${roleLabel(newRole)}` }, { status: 403 });
			}
			if (targetId === userId) {
				return json({ error: 'No puedes cambiar tu propio rol' }, { status: 400 });
			}
			if (targetId === 1) {
				return json(
					{ error: 'El rol de la cuenta principal no puede modificarse' },
					{ status: 400 }
				);
			}
			const currentRole = await getEffectiveRole(db, targetId);
			if (!canManageRole(actorRole, currentRole)) {
				return json(
					{
						error: `No puedes modificar a un miembro del staff con rango ${roleLabel(currentRole)}`
					},
					{ status: 403 }
				);
			}

			updates.push('role = ?');
			vals.push(newRole);
			auditDetails.role = { from: currentRole, to: newRole };

			// Normaliza user_roles: una única fila con el rol efectivo nuevo.
			await db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(targetId);
			if (newRole !== 'user') {
				await db
					.prepare('INSERT INTO user_roles (user_id, role) VALUES (?, ?)')
					.run(targetId, newRole);
			}
		}

		if ('is_verified' in body) {
			updates.push('is_verified = ?');
			vals.push(body.is_verified ? 1 : 0);
			auditDetails.is_verified = body.is_verified ? 1 : 0;
		}

		if (!updates.length) return json({ error: 'Nada que actualizar' }, { status: 400 });

		vals.push(targetId);
		await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...vals);

		await logAdminAction(userId, 'user.update', 'user', targetId, auditDetails, ip);
		return json({ success: true, message: 'Usuario actualizado' });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function DELETE({ request, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subId = parts[1] || '';
	const subId2 = parts[2] || '';
	const db = getDb();
	const ip = clientIp(request);

	// ─── Eliminar reporte (purga de evidencia — solo admin) ──────────────────
	if (action === 'reports' && subId) {
		const { userId } = await requirePerm(request, '*');
		const id = parseInt(subId);
		if (!Number.isInteger(id)) return json({ error: 'ID inválido' }, { status: 400 });
		await db.prepare('DELETE FROM reports WHERE id = ?').run(id);
		await logAdminAction(userId, 'report.delete', 'report', id, null, ip);
		return json({ success: true, message: 'Reporte eliminado' });
	}

	// ─── Eliminar contenido ──────────────────────────────────────────────────
	if (action === 'content' && subId && subId2) {
		const type = subId;
		const id = parseInt(subId2);
		if (!Number.isInteger(id) || id <= 0) return json({ error: 'ID inválido' }, { status: 400 });

		// La purga definitiva de la papelera borra datos: solo admin.
		if (type === 'trash') {
			const { userId } = await requirePerm(request, '*');
			await db.prepare('DELETE FROM posts WHERE id = ?').run(id);
			await logAdminAction(userId, 'content.purge', 'post', id, null, ip);
			return json({ success: true, message: 'Post purgado definitivamente' });
		}

		const { userId } = await requirePerm(request, 'content.moderate');
		if (type === 'post') {
			await db.prepare("UPDATE posts SET deleted_at = datetime('now') WHERE id = ?").run(id);
			await logAdminAction(userId, 'content.delete', 'post', id, null, ip);
		} else if (type === 'reel') {
			await db.prepare('DELETE FROM reels WHERE id = ?').run(id);
			await logAdminAction(userId, 'content.delete', 'reel', id, null, ip);
		} else {
			return json({ error: 'Tipo de contenido no válido' }, { status: 400 });
		}
		return json({ success: true, message: 'Contenido eliminado' });
	}

	// ─── Eliminar usuario ────────────────────────────────────────────────────
	if (action === 'users' && subId) {
		const { userId, role: actorRole } = await requirePerm(request, 'users.manage');
		const targetId = parseInt(subId);
		const err = await assertCanTarget(db, userId, actorRole, targetId, 'eliminar');
		if (err) return json({ error: err }, { status: 400 });

		await db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
		await logAdminAction(userId, 'user.delete', 'user', targetId, null, ip);
		return json({ success: true, message: 'Usuario eliminado' });
	}

	// ─── Eliminar anuncio ────────────────────────────────────────────────────
	if (action === 'announcements' && subId) {
		const { userId } = await requirePerm(request, 'announcements.manage');
		const id = parseInt(subId);
		if (!Number.isInteger(id) || id <= 0) return json({ error: 'ID inválido' }, { status: 400 });
		await db.prepare('DELETE FROM staff_announcements WHERE id = ?').run(id);
		await logAdminAction(userId, 'announcement.delete', 'announcement', id, null, ip);
		return json({ success: true, message: 'Anuncio eliminado' });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}
