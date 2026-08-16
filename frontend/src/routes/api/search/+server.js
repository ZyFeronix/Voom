/**
 * VSocial — Search API
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { optionalAuth } from '$lib/server/auth.js';
import { anonymizePost } from '$lib/server/security.js';

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

export async function GET({ request, url }) {
	const q = (url.searchParams.get('q') || '').trim();
	const type = url.searchParams.get('type') || 'all';
	const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
	const limit = Math.min(30, Math.max(1, parseInt(url.searchParams.get('limit')) || 15));
	const offset = (page - 1) * limit;
	const db = getDb();
	const currentUserId = await optionalAuth(request);

	if (!q) {
		const trending_users = await db
			.prepare(
				'SELECT id, username, display_name, avatar_url, is_verified, follower_count, category FROM users WHERE is_active = 1 AND is_banned = 0 ORDER BY follower_count DESC LIMIT 10'
			)
			.all();
		let trending_tags = [];
		try {
			trending_tags = await db
				.prepare('SELECT tag_name, post_count FROM hashtags ORDER BY post_count DESC LIMIT 20')
				.all();
		} catch {}
		const featured_posts = await db
			.prepare(
				"SELECT p.*, u.username, u.display_name, u.avatar_url, u.is_verified, ai.anon_username FROM posts p JOIN users u ON p.user_id = u.id LEFT JOIN anon_identities ai ON ai.user_id = p.user_id WHERE p.deleted_at IS NULL AND p.privacy = 'public' AND u.is_active = 1 AND u.is_banned = 0 ORDER BY p.like_count DESC, p.created_at DESC LIMIT 12"
			)
			.all();
		featured_posts.forEach((p) => {
			parsePostMetadata(p);
			anonymizePost(p, currentUserId);
		});
		return json({ users: trending_users, tags: trending_tags, posts: featured_posts, query: '' });
	}

	const like = `%${q}%`;
	const results = {};

	if (type === 'all' || type === 'users') {
		if (currentUserId) {
			results.users = await db
				.prepare(
					`
				SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified, u.follower_count, u.bio, u.category,
					(SELECT COUNT(*) FROM follows f WHERE f.follower_id = ? AND f.following_id = u.id) > 0 as is_following
				FROM users u WHERE (u.username LIKE ? OR u.display_name LIKE ?) AND u.id != ? AND u.is_active = 1 AND u.is_banned = 0
				ORDER BY u.follower_count DESC LIMIT ? OFFSET ?
			`
				)
				.all(currentUserId, like, like, currentUserId, limit, offset);
		} else {
			results.users = await db
				.prepare(
					'SELECT id, username, display_name, avatar_url, is_verified, follower_count, bio, category, 0 as is_following FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND is_active = 1 AND is_banned = 0 ORDER BY follower_count DESC LIMIT ? OFFSET ?'
				)
				.all(like, like, limit, offset);
		}
	}

	if (type === 'all' || type === 'posts') {
		if (currentUserId) {
			results.posts = await db
				.prepare(
					"SELECT p.id, p.user_id, p.body, p.like_count, p.comment_count, p.created_at, p.is_anonymous, u.username, u.display_name, u.avatar_url, u.is_verified, ai.anon_username FROM posts p JOIN users u ON p.user_id = u.id LEFT JOIN anon_identities ai ON ai.user_id = p.user_id WHERE p.deleted_at IS NULL AND p.body LIKE ? AND (p.privacy = 'public' OR p.user_id = ?) AND u.is_active = 1 AND u.is_banned = 0 ORDER BY p.like_count DESC, p.created_at DESC LIMIT ? OFFSET ?"
				)
				.all(like, currentUserId, limit, offset);
		} else {
			results.posts = await db
				.prepare(
					"SELECT p.id, p.user_id, p.body, p.like_count, p.comment_count, p.created_at, p.is_anonymous, u.username, u.display_name, u.avatar_url, u.is_verified, ai.anon_username FROM posts p JOIN users u ON p.user_id = u.id LEFT JOIN anon_identities ai ON ai.user_id = p.user_id WHERE p.deleted_at IS NULL AND p.body LIKE ? AND p.privacy = 'public' AND u.is_active = 1 AND u.is_banned = 0 ORDER BY p.like_count DESC, p.created_at DESC LIMIT ? OFFSET ?"
				)
				.all(like, limit, offset);
		}
		results.posts.forEach((p) => {
			parsePostMetadata(p);
			anonymizePost(p, currentUserId);
		});
	}

	if (type === 'all' || type === 'hashtags') {
		try {
			results.hashtags = await db
				.prepare(
					'SELECT tag_name, post_count FROM hashtags WHERE tag_name LIKE ? ORDER BY post_count DESC LIMIT ?'
				)
				.all(like, limit);
		} catch {
			results.hashtags = [];
		}
	}

	results.query = q;
	results.type = type;
	return json(results);
}
