/**
 * VSocial — Users API
 * GET    /api/users/me, /api/users/suggested, /api/users/search, /api/users/settings
 * GET    /api/users/:username, /api/users/:username/followers, /api/users/:username/following, /api/users/:username/posts, /api/users/:username/reposts
 * POST   /api/users/:username/follow, /api/users/avatar, /api/users/cover
 * DELETE /api/users/:username/follow
 * PUT    /api/users/profile, /api/users/me, /api/users/settings
 * PATCH  /api/users/notifications/read-all, /api/users/notifications/:id/read
 */
import { json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { getDb, getUploadsDir } from '$lib/server/db.js';
import { requireAuth, optionalAuth } from '$lib/server/auth.js';
import { awardXP } from '$lib/server/gamification.js';
import { anonymizePost } from '$lib/server/security.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

function parsePostMetadata(post) {
	if (!post) return;
	const body = post.body || '';
	const idx = body.indexOf('\n[METADATA]');
	if (idx !== -1) {
		post.body = body.slice(0, idx).trim();
		post.content = post.body;
		try {
			const metaStr = body.slice(idx + 11).trim();
			const meta = JSON.parse(metaStr);
			if (meta.poll) {
				post.poll = meta.poll;
			}
			if (meta.location) {
				post.location = meta.location;
			}
		} catch (e) {
			console.error('Failed to parse post metadata:', e);
		}
	}
}

async function fetchPostMedia(db, postIds) {
	if (!postIds.length) return {};
	const ph = postIds.map(() => '?').join(',');
	const rows = await db
		.prepare(`SELECT post_id, id, media_type, media_url FROM post_media WHERE post_id IN (${ph})`)
		.all(...postIds);
	const map = {};
	for (const m of rows) {
		if (!map[m.post_id]) map[m.post_id] = [];
		map[m.post_id].push(m);
	}
	return map;
}

export async function GET({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subaction = parts[1] || '';
	const db = getDb();

	// ── /api/users/export — exportación de datos del usuario en JSON (RGPD art. 20 portabilidad) ──
	if (action === 'export' && !subaction) {
		const userId = await requireAuth(request);
		const data = {};

		// Perfil (sin password_hash)
		data.profile = await db
			.prepare(
				`
			SELECT id, username, email, display_name, avatar_url, cover_url, bio, location, website,
				education, workplace, phone, birth_date, gender, relationship_status, category,
				privacy_level, created_at, last_seen_at, terms_accepted_at, privacy_accepted_at
			FROM users WHERE id = ?
		`
			)
			.get(userId);

		// Ajustes y preferencias
		data.settings = await db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);

		// Publicaciones + multimedia asociada
		data.posts = await db
			.prepare('SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC')
			.all(userId);
		if (data.posts.length) {
			const postIds = data.posts.map((p) => p.id);
			const ph = postIds.map(() => '?').join(',');
			const media = await db
				.prepare(
					`SELECT post_id, id, media_type, media_url FROM post_media WHERE post_id IN (${ph})`
				)
				.all(...postIds);
			const mediaMap = {};
			for (const m of media) {
				(mediaMap[m.post_id] ||= []).push(m);
			}
			for (const p of data.posts) {
				p.media = mediaMap[p.id] || [];
			}
		}

		// Comentarios
		data.comments = await db
			.prepare(
				'SELECT id, post_id, parent_id, body, like_count, created_at FROM comments WHERE user_id = ? ORDER BY created_at DESC'
			)
			.all(userId);

		// Mensajes: messages_new no guarda receptor directo; lo resolvemos vía conversation_participants
		data.messages = await db
			.prepare(
				`
			SELECT m.id, m.conversation_id, m.sender_id, m.body, m.voice_url, m.media_url, m.media_type,
				m.reply_to_id, m.is_deleted, m.created_at,
				(SELECT group_concat(user_id) FROM conversation_participants cp
					WHERE cp.conversation_id = m.conversation_id AND cp.user_id != m.sender_id) AS other_participants
			FROM messages_new m
			WHERE m.sender_id = ?
			ORDER BY m.created_at DESC
		`
			)
			.all(userId);

		// Reacciones a publicaciones
		data.reactions = await db
			.prepare(
				'SELECT post_id, reaction, created_at FROM post_reactions WHERE user_id = ? ORDER BY created_at DESC'
			)
			.all(userId);

		// Grafo social
		data.follows = {
			following: await db
				.prepare(
					'SELECT following_id, created_at FROM follows WHERE follower_id = ? ORDER BY created_at DESC'
				)
				.all(userId),
			followers: await db
				.prepare(
					'SELECT follower_id, created_at FROM follows WHERE following_id = ? ORDER BY created_at DESC'
				)
				.all(userId)
		};

		// Stories y reels
		data.stories = await db
			.prepare(
				'SELECT id, media_url, media_type, caption, view_count, expires_at, created_at FROM stories WHERE user_id = ? ORDER BY created_at DESC'
			)
			.all(userId);
		data.reels = await db
			.prepare(
				'SELECT id, video_url, thumbnail_url, caption, view_count, like_count, created_at FROM reels WHERE user_id = ? ORDER BY created_at DESC'
			)
			.all(userId);

		// Marketplace y gigs
		data.marketplace_listings = await db
			.prepare('SELECT * FROM marketplace_listings WHERE user_id = ? ORDER BY created_at DESC')
			.all(userId);
		data.gigs = await db
			.prepare('SELECT * FROM gigs WHERE user_id = ? ORDER BY created_at DESC')
			.all(userId);

		// Notificaciones recibidas
		data.notifications = await db
			.prepare(
				'SELECT id, type, entity_type, entity_id, message, is_read, created_at FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC'
			)
			.all(userId);

		// Registro de actividad
		data.activity_logs = await db
			.prepare(
				'SELECT id, action_type, entity_type, entity_id, metadata, created_at FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC'
			)
			.all(userId);

		// Check-ins (geolocalización — dato sensible)
		data.check_ins = await db
			.prepare(
				'SELECT id, latitude, longitude, place_name, note, created_at FROM check_ins WHERE user_id = ? ORDER BY created_at DESC'
			)
			.all(userId);

		// OAuth: omitir access_token/refresh_token (secretos)
		data.oauth_accounts = await db
			.prepare(
				'SELECT id, provider, provider_uid, email, display_name, created_at FROM oauth_accounts WHERE user_id = ?'
			)
			.all(userId);

		data.exported_at = new Date().toISOString();

		const profile = data.profile || {};
		const username = profile.username || String(userId);
		const jsonStr = JSON.stringify(data, null, 2);
		const filename = `vsocial_export_${username}_${Date.now()}.json`;
		return new Response(jsonStr, {
			status: 200,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Cache-Control': 'no-store'
			}
		});
	}

	// ── /api/users/me ──
	if (action === 'me') {
		const userId = await requireAuth(request);
		const user = await db
			.prepare(
				`
			SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.cover_url,
				u.bio, u.location, u.website, u.category, u.is_verified, u.is_virtual,
				(SELECT COUNT(*) FROM follows f JOIN users u2 ON f.follower_id = u2.id WHERE f.following_id = u.id AND u2.is_active = 1 AND u2.is_banned = 0) AS follower_count, 
				(SELECT COUNT(*) FROM follows f JOIN users u2 ON f.following_id = u2.id WHERE f.follower_id = u.id AND u2.is_active = 1 AND u2.is_banned = 0) AS following_count, 
				u.post_count, u.payment_link,
				u.privacy_level, u.created_at, u.last_seen_at, u.level, u.xp_points, u.checkin_streak,
				u.custom_status, u.custom_status_text, u.custom_status_expires_at,
				COALESCE(ur.role, u.role, 'user') AS role,
				(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS title_text,
				(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS title_color
			FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id WHERE u.id = ? LIMIT 1
		`
			)
			.get(userId);
		if (!user) return json({ error: 'User not found' }, { status: 404 });

		const customization = await db
			.prepare('SELECT * FROM profile_customizations WHERE user_id = ?')
			.get(user.id);
		if (customization) {
			user.customization = customization;
		}

		await db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(userId);
		return json({ user });
	}

	// ── /api/users/suggested ──
	if (action === 'suggested') {
		const userId = await requireAuth(request);
		// Personalized ranking:
		//  • mutual_score  — friends-of-friends: how many people you follow also follow this user (×20)
		//  • interest_score — thematic overlap: hashtags on their posts that match tags you've reacted to (×8)
		//  • is_virtual / verified / follower_count as tie-breakers so new accounts still surface something.
		const users = await db
			.prepare(
				`
			SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.is_verified, u.is_virtual, u.follower_count,
				(
					20 * (SELECT COUNT(*) FROM follows f2
						WHERE f2.following_id = u.id
						  AND f2.follower_id IN (SELECT following_id FROM follows WHERE follower_id = ?))
					+ 8 * (SELECT COUNT(*) FROM post_hashtags ph
						JOIN posts p ON p.id = ph.post_id
						WHERE p.user_id = u.id
						  AND ph.tag_name IN (
							SELECT ph2.tag_name FROM post_hashtags ph2
							JOIN post_reactions pr ON pr.post_id = ph2.post_id
							WHERE pr.user_id = ?))
					+ (u.follower_count / 50.0)
				) AS affinity_score
			FROM users u
			WHERE u.id != ?
			  AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
			  AND u.id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = ?)
			  AND u.is_active = 1 AND u.is_banned = 0
			ORDER BY affinity_score DESC, u.is_virtual DESC, u.follower_count DESC
			LIMIT 20
		`
			)
			.all(userId, userId, userId, userId, userId);
		return json({ users });
	}

	// ── /api/users/search ──
	if (action === 'search') {
		const userId = await requireAuth(request);
		const q = url.searchParams.get('q') || '';
		const users = await db
			.prepare(
				`
			SELECT id, username, display_name, avatar_url, bio, is_verified, is_virtual, follower_count,
				(SELECT COUNT(*) FROM follows f WHERE f.follower_id = ? AND f.following_id = users.id) > 0 as is_following
			FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND id != ? AND is_active = 1 AND is_banned = 0 LIMIT 20
		`
			)
			.all(userId, `%${q}%`, `%${q}%`, userId);
		return json({ users });
	}

	// ── /api/users/settings ──
	if (action === 'settings') {
		const userId = await requireAuth(request);
		let settings = await db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
		if (!settings) {
			await db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(userId);
			settings = { user_id: userId, theme: 'light', language: 'es' };
		}
		return json({ settings });
	}

	// ── /api/users/notifications ──
	if (action === 'notifications') {
		const userId = await requireAuth(request);
		const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
		const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 20));
		const offset = (page - 1) * limit;

		const notifs = await db
			.prepare(
				`
			SELECT n.*, u.username as actor_username, u.display_name as actor_name, u.avatar_url as actor_avatar
			FROM notifications n JOIN users u ON n.actor_id = u.id
			WHERE n.recipient_id = ? ORDER BY n.created_at DESC LIMIT ? OFFSET ?
		`
			)
			.all(userId, limit, offset);
		return json({ notifications: notifs });
	}

	// ── /api/users/:action/followers ──
	if (action && subaction === 'followers') {
		const currentUserId = await optionalAuth(request);
		let targetUserId;
		if (action === 'me') {
			targetUserId = await requireAuth(request);
		} else {
			const target = await db
				.prepare('SELECT id FROM users WHERE username = ? OR CAST(id AS TEXT) = ?')
				.get(action, action);
			if (!target) return json({ followers: [] });
			targetUserId = target.id;
		}

		const users = await db
			.prepare(
				`
			SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.is_verified, u.is_virtual,
			  COALESCE((SELECT role FROM user_roles WHERE user_id = u.id), u.role, 'user') as role,
			  u.level,
			  ${currentUserId ? '(SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.id) > 0' : '0'} AS is_following
			FROM follows f JOIN users u ON f.follower_id = u.id
			WHERE f.following_id = ?
			  AND u.is_active = 1 AND u.is_banned = 0
		`
			)
			.all(...(currentUserId ? [currentUserId, targetUserId] : [targetUserId]));
		return json({ followers: users });
	}

	// ── /api/users/:action/following ──
	if (action && subaction === 'following') {
		const currentUserId = await optionalAuth(request);
		let targetUserId;
		if (action === 'me') {
			targetUserId = await requireAuth(request);
		} else {
			const target = await db
				.prepare('SELECT id FROM users WHERE username = ? OR CAST(id AS TEXT) = ?')
				.get(action, action);
			if (!target) return json({ following: [] });
			targetUserId = target.id;
		}

		const users = await db
			.prepare(
				`
			SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.is_verified, u.is_virtual,
			  COALESCE((SELECT role FROM user_roles WHERE user_id = u.id), u.role, 'user') as role,
			  u.level,
			  ${currentUserId ? '(SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.id) > 0' : '0'} AS is_following
			FROM follows f JOIN users u ON f.following_id = u.id
			WHERE f.follower_id = ?
			  AND u.is_active = 1 AND u.is_banned = 0
		`
			)
			.all(...(currentUserId ? [currentUserId, targetUserId] : [targetUserId]));
		return json({ following: users });
	}

	// ── /api/users/:action/posts ──
	if (action && subaction === 'posts') {
		const userId = await optionalAuth(request);
		const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
		const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 10));
		const offset = (page - 1) * limit;

		const status = url.searchParams.get('status') || 'active';
		let statusClause = 'AND p.deleted_at IS NULL';
		if (status === 'deleted') {
			if (!userId) {
				return json({ posts: [] });
			}
			const targetUser = await db
				.prepare('SELECT id FROM users WHERE username = ? OR CAST(id AS TEXT) = ?')
				.get(action, action);
			if (targetUser && targetUser.id === userId) {
				statusClause = 'AND p.deleted_at IS NOT NULL';
			} else {
				return json({ posts: [] });
			}
		}

		const posts = await db
			.prepare(
				`
			SELECT p.*, u.username, u.display_name, u.avatar_url, u.is_verified, u.level,
				COALESCE(ur.role, u.role, 'user') AS role,
				(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS title_text,
				(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS title_color,
				(SELECT COUNT(*) FROM post_reactions pl WHERE pl.post_id = p.id AND pl.user_id = ?) > 0 as user_liked,
				(SELECT COUNT(*) FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = ?) > 0 as user_saved,
				(SELECT COUNT(*) FROM post_shares ps WHERE ps.post_id = p.id AND ps.user_id = ?) > 0 as user_shared
			FROM posts p JOIN users u ON p.user_id = u.id LEFT JOIN user_roles ur ON ur.user_id = u.id
			WHERE (u.username = ? OR CAST(u.id AS TEXT) = ?) AND (p.is_anonymous = 0 OR p.is_anonymous IS NULL) AND u.is_active = 1 AND u.is_banned = 0 ${statusClause}
			ORDER BY p.created_at DESC LIMIT ? OFFSET ?
		`
			)
			.all(userId || 0, userId || 0, userId || 0, action, action, limit, offset);

		const mediaMap = await fetchPostMedia(
			db,
			posts.map((p) => p.id)
		);
		posts.forEach((p) => {
			parsePostMetadata(p);
			p.media = mediaMap[p.id] || [];
		});
		return json({ posts });
	}

	// ── /api/users/:action/reposts ──
	if (action && subaction === 'reposts') {
		const userId = await optionalAuth(request);
		const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
		const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 10));
		const offset = (page - 1) * limit;

		const targetUser = await db
			.prepare(
				'SELECT id, username, display_name, avatar_url FROM users WHERE (username = ? OR CAST(id AS TEXT) = ?) AND is_active = 1 AND is_banned = 0'
			)
			.get(action, action);

		if (!targetUser) {
			return json({ reposts: [], posts: [] });
		}

		const isOwner = Boolean(userId && targetUser.id === userId);
		const privacyClause = isOwner ? '' : "AND (p.privacy = 'public' OR p.user_id = ?)";

		const queryParams = [userId || 0, userId || 0, userId || 0, targetUser.id];

		if (!isOwner) {
			queryParams.push(userId || 0);
		}

		queryParams.push(limit, offset);

		const posts = await db
			.prepare(
				`
			SELECT p.*, p.body as content, u.username, u.display_name, u.avatar_url, u.is_verified, u.level,
				COALESCE(ur.role, u.role, 'user') AS role,
				ai.anon_username,
				ps.created_at AS reposted_at,
				(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS title_text,
				(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS title_color,
				(SELECT COUNT(*) FROM post_reactions pl WHERE pl.post_id = p.id AND pl.user_id = ?) > 0 as user_liked,
				(SELECT COUNT(*) FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = ?) > 0 as user_saved,
				(SELECT COUNT(*) FROM post_shares ps2 WHERE ps2.post_id = p.id AND ps2.user_id = ?) > 0 as user_shared
			FROM post_shares ps
			JOIN posts p ON ps.post_id = p.id
			JOIN users u ON p.user_id = u.id
			LEFT JOIN user_roles ur ON ur.user_id = u.id
			LEFT JOIN anon_identities ai ON ai.user_id = p.user_id
			WHERE ps.user_id = ?
			  AND p.deleted_at IS NULL
			  AND u.is_active = 1
			  AND u.is_banned = 0
			  ${privacyClause}
			ORDER BY ps.created_at DESC
			LIMIT ? OFFSET ?
		`
			)
			.all(...queryParams);

		const mediaMap = await fetchPostMedia(
			db,
			posts.map((p) => p.id)
		);
		posts.forEach((p) => {
			parsePostMetadata(p);
			p.media = mediaMap[p.id] || [];
			anonymizePost(p, userId);
			p.reposted_by = {
				id: targetUser.id,
				username: targetUser.username,
				display_name: targetUser.display_name,
				avatar_url: targetUser.avatar_url,
				reposted_at: p.reposted_at
			};
		});

		return json({ reposts: posts, posts });
	}

	// ── /api/users/anon-identity — identidad anónima permanente del usuario ──
	if (action === 'anon-identity' && !subaction) {
		const userId = await requireAuth(request);
		const ident = await db
			.prepare('SELECT id, anon_username, created_at FROM anon_identities WHERE user_id = ?')
			.get(userId);
		return json({ identity: ident || null });
	}

	// ── /api/users/:username — profile info ──
	if (action) {
		const user = await db
			.prepare(
				`
			SELECT u.id, u.username, u.display_name, u.avatar_url, u.cover_url, u.bio, u.location, u.website,
				(SELECT COUNT(*) FROM follows f JOIN users u2 ON f.follower_id = u2.id WHERE f.following_id = u.id AND u2.is_active = 1 AND u2.is_banned = 0) AS follower_count, 
				(SELECT COUNT(*) FROM follows f JOIN users u2 ON f.following_id = u2.id WHERE f.follower_id = u.id AND u2.is_active = 1 AND u2.is_banned = 0) AS following_count, 
				u.post_count, u.is_verified, u.is_virtual, u.created_at,
				u.level, u.xp_points, u.checkin_streak, u.payment_link,
				COALESCE(ur.role, u.role, 'user') AS role,
				(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS title_text,
				(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS title_color
			FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id 
			WHERE (u.username = ? OR CAST(u.id AS TEXT) = ?) AND u.is_active = 1 AND u.is_banned = 0
		`
			)
			.get(action, action);
		if (!user) return json({ error: 'User not found' }, { status: 404 });

		const customization = await db
			.prepare('SELECT * FROM profile_customizations WHERE user_id = ?')
			.get(user.id);
		if (customization) {
			user.customization = customization;
		}

		const currentUserId = await optionalAuth(request);
		user.is_following = false;
		if (currentUserId) {
			const f = await db
				.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
				.get(currentUserId, user.id);
			user.is_following = !!f;
		}

		if (user.is_virtual) {
			user.vtuber_profile = {
				character_name: user.display_name,
				lore: 'Creadora virtual y streamer.',
				software: 'VTube Studio, OBS Studio',
				model_creator: '@AkiraPixel'
			};
			user.interests = ['Gaming', 'Anime', 'Música', 'Live2D'];
		}
		return json({ user });
	}

	return json({ error: 'User ID or username required' }, { status: 400 });
}

