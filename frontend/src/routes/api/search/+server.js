/**
 * VSocial — Search API
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { optionalAuth } from '$lib/server/auth.js';

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
				"SELECT p.*, u.username, u.display_name, u.avatar_url, u.is_verified FROM posts p JOIN users u ON p.user_id = u.id WHERE p.privacy = 'public' AND u.is_active = 1 AND u.is_banned = 0 ORDER BY p.like_count DESC, p.created_at DESC LIMIT 12"
			)
			.all();
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
					"SELECT p.id, p.body, p.like_count, p.comment_count, p.created_at, u.username, u.display_name, u.avatar_url, u.is_verified FROM posts p JOIN users u ON p.user_id = u.id WHERE p.body LIKE ? AND (p.privacy = 'public' OR p.user_id = ?) AND u.is_active = 1 AND u.is_banned = 0 ORDER BY p.like_count DESC, p.created_at DESC LIMIT ? OFFSET ?"
				)
				.all(like, currentUserId, limit, offset);
		} else {
			results.posts = await db
				.prepare(
					"SELECT p.id, p.body, p.like_count, p.comment_count, p.created_at, u.username, u.display_name, u.avatar_url, u.is_verified FROM posts p JOIN users u ON p.user_id = u.id WHERE p.body LIKE ? AND p.privacy = 'public' AND u.is_active = 1 AND u.is_banned = 0 ORDER BY p.like_count DESC, p.created_at DESC LIMIT ? OFFSET ?"
				)
				.all(like, limit, offset);
		}
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
