/**
 * VSocial — Users API
 * GET    /api/users/me, /api/users/suggested, /api/users/search, /api/users/settings
 * GET    /api/users/:username, /api/users/:username/followers, /api/users/:username/following, /api/users/:username/posts
 * POST   /api/users/:username/follow, /api/users/avatar, /api/users/cover
 * DELETE /api/users/:username/follow
 * PUT    /api/users/profile, /api/users/me, /api/users/settings
 * PATCH  /api/users/notifications/read-all, /api/users/notifications/:id/read
 */
import { json } from '@sveltejs/kit';
import { getDb, getUploadsDir } from '$lib/server/db.js';
import { requireAuth, optionalAuth } from '$lib/server/auth.js';
import { awardXP } from '$lib/server/gamification.js';
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
	const rows = await db.prepare(`SELECT post_id, id, media_type, media_url FROM post_media WHERE post_id IN (${ph})`).all(...postIds);
	const map = {};
	for (const m of rows) { if (!map[m.post_id]) map[m.post_id] = []; map[m.post_id].push(m); }
	return map;
}

export async function GET({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subaction = parts[1] || '';
	const db = getDb();

	// ── /api/users/me ──
	if (action === 'me') {
		const userId = await requireAuth(request);
		const user = await db.prepare(`
			SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.cover_url,
				u.bio, u.location, u.website, u.category, u.is_verified, u.is_virtual,
				(SELECT COUNT(*) FROM follows f JOIN users u2 ON f.follower_id = u2.id WHERE f.following_id = u.id AND u2.is_active = 1 AND u2.is_banned = 0) AS follower_count, 
				(SELECT COUNT(*) FROM follows f JOIN users u2 ON f.following_id = u2.id WHERE f.follower_id = u.id AND u2.is_active = 1 AND u2.is_banned = 0) AS following_count, 
				u.post_count, u.wallet_balance,
				u.privacy_level, u.created_at, u.last_seen_at, u.level, u.xp_points, u.checkin_streak,
				COALESCE(ur.role, u.role, 'user') AS role,
				(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS title_text,
				(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS title_color
			FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id WHERE u.id = ? LIMIT 1
		`).get(userId);
		if (!user) return json({ error: 'User not found' }, { status: 404 });
		
		const customization = await db.prepare('SELECT * FROM profile_customizations WHERE user_id = ?').get(user.id);
		if (customization) {
			user.customization = customization;
		}

		await db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(userId);
		return json({ user });
	}

	// ── /api/users/suggested ──
	if (action === 'suggested') {
		const userId = await requireAuth(request);
		const users = await db.prepare(`
			SELECT id, username, display_name, avatar_url, bio, is_verified, is_virtual, follower_count 
			FROM users 
			WHERE id != ? 
			  AND id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
			  AND is_active = 1 AND is_banned = 0 
			ORDER BY is_virtual DESC, follower_count DESC 
			LIMIT 5
		`).all(userId, userId);
		return json({ users });
	}

	// ── /api/users/search ──
	if (action === 'search') {
		const userId = await requireAuth(request);
		const q = url.searchParams.get('q') || '';
		const users = await db.prepare(`
			SELECT id, username, display_name, avatar_url, bio, is_verified, is_virtual, follower_count,
				(SELECT COUNT(*) FROM follows f WHERE f.follower_id = ? AND f.following_id = users.id) > 0 as is_following
			FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND id != ? AND is_active = 1 AND is_banned = 0 LIMIT 20
		`).all(userId, `%${q}%`, `%${q}%`, userId);
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

		const notifs = await db.prepare(`
			SELECT n.*, u.username as actor_username, u.display_name as actor_name, u.avatar_url as actor_avatar
			FROM notifications n JOIN users u ON n.actor_id = u.id
			WHERE n.recipient_id = ? ORDER BY n.created_at DESC LIMIT ? OFFSET ?
		`).all(userId, limit, offset);
		return json({ notifications: notifs });
	}

	// ── /api/users/:action/followers ──
	if (action && subaction === 'followers') {
		const users = await db.prepare(`
			SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.is_verified, u.is_virtual
			FROM follows f JOIN users u ON f.follower_id = u.id
			WHERE f.following_id = (SELECT id FROM users WHERE username = ? OR CAST(id AS TEXT) = ?)
			  AND u.is_active = 1 AND u.is_banned = 0
		`).all(action, action);
		return json({ followers: users });
	}

	// ── /api/users/:action/following ──
	if (action && subaction === 'following') {
		const users = await db.prepare(`
			SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.is_verified, u.is_virtual
			FROM follows f JOIN users u ON f.following_id = u.id
			WHERE f.follower_id = (SELECT id FROM users WHERE username = ? OR CAST(id AS TEXT) = ?)
			  AND u.is_active = 1 AND u.is_banned = 0
		`).all(action, action);
		return json({ following: users });
	}

	// ── /api/users/:action/posts ──
	if (action && subaction === 'posts') {
		const userId = await requireAuth(request);
		const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
		const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 10));
		const offset = (page - 1) * limit;

		const status = url.searchParams.get('status') || 'active';
		let statusClause = 'AND p.deleted_at IS NULL';
		if (status === 'deleted') {
			const targetUser = await db.prepare('SELECT id FROM users WHERE username = ? OR CAST(id AS TEXT) = ?').get(action, action);
			if (targetUser && targetUser.id === userId) {
				statusClause = 'AND p.deleted_at IS NOT NULL';
			} else {
				return json({ posts: [] });
			}
		}

		const posts = await db.prepare(`
			SELECT p.*, u.username, u.display_name, u.avatar_url, u.is_verified, u.level,
				COALESCE(ur.role, u.role, 'user') AS role,
				(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS title_text,
				(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS title_color,
				(SELECT COUNT(*) FROM post_reactions pl WHERE pl.post_id = p.id AND pl.user_id = ?) > 0 as user_liked,
				(SELECT COUNT(*) FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = ?) > 0 as user_saved
			FROM posts p JOIN users u ON p.user_id = u.id LEFT JOIN user_roles ur ON ur.user_id = u.id
			WHERE (u.username = ? OR CAST(u.id AS TEXT) = ?) AND u.is_active = 1 AND u.is_banned = 0 ${statusClause}
			ORDER BY p.created_at DESC LIMIT ? OFFSET ?
		`).all(userId, userId, action, action, limit, offset);

		const mediaMap = await fetchPostMedia(db, posts.map(p => p.id));
		posts.forEach(p => {
			parsePostMetadata(p);
			p.media = mediaMap[p.id] || [];
		});
		return json({ posts });
	}

	// ── /api/users/:username — profile info ──
	if (action) {
		const user = await db.prepare(`
			SELECT u.id, u.username, u.display_name, u.avatar_url, u.cover_url, u.bio, u.location, u.website,
				(SELECT COUNT(*) FROM follows f JOIN users u2 ON f.follower_id = u2.id WHERE f.following_id = u.id AND u2.is_active = 1 AND u2.is_banned = 0) AS follower_count, 
				(SELECT COUNT(*) FROM follows f JOIN users u2 ON f.following_id = u2.id WHERE f.follower_id = u.id AND u2.is_active = 1 AND u2.is_banned = 0) AS following_count, 
				u.post_count, u.is_verified, u.is_virtual, u.created_at,
				u.level, u.xp_points, u.checkin_streak,
				COALESCE(ur.role, u.role, 'user') AS role,
				(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS title_text,
				(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY id DESC LIMIT 1) AS title_color
			FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id 
			WHERE (u.username = ? OR CAST(u.id AS TEXT) = ?) AND u.is_active = 1 AND u.is_banned = 0
		`).get(action, action);
		if (!user) return json({ error: 'User not found' }, { status: 404 });

		const customization = await db.prepare('SELECT * FROM profile_customizations WHERE user_id = ?').get(user.id);
		if (customization) {
			user.customization = customization;
		}

		const currentUserId = await optionalAuth(request);
		user.is_following = false;
		if (currentUserId) {
			const f = await db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(currentUserId, user.id);
			user.is_following = !!f;
		}

		if (user.is_virtual) {
			user.vtuber_profile = { character_name: user.display_name, lore: 'Creadora virtual y streamer.', software: 'VTube Studio, OBS Studio', model_creator: '@AkiraPixel' };
			user.interests = ['Gaming', 'Anime', 'Música', 'Live2D'];
		}
		return json({ user });
	}

	return json({ error: 'User ID or username required' }, { status: 400 });
}

