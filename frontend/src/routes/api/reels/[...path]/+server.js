/**
 * VSocial — Reels API
 */
import { json } from '@sveltejs/kit';
import { getDb, getUploadsDir } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { awardXP } from '$lib/server/gamification.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { logActivity } from '$lib/server/activity.js';

export async function GET({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subaction = parts[1] || '';
	const db = getDb();

	if (action === 'feed') {
		const userId = await requireAuth(request);
		const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
		const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 10));
		const offset = (page - 1) * limit;

		const reels = await db.prepare(`
			SELECT r.*, u.username, u.display_name, u.avatar_url, u.is_verified,
				(SELECT COUNT(*) FROM reel_likes pl WHERE pl.reel_id = r.id AND pl.user_id = ?) > 0 as user_liked
			FROM reels r JOIN users u ON r.user_id = u.id
			WHERE r.is_active = 1 ORDER BY r.created_at DESC LIMIT ? OFFSET ?
		`).all(userId, limit, offset);
		return json({ data: reels, page, limit, has_more: reels.length === limit });
	}

	if (action && !subaction) {
		const reel = await db.prepare(`SELECT r.*, u.username, u.display_name, u.avatar_url, u.is_verified FROM reels r JOIN users u ON r.user_id = u.id WHERE r.id = ?`).get(parseInt(action));
		if (!reel) return json({ error: 'Reel not found' }, { status: 404 });
		return json({ reel });
	}

	if (action && subaction === 'comments') {
		let userId = null;
		try { userId = await requireAuth(request); } catch(e) {}
		
		await db.prepare('CREATE TABLE IF NOT EXISTS reel_comment_likes (comment_id INTEGER, user_id INTEGER, PRIMARY KEY(comment_id, user_id))').run();
		
		const comments = await db.prepare(`
			SELECT c.*, u.username, u.display_name, u.avatar_url, u.is_verified,
			(SELECT COUNT(*) FROM reel_comment_likes rcl WHERE rcl.comment_id = c.id AND rcl.user_id = ?) > 0 as has_liked
			FROM reel_comments c JOIN users u ON c.user_id = u.id WHERE c.reel_id = ? ORDER BY c.created_at ASC
		`).all(userId || 0, parseInt(action));
		
		// Map 1/0 to true/false for has_liked
		comments.forEach(c => c.has_liked = !!c.has_liked);
		return json({ comments });
	}
	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function POST({ request, url, params }) {
	try {
		const parts = params.path ? params.path.split('/') : [];
		const action = parts[0] || '';
		const subaction = parts[1] || '';
		const userId = await requireAuth(request);
		const db = getDb();

		// Upload reel
		if (!action || action === '') {
			const formData = await request.formData();
			const file = formData.get('video');
			const caption = formData.get('caption') || '';
			if (!file) return json({ error: 'No video file provided' }, { status: 400 });

			const uploadDir = getUploadsDir('reels');
			const ext = file.name.split('.').pop() || 'mp4';
			const newName = `reel_${Date.now()}.${ext}`;
			const buffer = Buffer.from(await file.arrayBuffer());
			writeFileSync(resolve(uploadDir, newName), buffer);
			const videoUrl = `/uploads/reels/${newName}`;

			const result = await db.prepare('INSERT INTO reels (user_id, video_url, caption) VALUES (?, ?, ?)').run(userId, videoUrl, caption);
			
			// Gamification: Create Reel
			setTimeout(async () => {
				try {
					await awardXP(db, userId, 5).catch(() => {});
				} catch (e) {
					console.error('[Async Reel Gamification Error]', e);
				}
			}, 0);

			await logActivity(userId, 'create', 'reel', Number(result.lastInsertRowid));

			return json({ success: true, reel_id: Number(result.lastInsertRowid), video_url: videoUrl }, { status: 201 });
		}

		const reelId = parseInt(action);

		// Like
		if (subaction === 'like') {
			const existing = await db.prepare('SELECT 1 FROM reel_likes WHERE reel_id = ? AND user_id = ?').get(reelId, userId);
			if (existing) return json({ success: true, message: 'Already liked' });
			await db.prepare('INSERT INTO reel_likes (reel_id, user_id) VALUES (?, ?)').run(reelId, userId);
			await db.prepare('UPDATE reels SET like_count = like_count + 1 WHERE id = ?').run(reelId);
			await logActivity(userId, 'like', 'reel', reelId);
			return json({ success: true, message: 'Reel liked' });
		}

		// View
		if (subaction === 'view') {
			await db.prepare('UPDATE reels SET view_count = view_count + 1 WHERE id = ?').run(reelId);
			
			// Log activity avoiding spam (1 per day)
			const existingView = db.prepare(`SELECT id FROM activity_logs WHERE user_id = ? AND action_type = 'view' AND entity_type = 'reel' AND entity_id = ? AND created_at >= datetime('now', '-1 day')`).get(userId, reelId);
			if (!existingView) await logActivity(userId, 'view', 'reel', reelId);
			
			return json({ success: true });
		}

		// Comment Action
		if (subaction === 'comments') {
			const commentId = parts[2] ? parseInt(parts[2]) : null;
			const commentAction = parts[3] || '';
			
			if (commentId && commentAction === 'like') {
				await db.prepare('CREATE TABLE IF NOT EXISTS reel_comment_likes (comment_id INTEGER, user_id INTEGER, PRIMARY KEY(comment_id, user_id))').run();
				try {
					await db.prepare('INSERT INTO reel_comment_likes (comment_id, user_id) VALUES (?, ?)').run(commentId, userId);
					await db.prepare('UPDATE reel_comments SET like_count = like_count + 1 WHERE id = ?').run(commentId);
					await logActivity(userId, 'like', 'comment', commentId);
				} catch(e) {} // ignore duplicate
				return json({ success: true, message: 'Comment liked' });
			}
			
			const body = await request.json();
			const content = (body.body || body.content || '').trim();
			const parentId = body.parent_id && !isNaN(body.parent_id) ? parseInt(body.parent_id) : null;
			const replyToId = body.reply_to_id && !isNaN(body.reply_to_id) ? parseInt(body.reply_to_id) : null;
			
			if (!content) return json({ error: 'Comment cannot be empty' }, { status: 400 });
			
			try {
				await db.prepare('ALTER TABLE reel_comments ADD COLUMN reply_to_id INTEGER').run();
			} catch (e) {} // ignore if already exists

			const result = await db.prepare('INSERT INTO reel_comments (reel_id, user_id, body, parent_id, reply_to_id) VALUES (?, ?, ?, ?, ?)').run(reelId, userId, content, parentId, replyToId);
			await db.prepare('UPDATE reels SET comment_count = comment_count + 1 WHERE id = ?').run(reelId);
			await logActivity(userId, 'create', 'comment', Number(result.lastInsertRowid), { reel_id: reelId });
			return json({ success: true, message: 'Comment added', comment_id: result.lastInsertRowid }, { status: 201 });
		}
		return json({ error: 'Endpoint not found' }, { status: 404 });
	} catch (e) {
		console.error('[Reels API Error]:', e);
		return json({ error: e.message || 'Error interno del servidor' }, { status: 500 });
	}
}

