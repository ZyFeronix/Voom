/**
 * VSocial — In-Memory Batch Writer
 * Buffers high-frequency write events (impressions, video progress)
 * and flushes them to SQLite in periodic bulk transactions.
 * Prevents SQLite WAL write contention.
 */
import { getDb } from './db.js';

const impressionsQueue = [];
const reelProgressQueue = [];

let flushTimer = null;
const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 250;

/**
 * Queue post impressions for a user
 * @param {number} userId
 * @param {number[]} postIds
 */
export function queueImpressions(userId, postIds) {
	if (!userId || !Array.isArray(postIds) || postIds.length === 0) return;
	for (const id of postIds) {
		if (typeof id === 'number' && id > 0) {
			impressionsQueue.push({ userId, postId: id });
		}
	}
	ensureFlushLoop();
}

/**
 * Queue reel view progress for a user
 * @param {number} reelId
 * @param {number} userId
 * @param {number} progress (0-100)
 * @param {boolean} quality
 */
export function queueReelProgress(reelId, userId, progress, quality = false) {
	if (!reelId || !userId) return;
	reelProgressQueue.push({
		reelId: Number(reelId),
		userId: Number(userId),
		progress: Math.min(100, Math.max(0, Math.round(Number(progress) || 0))),
		quality: Boolean(quality)
	});
	ensureFlushLoop();
}

/**
 * Start flush interval if not active
 */
function ensureFlushLoop() {
	if (flushTimer) return;
	flushTimer = setInterval(async () => {
		try {
			await flushAllPending();
		} catch (err) {
			console.error('[batch-writer] Flush error:', err.message);
		}
	}, FLUSH_INTERVAL_MS);
	if (typeof flushTimer.unref === 'function') {
		flushTimer.unref();
	}
}

/**
 * Flush all buffered items to SQLite
 */
export async function flushAllPending() {
	const db = getDb();
	if (!db) return;

	await Promise.all([flushImpressions(db), flushReelProgress(db)]);
}

/**
 * Flush queued impressions
 */
async function flushImpressions(db) {
	if (impressionsQueue.length === 0) return;

	const batch = impressionsQueue.splice(0, MAX_BATCH_SIZE);
	if (batch.length === 0) return;

	// Deduplicate within the batch (same user + post)
	const seen = new Set();
	const unique = [];
	for (const item of batch) {
		const key = `${item.userId}_${item.postId}`;
		if (!seen.has(key)) {
			seen.add(key);
			unique.push(item);
		}
	}

	const placeholders = unique.map(() => "(?, ?, datetime('now'))").join(',');
	const params = unique.flatMap((item) => [item.userId, item.postId]);

	try {
		await db
			.prepare(
				`INSERT OR IGNORE INTO feed_impressions (user_id, post_id, seen_at) VALUES ${placeholders}`
			)
			.run(...params);
	} catch (err) {
		console.error('[batch-writer] Impressions batch insert failed:', err.message);
	}
}

/**
 * Flush queued reel progress
 */
async function flushReelProgress(db) {
	if (reelProgressQueue.length === 0) return;

	const batch = reelProgressQueue.splice(0, MAX_BATCH_SIZE);
	if (batch.length === 0) return;

	// Consolidate latest max_pct per (reel_id, user_id)
	const consolidated = new Map();
	for (const item of batch) {
		const key = `${item.reelId}_${item.userId}`;
		const existing = consolidated.get(key);
		if (!existing) {
			consolidated.set(key, item);
		} else {
			existing.progress = Math.max(existing.progress, item.progress);
			existing.quality = existing.quality || item.quality;
		}
	}

	for (const item of consolidated.values()) {
		try {
			const prev = await db
				.prepare(
					'SELECT max_pct, is_quality FROM reel_view_progress WHERE reel_id = ? AND user_id = ?'
				)
				.get(item.reelId, item.userId);

			if (!prev) {
				await db
					.prepare(
						"INSERT INTO reel_view_progress (reel_id, user_id, max_pct, is_quality, viewed_at) VALUES (?, ?, ?, ?, datetime('now'))"
					)
					.run(item.reelId, item.userId, item.progress, item.quality ? 1 : 0);

				await db
					.prepare(
						`
					UPDATE reels SET
						view_count = view_count + 1,
						views_50pct = views_50pct + CASE WHEN ? >= 50 THEN 1 ELSE 0 END,
						quality_views = quality_views + CASE WHEN ? = 1 THEN 1 ELSE 0 END,
						completion_count = completion_count + CASE WHEN ? >= 95 THEN 1 ELSE 0 END
					WHERE id = ?
				`
					)
					.run(item.progress, item.quality ? 1 : 0, item.progress, item.reelId);
			} else if (item.progress > prev.max_pct || (item.quality && !prev.is_quality)) {
				const newMax = Math.max(prev.max_pct, item.progress);
				const newQuality = item.quality || prev.is_quality ? 1 : 0;

				await db
					.prepare(
						"UPDATE reel_view_progress SET max_pct = ?, is_quality = ?, viewed_at = datetime('now') WHERE reel_id = ? AND user_id = ?"
					)
					.run(newMax, newQuality, item.reelId, item.userId);

				const crossed50 = prev.max_pct < 50 && newMax >= 50;
				const crossed95 = prev.max_pct < 95 && newMax >= 95;
				const crossedQuality = !prev.is_quality && newQuality === 1;

				if (crossed50 || crossed95 || crossedQuality) {
					await db
						.prepare(
							`
						UPDATE reels SET
							views_50pct = views_50pct + ?,
							quality_views = quality_views + ?,
							completion_count = completion_count + ?
						WHERE id = ?
					`
						)
						.run(crossed50 ? 1 : 0, crossedQuality ? 1 : 0, crossed95 ? 1 : 0, item.reelId);
				}
			}
		} catch (err) {
			console.error(`[batch-writer] Reel progress error for reel ${item.reelId}:`, err.message);
		}
	}
}
