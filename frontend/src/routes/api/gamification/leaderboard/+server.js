import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { optionalAuth } from '$lib/server/auth.js';

export async function GET({ request, url }) {
	const db = getDb();
	const type = url.searchParams.get('type') || 'level'; // 'level' or 'streak'
	const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit')) || 50));
	const userId = await optionalAuth(request);

	try {
		let users = [];

		if (type === 'level') {
			users = await db
				.prepare(
					`
				SELECT u.id, u.username, u.display_name, u.avatar_url, u.level, u.xp_points, u.is_verified, COALESCE(ur.role, u.role, 'user') AS role,
					(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_text,
					(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_color
				FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
				WHERE u.is_active = 1 AND u.is_banned = 0 AND u.level IS NOT NULL
				ORDER BY u.level DESC, u.xp_points DESC LIMIT ?
			`
				)
				.all(limit);
		} else if (type === 'streak') {
			users = await db
				.prepare(
					`
				SELECT u.id, u.username, u.display_name, u.avatar_url, u.level, u.checkin_streak, u.last_checkin_at, u.is_verified, COALESCE(ur.role, u.role, 'user') AS role,
					(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_text,
					(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_color
				FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
				WHERE u.is_active = 1 AND u.is_banned = 0 AND u.checkin_streak > 0
				ORDER BY u.checkin_streak DESC, u.last_checkin_at DESC LIMIT ?
			`
				)
				.all(limit);
		} else {
			return json({ error: 'Invalid leaderboard type' }, { status: 400 });
		}

		let currentUserData = null;
		let currentUserRank = null;

		if (userId) {
			const indexInTop = users.findIndex((u) => u.id === userId);
			if (indexInTop !== -1) {
				currentUserRank = indexInTop + 1;
				currentUserData = users[indexInTop];
			} else {
				// Fetch user's stats
				const u = await db
					.prepare(
						`
					SELECT u.id, u.username, u.display_name, u.avatar_url, u.level, u.xp_points, u.checkin_streak, u.last_checkin_at, u.is_verified, COALESCE(ur.role, u.role, 'user') AS role,
						(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_text,
						(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_color
					FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
					WHERE u.id = ?
				`
					)
					.get(userId);

				if (u && type === 'level' && u.level !== null) {
					const rankResult = await db
						.prepare(
							`
						SELECT COUNT(*) + 1 as rank FROM users 
						WHERE is_active = 1 AND is_banned = 0 AND level IS NOT NULL 
						AND (level > ? OR (level = ? AND xp_points > ?))
					`
						)
						.get(u.level, u.level, u.xp_points);
					currentUserRank = rankResult.rank;
					currentUserData = u;
				} else if (u && type === 'streak' && u.checkin_streak > 0) {
					const rankResult = await db
						.prepare(
							`
						SELECT COUNT(*) + 1 as rank FROM users 
						WHERE is_active = 1 AND is_banned = 0 AND checkin_streak > 0 
						AND (checkin_streak > ? OR (checkin_streak = ? AND last_checkin_at > ?))
					`
						)
						.get(u.checkin_streak, u.checkin_streak, u.last_checkin_at);
					currentUserRank = rankResult.rank;
					currentUserData = u;
				}
			}
		}

		return json({ users, currentUserRank, currentUserData });
	} catch (e) {
		console.error('[API Gamification Leaderboard]', e);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