export async function POST({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subaction = parts[1] || '';
	const userId = await requireAuth(request);
	const db = getDb();

	// ── POST /api/users/:username/follow ──
	if (action && subaction === 'follow') {
		const target = await db.prepare('SELECT id FROM users WHERE username = ? OR CAST(id AS TEXT) = ?').get(action, action);
		if (!target) return json({ error: 'User not found' }, { status: 404 });
		if (target.id === userId) return json({ error: 'Cannot follow yourself' }, { status: 400 });

		const existing = await db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(userId, target.id);
		if (existing) return json({ success: true, message: 'Already following' });

		await db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(userId, target.id);
		await db.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?').run(userId);
		await db.prepare('UPDATE users SET follower_count = follower_count + 1 WHERE id = ?').run(target.id);

		const follower = await db.prepare('SELECT display_name, username FROM users WHERE id = ?').get(userId);
		const followerName = follower?.display_name || follower?.username || 'Alguien';
		await db.prepare("INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id, message) VALUES (?, ?, 'follow', 'user', ?, ?)")
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

export async function DELETE({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subaction = parts[1] || '';
	const userId = await requireAuth(request);
	const db = getDb();

	// DELETE /api/users/:username/follow
	if (action && subaction === 'follow') {
		const target = await db.prepare('SELECT id FROM users WHERE username = ? OR CAST(id AS TEXT) = ?').get(action, action);
		if (!target) return json({ error: 'User not found' }, { status: 404 });

		const existing = await db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(userId, target.id);
		if (!existing) return json({ success: true, message: 'Not following' });

		await db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(userId, target.id);
		await db.prepare('UPDATE users SET following_count = MAX(following_count - 1, 0) WHERE id = ?').run(userId);
		await db.prepare('UPDATE users SET follower_count = MAX(follower_count - 1, 0) WHERE id = ?').run(target.id);
		
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

export async function PUT({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const userId = await requireAuth(request);
	const body = await request.json();
	const db = getDb();

	// PUT /api/users/profile or /api/users/me
	if ((action === 'profile' || action === 'me') && !parts[1]) {
		const allowedFields = ['display_name', 'bio', 'location', 'website', 'category', 'privacy_level', 'gender', 'birth_date'];
		const updates = []; const vals = [];
		for (const f of allowedFields) {
			if (f in body) { updates.push(`${f} = ?`); vals.push(body[f]); }
		}
		if (!updates.length) return json({ error: 'No valid fields provided' }, { status: 400 });
		vals.push(userId);
		await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...vals);

		if ('bio' in body && body.bio) {
			const hashtagRegex = /#\w+/g;
			const foundTags = body.bio.match(hashtagRegex);
			if (foundTags && foundTags.length > 0) {
				const uniqueTags = [...new Set(foundTags.map(t => t.toLowerCase().replace('#', '')))];
				const insertHashtag = db.prepare('INSERT INTO hashtags (tag_name, post_count) VALUES (?, 1) ON CONFLICT(tag_name) DO UPDATE SET post_count = post_count + 1');
				for (const tag of uniqueTags) {
					try { await insertHashtag.run(tag); } catch (e) {}
				}
			}
		}

		const updatedUser = await db.prepare(`
			SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.cover_url,
				u.bio, u.location, u.website, u.category, u.is_verified,
				u.follower_count, u.following_count, u.wallet_balance,
				COALESCE(ur.role, u.role, 'user') AS role
			FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id WHERE u.id = ? LIMIT 1
		`).get(userId);
		return json({ success: true, user: updatedUser });
	}

	// PUT /api/users/me/customization
	if (action === 'me' && parts[1] === 'customization') {
		const allowedFields = ['primary_color', 'bg_color', 'bg_image_url', 'glass_blur', 'glass_opacity', 'font_family', 'custom_font_url', 'custom_css', 'blocks_layout'];
		const updates = []; const vals = [];
		for (const f of allowedFields) {
			if (body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(typeof body[f] === 'object' ? JSON.stringify(body[f]) : body[f]); }
		}
		if (!updates.length) return json({ error: 'No valid fields provided' }, { status: 400 });
		
		const exists = await db.prepare('SELECT 1 FROM profile_customizations WHERE user_id = ?').get(userId);
		if (!exists) {
			await db.prepare('INSERT INTO profile_customizations (user_id) VALUES (?)').run(userId);
		}
		
		vals.push(userId);
		await db.prepare(`UPDATE profile_customizations SET ${updates.join(', ')}, updated_at = datetime('now') WHERE user_id = ?`).run(...vals);
		return json({ success: true, message: 'Customization updated' });
	}

	// PUT /api/users/settings
	if (action === 'settings') {
		const allowedFields = ['theme', 'language', 'notification_email', 'notification_push', 'notification_dms', 'show_online_status'];
		const updates = []; const vals = [];
		for (const f of allowedFields) {
			if (body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(body[f]); }
		}
		if (!updates.length) return json({ error: 'No valid settings provided' }, { status: 400 });
		vals.push(userId);
		await db.prepare(`UPDATE user_settings SET ${updates.join(', ')}, updated_at = datetime('now') WHERE user_id = ?`).run(...vals);
		return json({ success: true, message: 'Settings updated' });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function PATCH({ request, url, params }) {
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
		await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?').run(notifId, userId);
		return json({ success: true });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}
