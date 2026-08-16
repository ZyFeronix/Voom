/**
 * VSocial — Deterministic Spam & Bot Heuristics Engine
 * Analyzes behavioral anomalies without AI:
 *  - Follower / Following imbalance (churn/follow-botting)
 *  - High-frequency posting bursts
 *  - Follow-churn patterns
 *  - Fresh account high-velocity posting
 */

/**
 * Check spam signals for a given user
 * @param {number} userId
 * @param {object} db - Universal database handle
 * @returns {Promise<{flags: string[], penalty: number}>}
 */
export async function checkSpamSignals(userId, db) {
	if (!userId) return { flags: [], penalty: 0 };

	const [user, postBurst, followChurn] = await Promise.all([
		db
			.prepare(
				'SELECT follower_count, following_count, created_at, post_count, is_verified FROM users WHERE id = ?'
			)
			.get(userId),
		db
			.prepare(
				"SELECT COUNT(*) AS cnt FROM posts WHERE user_id = ? AND created_at > datetime('now', '-1 hour') AND deleted_at IS NULL"
			)
			.get(userId),
		db
			.prepare(
				"SELECT COUNT(*) AS cnt FROM activity_logs WHERE user_id = ? AND action_type IN ('follow', 'unlike', 'delete') AND created_at > datetime('now', '-1 hour')"
			)
			.get(userId)
	]);

	if (!user) return { flags: [], penalty: 0 };

	const flags = [];
	const fg = user.following_count || 0;
	const fc = user.follower_count || 0;

	// Rule 1: Extreme following-to-follower ratio (> 10:1 with high following)
	if (fg > 50 && fg / Math.max(1, fc) > 10) {
		flags.push('high_follow_ratio');
	}

	// Rule 2: Post burst (> 6 posts in the last hour)
	if (postBurst && postBurst.cnt > 6) {
		flags.push('post_burst');
	}

	// Rule 3: Churn velocity (> 40 mutating actions per hour)
	if (followChurn && followChurn.cnt > 40) {
		flags.push('high_churn_velocity');
	}

	// Rule 4: Brand new account (< 3 days) with high initial output (> 15 posts)
	const ageDays = (Date.now() - new Date(user.created_at || Date.now()).getTime()) / 86400000;
	if (ageDays < 3 && (user.post_count || 0) > 15 && !user.is_verified) {
		flags.push('new_account_prolific');
	}

	// Penalty applies only if 2 or more flags are tripped
	const penalty = flags.length >= 2 ? flags.length * -12 : flags.length === 1 ? -5 : 0;

	return {
		flags,
		penalty
	};
}

/**
 * Scan active users in the last 2 hours and apply penalty to reputation score
 * @param {object} db
 * @returns {Promise<number>} Number of users scanned
 */
export async function batchScanSpamSignals(db) {
	try {
		const recentActors = await db
			.prepare(
				`
			SELECT DISTINCT user_id FROM activity_logs
			WHERE created_at > datetime('now', '-2 hours')
			LIMIT 150
		`
			)
			.all();

		let penalizations = 0;
		for (const actor of recentActors) {
			const { penalty } = await checkSpamSignals(actor.user_id, db);
			if (penalty < 0) {
				await db
					.prepare('UPDATE users SET reputation_score = MAX(5, reputation_score + ?) WHERE id = ?')
					.run(penalty, actor.user_id);
				penalizations++;
			}
		}

		return penalizations;
	} catch (err) {
		console.error('[spam-heuristics] Batch scan failed:', err.message);
		return 0;
	}
}
