/**
 * VSocial — Posts API
 * POST   /api/posts              — Create post
 * POST   /api/posts/media        — Upload media
 * GET    /api/posts/:id          — Get single post
 * PUT    /api/posts/:id          — Update post
 * DELETE /api/posts/:id          — Delete post
 * POST   /api/posts/:id/like     — Like post
 * DELETE /api/posts/:id/like     — Unlike post
 * POST   /api/posts/:id/share    — Share post
 * POST   /api/posts/:id/save     — Save post
 * DELETE /api/posts/:id/save     — Unsave post
 * GET    /api/posts/:id/comments — Get comments
 * POST   /api/posts/:id/comments — Add comment
 * DELETE /api/posts/:id/comments/:commentId — Delete comment
 */
import { json } from '@sveltejs/kit';
import { getDb, getUploadsDir } from '$lib/server/db.js';
import { requireAuth, optionalAuth } from '$lib/server/auth.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { randomBytes } from 'crypto';
import { awardXP } from '$lib/server/gamification.js';
import { logActivity } from '$lib/server/activity.js';

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

export async function GET({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const db = getDb();

	// GET /api/posts/:id
	if (parts.length === 1) {
		const postId = parseInt(parts[0]);
		const post = await db
			.prepare(
				`
			SELECT p.*, p.body as content, u.username, u.display_name, u.avatar_url, u.is_verified, COALESCE(ur.role, u.role, 'user') AS role
			FROM posts p JOIN users u ON p.user_id = u.id LEFT JOIN user_roles ur ON ur.user_id = u.id WHERE p.id = ? AND p.deleted_at IS NULL
		`
			)
			.get(postId);
		if (!post) return json({ error: 'Post not found' }, { status: 404 });
		parsePostMetadata(post);
		post.media = await db
			.prepare('SELECT id, media_type, media_url FROM post_media WHERE post_id = ?')
			.all(postId);
		return json({ post });
	}

	// GET /api/posts/:id/comments
	if (parts.length === 2 && parts[1] === 'comments') {
		const postId = parseInt(parts[0]);
		const userId = await optionalAuth(request);
		const comments = await db
			.prepare(
				`
			SELECT c.*, u.username, u.display_name, u.avatar_url, u.is_verified, COALESCE(ur.role, u.role, 'user') AS role
			FROM comments c JOIN users u ON c.user_id = u.id LEFT JOIN user_roles ur ON ur.user_id = u.id WHERE c.post_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at ASC
		`
			)
			.all(postId);

		if (userId) {
			const likes = await db
				.prepare('SELECT comment_id FROM comment_reactions WHERE user_id = ? AND reaction = ?')
				.all(userId, 'like');
			const likedSet = new Set(likes.map((l) => l.comment_id));
			for (const c of comments) {
				c.user_has_liked = likedSet.has(c.id);
			}
		}

		return json({ comments });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function POST({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const userId = await requireAuth(request);
	const db = getDb();

	// POST /api/posts/media — upload media file
	if (parts.length === 1 && parts[0] === 'media') {
		const formData = await request.formData();
		const file = formData.get('media');
		if (!file) return json({ error: 'No media file provided' }, { status: 400 });

		const uploadDir = getUploadsDir('posts');
		const ext = file.name.split('.').pop() || 'bin';
		const newName = `${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
		const destPath = resolve(uploadDir, newName);
		const buffer = Buffer.from(await file.arrayBuffer());
		writeFileSync(destPath, buffer);

		const mediaType = file.type.includes('video') ? 'video' : 'image';
		const mediaUrl = `/uploads/posts/${newName}`;
		return json({ success: true, media: [{ url: mediaUrl, type: mediaType }] });
	}

	// POST /api/posts — create post
	if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
		let bodyText = '',
			mediaUrls = [],
			privacy = 'public',
			mood = null,
			scheduledAt = null,
			locationName = null,
			pollObj = null;
		const contentType = request.headers.get('content-type') || '';

		if (contentType.includes('multipart/form-data')) {
			const formData = await request.formData();
			bodyText = formData.get('body') || formData.get('content') || '';
			privacy = formData.get('privacy') || 'public';
			mood = formData.get('mood') || null;
			scheduledAt = formData.get('scheduled_at') || null;
			locationName = formData.get('location_name') || null;
			const pollStr = formData.get('poll');
			if (pollStr) {
				try {
					pollObj = JSON.parse(pollStr);
				} catch (_e) {}
			}
		} else {
			const body = await request.json().catch(() => ({}));
			bodyText = body.body || body.content || '';
			mediaUrls = body.media_urls || [];
			privacy = body.privacy || 'public';
			mood = body.mood || null;
			scheduledAt = body.scheduled_at || null;
			locationName = body.location_name || null;
			pollObj = body.poll || null;
		}

		if (!bodyText && mediaUrls.length === 0)
			return json({ error: 'Post cannot be empty' }, { status: 400 });

		try {
			let statusVal = 'published';
			if (scheduledAt) {
				const schedTime = new Date(scheduledAt).getTime();
				if (!isNaN(schedTime) && schedTime > Date.now()) {
					statusVal = 'scheduled';
				} else {
					scheduledAt = null;
				}
			}

			let finalBody = bodyText;
			if (pollObj || locationName) {
				const meta = {};
				if (pollObj) {
					meta.poll = {
						question: pollObj.question,
						options: pollObj.options.map((o) => ({ text: o, votes: 0 })),
						voted_user_ids: []
					};
				}
				if (locationName) {
					meta.location = locationName;
					try {
						await db
							.prepare(
								'INSERT INTO check_ins (user_id, latitude, longitude, place_name, note) VALUES (?, 0.0, 0.0, ?, ?)'
							)
							.run(userId, locationName, 'Post check-in');
					} catch (e) {
						console.error('Error inserting check-in:', e);
					}
				}
				finalBody = bodyText + '\n[METADATA]' + JSON.stringify(meta);
			}

			const insertPost = await db.prepare(
				'INSERT INTO posts (user_id, body, privacy, mood, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?)'
			);
			const result = await insertPost.run(userId, finalBody, privacy, mood, scheduledAt, statusVal);
			const postId = Number(result.lastInsertRowid);

			await db.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?').run(userId);

			// Gamification: Award 5 XP for creating a post
			await awardXP(db, userId, 5).catch((e) => console.error('[Gamification Error]', e));
			await logActivity(userId, 'create', 'post', postId);

			for (const med of mediaUrls) {
				await db
					.prepare('INSERT INTO post_media (post_id, media_type, media_url) VALUES (?, ?, ?)')
					.run(postId, med.type || 'image', med.url);
			}

			// Parse and save hashtags
			const hashtagRegex = /#\w+/g;
			const foundTags = bodyText.match(hashtagRegex);
			if (foundTags && foundTags.length > 0) {
				const uniqueTags = [...new Set(foundTags.map((t) => t.toLowerCase().replace('#', '')))];
				const insertHashtag = db.prepare(
					'INSERT INTO hashtags (tag_name, post_count) VALUES (?, 1) ON CONFLICT(tag_name) DO UPDATE SET post_count = post_count + 1'
				);
				const insertPostHashtag = db.prepare(
					'INSERT OR IGNORE INTO post_hashtags (post_id, tag_name) VALUES (?, ?)'
				);

				for (const tag of uniqueTags) {
					try {
						await insertHashtag.run(tag);
						await insertPostHashtag.run(postId, tag);
					} catch (e) {
						console.error('[Hashtag Error]', e);
					}
				}
			}

			// Notify followers (only if published immediately)
			if (statusVal === 'published') {
				const followers = await db
					.prepare('SELECT follower_id FROM follows WHERE following_id = ?')
					.all(userId);
				const author = await db
					.prepare('SELECT display_name, username FROM users WHERE id = ?')
					.get(userId);
				const authorName = author?.display_name || author?.username || 'Alguien';
				const insertNotif = await db.prepare(
					"INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id, message) VALUES (?, ?, 'new_post', 'post', ?, ?)"
				);
				for (const f of followers) {
					await insertNotif.run(
						f.follower_id,
						userId,
						postId,
						`${authorName} ha creado una nueva publicación.`
					);
				}
			}

			return json(
				{ success: true, post_id: postId, message: 'Post creado con éxito' },
				{ status: 201 }
			);
		} catch (e) {
			return json({ error: 'Error creating post: ' + e.message }, { status: 500 });
		}
	}

	const postId = parseInt(parts[0]);
	const subaction = parts[1];

	// POST /api/posts/:id/vote
	if (subaction === 'vote') {
		const body = await request.json().catch(() => ({}));
		const optionIndex = parseInt(body.option_index);
		if (isNaN(optionIndex)) return json({ error: 'Option index is required' }, { status: 400 });

		const post = await db.prepare('SELECT body FROM posts WHERE id = ?').get(postId);
		if (!post) return json({ error: 'Post not found' }, { status: 404 });

		const idx = post.body.indexOf('\n[METADATA]');
		if (idx === -1) return json({ error: 'Post has no poll' }, { status: 400 });

		const textPart = post.body.slice(0, idx);
		const metaStr = post.body.slice(idx + 11);
		let meta;
		try {
			meta = JSON.parse(metaStr);
		} catch (_e) {
			return json({ error: 'Invalid poll metadata' }, { status: 500 });
		}

		if (!meta.poll) return json({ error: 'Post has no poll' }, { status: 400 });
		if (!meta.poll.options[optionIndex])
			return json({ error: 'Invalid option index' }, { status: 400 });

		if (!meta.poll.voted_user_ids) meta.poll.voted_user_ids = [];
		if (meta.poll.voted_user_ids.includes(userId)) {
			return json({ error: 'Ya has votado en esta encuesta' }, { status: 400 });
		}

		meta.poll.options[optionIndex].votes += 1;
		meta.poll.voted_user_ids.push(userId);

		const updatedBody = textPart + '\n[METADATA]' + JSON.stringify(meta);
		await db.prepare('UPDATE posts SET body = ? WHERE id = ?').run(updatedBody, postId);

		return json({ success: true, poll: meta.poll });
	}

	// POST /api/posts/:id/like
	if (subaction === 'like') {
		const body = await request.json().catch(() => ({}));
		const reactionType = body.reaction || 'like';
		const existing = await db
			.prepare('SELECT 1 FROM post_reactions WHERE post_id = ? AND user_id = ?')
			.get(postId, userId);

		if (existing) {
			await db
				.prepare('UPDATE post_reactions SET reaction = ? WHERE post_id = ? AND user_id = ?')
				.run(reactionType, postId, userId);
			return json({ success: true, message: 'Reaction updated' });
		}

		// Fast path writes
		await db
			.prepare('INSERT INTO post_reactions (post_id, user_id, reaction) VALUES (?, ?, ?)')
			.run(postId, userId, reactionType);
		await db.prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').run(postId);

		// Non-blocking Side Effects (Notifications & Gamification)
		// This acts as an event queue in memory to prevent blocking the response
		setTimeout(async () => {
			try {
				const ownerId = await db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId)
					?.user_id;
				if (ownerId && ownerId !== userId) {
					const liker = await db
						.prepare('SELECT display_name, username FROM users WHERE id = ?')
						.get(userId);
					const likerName = liker?.display_name || liker?.username || 'Alguien';
					await db
						.prepare(
							"INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id, message) VALUES (?, ?, 'like', 'post', ?, ?)"
						)
						.run(ownerId, userId, postId, `${likerName} le ha gustado tu publicación.`);

					// Gamification: Award 2 XP to the post owner for receiving a like
					await awardXP(db, ownerId, 2).catch(() => {});
				}

				// Gamification: Award 1 XP to the user for giving a like
				await awardXP(db, userId, 1).catch(() => {});
			} catch (e) {
				console.error('[Async Like Tasks Error]', e);
			}
		}, 0);

		return json({ success: true, message: 'Post liked' });
	}

	// POST /api/posts/:id/share
	if (subaction === 'share') {
		await db.prepare('UPDATE posts SET share_count = share_count + 1 WHERE id = ?').run(postId);
		return json({ success: true, message: 'Post shared successfully' });
	}

	// POST /api/posts/:id/save
	if (subaction === 'save') {
		await db
			.prepare('INSERT OR IGNORE INTO saved_posts (user_id, post_id) VALUES (?, ?)')
			.run(userId, postId);
		return json({ success: true, message: 'Post saved successfully' });
	}

	// POST /api/posts/:id/comments
	if (subaction === 'comments' && parts.length === 2) {
		const body = await request.json();
		const content = (body.body || body.content || '').trim();
		const parentId = body.parent_id || null;
		if (!content) return json({ error: 'Comment cannot be empty' }, { status: 400 });

		const insertResult = await db
			.prepare('INSERT INTO comments (post_id, user_id, body, parent_id) VALUES (?, ?, ?, ?)')
			.run(postId, userId, content, parentId);
		const commentId = Number(insertResult.lastInsertRowid);
		await db.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').run(postId);
		await logActivity(userId, 'create', 'comment', commentId, { post_id: postId });

		const ownerId = await db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId)?.user_id;
		if (ownerId && ownerId !== userId) {
			const commenter = await db
				.prepare('SELECT display_name, username FROM users WHERE id = ?')
				.get(userId);
			const commenterName = commenter?.display_name || commenter?.username || 'Alguien';
			await db
				.prepare(
					"INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id, message) VALUES (?, ?, 'comment', 'post', ?, ?)"
				)
				.run(ownerId, userId, postId, `${commenterName} ha comentado en tu publicación.`);
		}

		// Gamification: Comments
		setTimeout(async () => {
			try {
				if (ownerId && ownerId !== userId) {
					await awardXP(db, ownerId, 1).catch(() => {});
				}
				await awardXP(db, userId, 2).catch(() => {});

				// Parse and save hashtags
				const hashtagRegex = /#\w+/g;
				const foundTags = content.match(hashtagRegex);
				if (foundTags && foundTags.length > 0) {
					const uniqueTags = [...new Set(foundTags.map((t) => t.toLowerCase().replace('#', '')))];
					const insertHashtag = db.prepare(
						'INSERT INTO hashtags (tag_name, post_count) VALUES (?, 1) ON CONFLICT(tag_name) DO UPDATE SET post_count = post_count + 1'
					);

					for (const tag of uniqueTags) {
						try {
							await insertHashtag.run(tag);
							// We could add comment_hashtags table, but for now we just increment the trending count
						} catch (_e) {}
					}
				}
			} catch (e) {
				console.error('[Async Comment Gamification Error]', e);
			}
		}, 0);

		return json({ success: true, message: 'Comment added' }, { status: 201 });
	}

	// POST /api/posts/:id/restore
	if (subaction === 'restore') {
		const result = await db
			.prepare('UPDATE posts SET deleted_at = NULL WHERE id = ? AND user_id = ?')
			.run(postId, userId);
		if (result.changes > 0) {
			await db.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?').run(userId);
			return json({ success: true, message: 'Post restored' });
		}
		return json({ error: 'Post not found or unauthorized' }, { status: 404 });
	}

	// POST /api/posts/:id/comments/:commentId/like
	if (subaction === 'comments' && parts.length === 4 && parts[3] === 'like') {
		const commentId = parseInt(parts[2]);
		try {
			await db
				.prepare(
					"INSERT INTO comment_reactions (comment_id, user_id, reaction) VALUES (?, ?, 'like')"
				)
				.run(commentId, userId);
			await db
				.prepare('UPDATE comments SET like_count = like_count + 1 WHERE id = ?')
				.run(commentId);
			return json({ success: true, message: 'Comment liked' });
		} catch (err) {
			if (err.message.includes('UNIQUE constraint failed')) {
				return json({ success: true, message: 'Already liked' });
			}
			return json({ error: err.message }, { status: 500 });
		}
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function PUT({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const userId = await requireAuth(request);
	const db = getDb();

	if (parts.length === 1) {
		const postId = parseInt(parts[0]);
		const body = await request.json();
		const bodyText = body.body || body.content || '';
		if (!bodyText) return json({ error: 'Content cannot be empty' }, { status: 400 });

		const oldPost = db.prepare('SELECT body FROM posts WHERE id = ?').get(postId);
		const result = db
			.prepare(
				"UPDATE posts SET body = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
			)
			.run(bodyText, postId, userId);
		if (result.changes > 0) {
			await logActivity(userId, 'update', 'post', postId, { previous_body: oldPost?.body });
			return json({ success: true, message: 'Post updated successfully' });
		}
		return json({ error: 'Post not found or unauthorized' }, { status: 404 });
	}
	// PUT /api/posts/:id/comments/:commentId
	if (parts.length === 3 && parts[1] === 'comments') {
		const commentId = parseInt(parts[2]);
		const body = await request.json();
		const bodyText = body.body || body.content || '';
		if (!bodyText) return json({ error: 'Content cannot be empty' }, { status: 400 });

		const oldComment = db.prepare('SELECT body FROM comments WHERE id = ?').get(commentId);
		const result = db
			.prepare('UPDATE comments SET body = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
			.run(bodyText, commentId, userId);
		if (result.changes > 0) {
			await logActivity(userId, 'update', 'comment', commentId, {
				previous_body: oldComment?.body,
				post_id: parseInt(parts[0])
			});
			return json({ success: true, message: 'Comment updated successfully' });
		}
		return json({ error: 'Comment not found or unauthorized' }, { status: 404 });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function DELETE({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const userId = await requireAuth(request);
	const db = getDb();

	const postId = parseInt(parts[0]);
	const subaction = parts[1];
	const subid = parts[2];

	// DELETE /api/posts/:id/like — unlike
	if (subaction === 'like') {
		const result = await db
			.prepare('DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?')
			.run(postId, userId);
		if (result.changes > 0) {
			await logActivity(userId, 'unlike', 'post', postId);
			await db
				.prepare('UPDATE posts SET like_count = MAX(like_count - 1, 0) WHERE id = ?')
				.run(postId);

			// Non-blocking side effects: Deduct XP to prevent spam-farming
			setTimeout(async () => {
				try {
					const ownerId = await db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId)
						?.user_id;
					if (ownerId && ownerId !== userId) {
						await awardXP(db, ownerId, -2).catch(() => {});
					}
					await awardXP(db, userId, -1).catch(() => {});
				} catch (e) {
					console.error('[Async Unlike Tasks Error]', e);
				}
			}, 0);
		}
		return json({ success: true, message: 'Post unreacted' });
	}

	// DELETE /api/posts/:id/save — unsave
	if (subaction === 'save') {
		await db
			.prepare('DELETE FROM saved_posts WHERE user_id = ? AND post_id = ?')
			.run(userId, postId);
		return json({ success: true, message: 'Post unsaved successfully' });
	}

	// DELETE /api/posts/:id/comments/:commentId/like
	if (subaction === 'comments' && parts.length === 4 && parts[3] === 'like') {
		const commentId = parseInt(parts[2]);
		const result = await db
			.prepare('DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ?')
			.run(commentId, userId);
		if (result.changes > 0) {
			await logActivity(userId, 'unlike', 'comment', commentId);
			await db
				.prepare('UPDATE comments SET like_count = MAX(like_count - 1, 0) WHERE id = ?')
				.run(commentId);
		}
		return json({ success: true, message: 'Comment unreacted' });
	}

	// DELETE /api/posts/:id/comments/:commentId
	if (subaction === 'comments' && subid && parts.length === 3) {
		const commentId = parseInt(subid);
		const oldComment = db.prepare('SELECT body FROM comments WHERE id = ?').get(commentId);
		const result = await db
			.prepare(
				"UPDATE comments SET deleted_at = datetime('now') WHERE id = ? AND (user_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?))"
			)
			.run(commentId, userId, userId);
		if (result.changes > 0) {
			await logActivity(userId, 'delete', 'comment', commentId, {
				previous_body: oldComment?.body
			});
			db.prepare('UPDATE posts SET comment_count = MAX(comment_count - 1, 0) WHERE id = ?').run(
				postId
			);

			// Gamification: Comment deletion penalty
			setTimeout(async () => {
				try {
					const ownerId = await db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId)
						?.user_id;
					if (ownerId && ownerId !== userId) {
						await awardXP(db, ownerId, -1).catch(() => {});
					}
					await awardXP(db, userId, -2).catch(() => {});
				} catch (e) {
					console.error('[Async Delete Comment Gamification Error]', e);
				}
			}, 0);
		}
		return json({ success: true, message: 'Comment deleted' });
	}

	// DELETE /api/posts/:id — delete post
	if (!subaction) {
		const oldPost = db.prepare('SELECT body FROM posts WHERE id = ?').get(postId);
		const result = await db
			.prepare("UPDATE posts SET deleted_at = datetime('now') WHERE id = ? AND user_id = ?")
			.run(postId, userId);
		if (result.changes > 0) {
			await logActivity(userId, 'delete', 'post', postId, { previous_body: oldPost?.body });
			await db
				.prepare('UPDATE users SET post_count = MAX(post_count - 1, 0) WHERE id = ?')
				.run(userId);

			// Non-blocking side effects: Deduct 5 XP to prevent creation/deletion farming
			setTimeout(async () => {
				try {
					await awardXP(db, userId, -5).catch(() => {});
				} catch (e) {
					console.error('[Async Delete Post Tasks Error]', e);
				}
			}, 0);

			return json({ success: true, message: 'Post deleted' });
		}
		return json({ error: 'Post not found or unauthorized' }, { status: 404 });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}