export async function POST({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subaction = parts[1] || '';
	const userId = await requireAuth(request);
	const db = getDb();

	// ── POST /api/users/anon-identity — crea la identidad anónima permanente del usuario ──
	// El username anónimo se elige UNA sola vez y queda fijo para siempre (como en Facebook, pero
	// exclusivo: no puede repetirse con otros usuarios anónimos ni con cuentas normales).
	if (action === 'anon-identity' && !subaction) {
		const existing = await db
			.prepare('SELECT anon_username FROM anon_identities WHERE user_id = ?')
			.get(userId);
		if (existing) {
			return json(
				{
					error: 'Ya tienes una identidad anónima permanente: @' + existing.anon_username,
					code: 'ANON_IDENTITY_EXISTS'
				},
				{ status: 409 }
			);
		}

		const body = await request.json().catch(() => ({}));
		const anonUsername = String(body.username || '').trim();
		const usernameRe = /^[a-zA-Z0-9_]{3,24}$/;
		if (!usernameRe.test(anonUsername)) {
			return json(
				{ error: 'El nombre anónimo debe tener 3-24 caracteres (letras, números o guion bajo).' },
				{ status: 400 }
			);
		}
		const lower = anonUsername.toLowerCase();
		if (['anonimo', 'anonymous', 'usuario', 'admin', 'vsocial', 'anon'].includes(lower)) {
			return json(
				{ error: 'Ese nombre anónimo no está disponible. Prueba con otro.' },
				{ status: 400 }
			);
		}

		// Exclusivo: no puede chocar con identidades anónimas ni con usernames normales
		const clashAnon = await db
			.prepare('SELECT 1 FROM anon_identities WHERE LOWER(anon_username) = LOWER(?)')
			.get(anonUsername);
		const clashUser = await db
			.prepare('SELECT 1 FROM users WHERE LOWER(username) = LOWER(?)')
			.get(anonUsername);
		if (clashAnon || clashUser) {
			return json({ error: 'Ese nombre anónimo ya está en uso. Elige otro.' }, { status: 409 });
		}

		try {
			const result = await db
				.prepare('INSERT INTO anon_identities (user_id, anon_username) VALUES (?, ?)')
				.run(userId, anonUsername);
			return json({
				success: true,
				identity: { id: Number(result.lastInsertRowid), anon_username: anonUsername },
				message: 'Identidad anónima creada: @' + anonUsername
			});
		} catch (e) {
			if (String(e.message).includes('UNIQUE')) {
				return json({ error: 'Ese nombre anónimo ya está en uso. Elige otro.' }, { status: 409 });
			}
			return json({ error: 'Error al crear la identidad anónima.' }, { status: 500 });
		}
	}

	// ── POST /api/users/delete-account (RGPD: borrado self-service con ventana de 30 días) ──
	if (action === 'delete-account' && !subaction) {
		const { password } = await request.json();
		if (!password) return json({ error: 'Se requiere tu contraseña' }, { status: 400 });

		const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
		if (!user || !(await bcrypt.compare(password, user.password_hash))) {
			return json({ error: 'Contraseña incorrecta' }, { status: 401 });
		}

		// Soft-delete + cierre inmediato de todas las sesiones
		await db
			.prepare("UPDATE users SET deleted_at = datetime('now'), is_active = 0 WHERE id = ?")
			.run(userId);
		await db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);

		return json({
			success: true,
			message:
				'Cuenta programada para eliminación en 30 días. Puedes reactivarla iniciando sesión antes.'
		});
	}

	// ── POST /api/users/:username/follow ──
	if (action && subaction === 'follow') {
		const target = await db
			.prepare('SELECT id FROM users WHERE username = ? OR CAST(id AS TEXT) = ?')
			.get(action, action);
		if (!target) return json({ error: 'User not found' }, { status: 404 });
		if (target.id === userId) return json({ error: 'Cannot follow yourself' }, { status: 400 });

		const existing = await db
			.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
			.get(userId, target.id);
		if (existing) return json({ success: true, message: 'Already following' });

		await db
			.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)')
			.run(userId, target.id);
		await db
			.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?')
			.run(userId);
		await db
			.prepare('UPDATE users SET follower_count = follower_count + 1 WHERE id = ?')
			.run(target.id);

		const follower = await db
			.prepare('SELECT display_name, username FROM users WHERE id = ?')
			.get(userId);
		const followerName = follower?.display_name || follower?.username || 'Alguien';
		await db
			.prepare(
				"INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id, message) VALUES (?, ?, 'follow', 'user', ?, ?)"
			)
			.run(target.id, userId, userId, `${followerName} te ha comenzado a seguir.`);

		// Gamification: Follow
		setTimeout(async () => {
			try {
				await awardXP(db, userId, 2).catch(() => {});
				await awardXP(db, target.id, 3).catch(() => {});
			} catch (e) {
				console.error('[Async Follow Gamification Error]', e);
			}
		}, 0);
		return json({ success: true, message: 'Followed successfully' });
	}

	// ── POST /api/users/avatar ──
	if (action === 'avatar') {
		const formData = await request.formData();
		const file = formData.get('avatar');
		if (!file) return json({ error: 'No avatar file provided' }, { status: 400 });

		const uploadDir = getUploadsDir('avatars');
		const ext = file.name.split('.').pop() || 'png';
		const newName = `avatar_${userId}_${Date.now()}.${ext}`;
		const buffer = Buffer.from(await file.arrayBuffer());
		writeFileSync(resolve(uploadDir, newName), buffer);

		const avatarUrl = `/uploads/avatars/${newName}`;
		await db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, userId);
		return json({ success: true, avatar_url: avatarUrl });
	}

	// ── POST /api/users/cover ──
	if (action === 'cover') {
		const formData = await request.formData();
		const file = formData.get('cover');
		if (!file) return json({ error: 'No cover file provided' }, { status: 400 });

		const uploadDir = getUploadsDir('covers');
		const ext = file.name.split('.').pop() || 'png';
		const newName = `cover_${userId}_${Date.now()}.${ext}`;
		const buffer = Buffer.from(await file.arrayBuffer());
		writeFileSync(resolve(uploadDir, newName), buffer);

		const coverUrl = `/uploads/covers/${newName}`;
		await db.prepare('UPDATE users SET cover_url = ? WHERE id = ?').run(coverUrl, userId);
		return json({ success: true, cover_url: coverUrl });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function DELETE({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subaction = parts[1] || '';
	const userId = await requireAuth(request);
	const db = getDb();

	// DELETE /api/users/:username/follow
	if (action && subaction === 'follow') {
		const target = await db
			.prepare('SELECT id FROM users WHERE username = ? OR CAST(id AS TEXT) = ?')
			.get(action, action);
		if (!target) return json({ error: 'User not found' }, { status: 404 });

		const existing = await db
			.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
			.get(userId, target.id);
		if (!existing) return json({ success: true, message: 'Not following' });

		await db
			.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?')
			.run(userId, target.id);
		await db
			.prepare('UPDATE users SET following_count = MAX(following_count - 1, 0) WHERE id = ?')
			.run(userId);
		await db
			.prepare('UPDATE users SET follower_count = MAX(follower_count - 1, 0) WHERE id = ?')
			.run(target.id);

		// Gamification: Unfollow penalty
		setTimeout(async () => {
			try {
				await awardXP(db, userId, -2).catch(() => {});
				await awardXP(db, target.id, -3).catch(() => {});
			} catch (e) {
				console.error('[Async Unfollow Gamification Error]', e);
			}
		}, 0);

		return json({ success: true, message: 'Unfollowed successfully' });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function PUT({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const userId = await requireAuth(request);
	const body = await request.json();
	const db = getDb();

	// PUT /api/users/profile or /api/users/me
	if ((action === 'profile' || action === 'me') && !parts[1]) {
		const allowedFields = [
			'display_name',
			'bio',
			'location',
			'website',
			'category',
			'privacy_level',
			'gender',
			'birth_date'
		];
		// Enlace P2P de cobro externo — validado en cliente y servidor
		if ('payment_link' in body) {
			const { validatePaymentLink } = await import('$lib/validators.js');
			const v = validatePaymentLink(body.payment_link);
			if (!v.ok) return json({ error: v.error }, { status: 400 });
			allowedFields.push('payment_link');
		}
		const updates = [];
		const vals = [];
		for (const f of allowedFields) {
			if (f in body) {
				updates.push(`${f} = ?`);
				vals.push(body[f]);
			}
		}
		if (!updates.length) return json({ error: 'No valid fields provided' }, { status: 400 });
		vals.push(userId);
		await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...vals);

		if ('bio' in body && body.bio) {
			const hashtagRegex = /#\w+/g;
			const foundTags = body.bio.match(hashtagRegex);
			if (foundTags && foundTags.length > 0) {
				const uniqueTags = [...new Set(foundTags.map((t) => t.toLowerCase().replace('#', '')))];
				const insertHashtag = db.prepare(
					'INSERT INTO hashtags (tag_name, post_count) VALUES (?, 1) ON CONFLICT(tag_name) DO UPDATE SET post_count = post_count + 1'
				);
				for (const tag of uniqueTags) {
					try {
						await insertHashtag.run(tag);
					} catch (_e) {}
				}
			}
		}

		const updatedUser = await db
			.prepare(
				`
			SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.cover_url,
				u.bio, u.location, u.website, u.category, u.is_verified,
				u.follower_count, u.following_count, u.payment_link,
				u.custom_status, u.custom_status_text, u.custom_status_expires_at,
				COALESCE(ur.role, u.role, 'user') AS role
			FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id WHERE u.id = ? LIMIT 1
		`
			)
			.get(userId);
		return json({ success: true, user: updatedUser });
	}

	// PUT /api/users/me/status
	if (action === 'me' && parts[1] === 'status') {
		const { custom_status, custom_status_text, duration_minutes } = body;

		let expires_at = null;
		if (duration_minutes && duration_minutes !== 'forever') {
			const date = new Date();
			date.setMinutes(date.getMinutes() + parseInt(duration_minutes, 10));
			expires_at = date.toISOString().slice(0, 19).replace('T', ' ');
		}

		await db
			.prepare(
				`UPDATE users SET custom_status = ?, custom_status_text = ?, custom_status_expires_at = ? WHERE id = ?`
			)
			.run(custom_status || 'online', custom_status_text || null, expires_at, userId);

		// Import dynamically to avoid circular dependencies if any, though socket.js should be fine.
		// We'll call broadcastPresence manually after we export it from socket.js
		try {
			const { broadcastPresence } = await import('$lib/server/socket.js');
			await broadcastPresence(db, userId, true);
		} catch (e) {
			console.error('Failed to broadcast custom status:', e);
		}

		return json({
			success: true,
			message: 'Status updated',
			custom_status,
			custom_status_text,
			expires_at
		});
	}

	// PUT /api/users/me/customization
	if (action === 'me' && parts[1] === 'customization') {
		const allowedFields = [
			'primary_color',
			'bg_color',
			'bg_image_url',
			'glass_blur',
			'glass_opacity',
			'font_family',
			'custom_font_url',
			'custom_css',
			'blocks_layout'
		];
		const updates = [];
		const vals = [];
		for (const f of allowedFields) {
			if (body[f] !== undefined) {
				updates.push(`${f} = ?`);
				vals.push(typeof body[f] === 'object' ? JSON.stringify(body[f]) : body[f]);
			}
		}
		if (!updates.length) return json({ error: 'No valid fields provided' }, { status: 400 });

		const exists = await db
			.prepare('SELECT 1 FROM profile_customizations WHERE user_id = ?')
			.get(userId);
		if (!exists) {
			await db.prepare('INSERT INTO profile_customizations (user_id) VALUES (?)').run(userId);
		}

		vals.push(userId);
		await db
			.prepare(
				`UPDATE profile_customizations SET ${updates.join(', ')}, updated_at = datetime('now') WHERE user_id = ?`
			)
			.run(...vals);
		return json({ success: true, message: 'Customization updated' });
	}

	// PUT /api/users/settings
	if (action === 'settings') {
		const allowedFields = [
			'theme',
			'language',
			'notification_email',
			'notification_push',
			'notification_dms',
			'show_online_status'
		];
		const updates = [];
		const vals = [];
		for (const f of allowedFields) {
			if (body[f] !== undefined) {
				updates.push(`${f} = ?`);
				vals.push(body[f]);
			}
		}
		if (!updates.length) return json({ error: 'No valid settings provided' }, { status: 400 });
		vals.push(userId);
		await db
			.prepare(
				`UPDATE user_settings SET ${updates.join(', ')}, updated_at = datetime('now') WHERE user_id = ?`
			)
			.run(...vals);
		return json({ success: true, message: 'Settings updated' });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function PATCH({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const userId = await requireAuth(request);
	const db = getDb();

	// PATCH /api/users/notifications/read-all
	if (parts[0] === 'notifications' && parts[1] === 'read-all') {
		await db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_id = ?').run(userId);
		return json({ success: true });
	}

	// PATCH /api/users/notifications/:id/read
	if (parts[0] === 'notifications' && parts[2] === 'read') {
		const notifId = parseInt(parts[1]);
		await db
			.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?')
			.run(notifId, userId);
		return json({ success: true });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}