export async function DELETE({ request, url, params }) {
	try {
		const parts = params.path ? params.path.split('/') : [];
		const action = parts[0] || '';
		const subaction = parts[1] || '';
		const userId = await requireAuth(request);
		const db = getDb();
		const reelId = parseInt(action);

		if (subaction === 'like') {
			const result = await db.prepare('DELETE FROM reel_likes WHERE reel_id = ? AND user_id = ?').run(reelId, userId);
			if (result.changes > 0) {
				await db.prepare('UPDATE reels SET like_count = MAX(like_count - 1, 0) WHERE id = ?').run(reelId);
				await logActivity(userId, 'unlike', 'reel', reelId);
			}
			return json({ success: true, message: 'Reel unliked' });
		}

		if (!subaction) {
			const result = await db.prepare('DELETE FROM reels WHERE id = ? AND user_id = ?').run(reelId, userId);
			if (result.changes > 0) {
				await logActivity(userId, 'delete', 'reel', reelId);
				// Gamification: Delete Reel penalty
				setTimeout(async () => {
					try {
						await awardXP(db, userId, -5).catch(() => {});
					} catch (e) {
						console.error('[Async Delete Reel Gamification Error]', e);
					}
				}, 0);
				return json({ success: true, message: 'Reel deleted' });
			}
			return json({ error: 'Reel not found or unauthorized' }, { status: 404 });
		}
		
		if (subaction === 'comments') {
			const commentId = parseInt(parts[2]);
			if (!commentId || isNaN(commentId)) return json({ error: 'Invalid comment ID' }, { status: 400 });
			const commentAction = parts[3] || '';
			
			if (commentAction === 'like') {
				const res = await db.prepare('DELETE FROM reel_comment_likes WHERE comment_id = ? AND user_id = ?').run(commentId, userId);
				if (res.changes > 0) {
					await db.prepare('UPDATE reel_comments SET like_count = MAX(like_count - 1, 0) WHERE id = ?').run(commentId);
					await logActivity(userId, 'unlike', 'comment', commentId);
				}
				return json({ success: true, message: 'Comment unliked' });
			}
			
			// Admin or owner of the comment
			const user = await db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
			const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
			
			let result;
			let oldComment;
			if (isAdmin) {
				oldComment = await db.prepare('SELECT body FROM reel_comments WHERE id = ? AND reel_id = ?').get(commentId, reelId);
				result = await db.prepare('DELETE FROM reel_comments WHERE id = ? AND reel_id = ?').run(commentId, reelId);
			} else {
				oldComment = await db.prepare('SELECT body FROM reel_comments WHERE id = ? AND reel_id = ? AND user_id = ?').get(commentId, reelId, userId);
				result = await db.prepare('DELETE FROM reel_comments WHERE id = ? AND reel_id = ? AND user_id = ?').run(commentId, reelId, userId);
			}
			
			if (result.changes > 0) {
				await logActivity(userId, 'delete', 'comment', commentId, { previous_body: oldComment?.body });
				// Cascade-delete child comments (replies to this comment)
				const childResult = await db.prepare(
					'DELETE FROM reel_comments WHERE (parent_id = ? OR reply_to_id = ?) AND reel_id = ?'
				).run(commentId, commentId, reelId);
				const totalDeleted = 1 + (childResult.changes || 0);
				await db.prepare(
					'UPDATE reels SET comment_count = MAX(comment_count - ?, 0) WHERE id = ?'
				).run(totalDeleted, reelId);
				return json({ success: true, message: 'Comment deleted', total_deleted: totalDeleted });
			}
			return json({ error: 'Comment not found or unauthorized' }, { status: 404 });
		}
		
		return json({ error: 'Endpoint not found' }, { status: 404 });
	} catch (e) {
		console.error('[Reels API Delete Error]:', e);
		return json({ error: e.message || 'Error interno del servidor' }, { status: 500 });
	}
}
