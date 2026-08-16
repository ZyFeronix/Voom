/**
 * VSocial — Author Reputation Engine (TweepCred equivalent)
 * Computes deterministic creator reputation score (0–100)
 * based on social graph balance, account maturity, engagement metrics,
 * gamification status and negative feedback signals.
 */

/**
 * Compute reputation score for a single user
 * @param {number} userId
 * @param {object} db - Universal database handle
 * @returns {Promise<number>} Reputation score (0–100)
 */
export async function computeReputation(userId, db) {
	if (!userId) return 50;

	const data = await db
		.prepare(
			`
		SELECT
			u.id, u.follower_count, u.following_count, u.xp_points,
			u.checkin_streak, u.created_at, u.is_verified, u.level,
			(SELECT COUNT(*) FROM posts WHERE user_id = u.id
				AND created_at > datetime('now', '-30 days') AND deleted_at IS NULL) AS posts_30d,
			(SELECT COALESCE(SUM(like_count + comment_count + share_count + save_count), 0) FROM posts WHERE user_id = u.id
				AND created_at > datetime('now', '-30 days') AND deleted_at IS NULL) AS engagement_30d
		FROM users u WHERE u.id = ?
	`
		)
		.get(userId);

	if (!data) return 50;

	let score = 0;

	// 1. Social Graph Ratio (Followers / Following) — Max 25 points
	const fc = Math.max(0, data.follower_count || 0);
	const fg = Math.max(1, data.following_count || 0);
	const ratio = fc / fg;
	if (ratio >= 2.0) {
		score += 25;
	} else if (ratio >= 1.0) {
		score += 15 + (ratio - 1.0) * 10;
	} else if (ratio >= 0.2) {
		score += (ratio / 1.0) * 15;
	} else {
		score += Math.max(0, ratio * 10);
	}

	// 2. Account Age (Days since created_at) — Max 20 points (plateau at 360 days)
	const ageDays = (Date.now() - new Date(data.created_at || Date.now()).getTime()) / 86400000;
	score += Math.min(20, Math.max(0, ageDays / 18));

	// 3. Recent 30-Day Activity (Active creator status) — Max 15 points
	const posts30d = data.posts_30d || 0;
	score += Math.min(15, posts30d * 1.5);

	// 4. Engagement Quality per Post — Max 20 points
	const avgEngagement = posts30d > 0 ? (data.engagement_30d || 0) / posts30d : 0;
	score += Math.min(20, Math.log2(avgEngagement + 1) * 4);

	// 5. Verification status — 10 points
	if (data.is_verified) {
		score += 10;
	}

	// 6. Gamification (XP, Level, Streak) — Max 10 points
	const xp = data.xp_points || 0;
	const streak = data.checkin_streak || 0;
	score += Math.min(6, Math.log10(xp + 1) * 1.5);
	score += Math.min(4, streak * 0.4);

	// 7. Negative Feedback Signals Penalty — Max -30 points
	const negSignals = await db
		.prepare(
			`
		SELECT COUNT(*) AS cnt FROM content_signals cs
		JOIN posts p ON cs.post_id = p.id
		WHERE p.user_id = ? AND cs.created_at > datetime('now', '-30 days')
	`
		)
		.get(userId);

	const penalty = Math.min(30, (negSignals?.cnt || 0) * 2);
	score -= penalty;

	return Math.max(5, Math.min(100, Math.round(score)));
}

/**
 * Batch update reputation scores for active users
 * @param {object} db - Database handle
 * @param {number} [limit=100] - Number of users to process
 * @returns {Promise<number>} Processed count
 */
export async function batchUpdateReputations(db, limit = 100) {
	try {
		const activeUsers = await db
			.prepare(
				`
			SELECT DISTINCT id FROM users
			WHERE (last_seen_at > datetime('now', '-7 days') OR created_at > datetime('now', '-3 days'))
			  AND is_active = 1 AND is_banned = 0
			ORDER BY last_seen_at DESC
			LIMIT ?
		`
			)
			.all(limit);

		for (const u of activeUsers) {
			const rep = await computeReputation(u.id, db);
			await db.prepare('UPDATE users SET reputation_score = ? WHERE id = ?').run(rep, u.id);
		}

		return activeUsers.length;
	} catch (err) {
		console.error('[author-reputation] Batch update failed:', err.message);
		return 0;
	}
}
