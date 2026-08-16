/**
 * VSocial — Feed API
 * GET /api/feed — Personalized home feed
 * GET /api/feed/explore — Public explore feed
 * GET /api/feed/preferences — Get feed preferences
 * GET /api/feed/suggested-users — Suggested users
 * PUT /api/feed/preferences — Update feed preferences
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { getCache, setCache } from '$lib/server/cache.js';
import { queueImpressions } from '$lib/server/batch-writer.js';
import { applyDiversityFilters } from '$lib/server/diversity.js';
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

async function fetchPostMedia(db, postIds) {
	if (!postIds.length) return {};
	const placeholders = postIds.map(() => '?').join(',');
	const rows = await db
		.prepare(
			`SELECT post_id, id, media_type, media_url FROM post_media WHERE post_id IN (${placeholders})`
		)
		.all(...postIds);
	const map = {};
	for (const m of rows) {
		if (!map[m.post_id]) map[m.post_id] = [];
		map[m.post_id].push(m);
	}
	return map;
}

export async function GET({ request, url, params }) {
	const pathClean = params?.path || url.pathname.replace(/^\/api\/feed\/?/, '');
	const parts = pathClean ? pathClean.split('/') : [];
	const action = parts[0] || null;
	const userId = await requireAuth(request);
	const db = getDb();

	// ── ANONYMOUS POSTS FEED ──
	if (
		action === 'anonymous' ||
		url.searchParams.get('area') === 'anonymous' ||
		url.searchParams.get('algo') === 'anonymous'
	) {
		const cursorStr = url.searchParams.get('cursor') || '';
		const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 20));
		const cursor = parseInt(cursorStr) || 0;
		const sinceId = parseInt(url.searchParams.get('since_id')) || 0;
		let cursorClause = '';
		const queryParams = [userId, userId, userId];
		if (sinceId > 0) {
			cursorClause = 'AND p.id > ?';
			queryParams.push(sinceId);
		} else if (cursor > 0) {
			cursorClause = 'AND p.id < ?';
			queryParams.push(cursor);
		}
		queryParams.push(limit);

		const posts = await db
			.prepare(
				`
			SELECT p.*, p.body as content, u.username, u.display_name, u.avatar_url, u.is_verified, u.level, COALESCE(ur.role, u.role, 'user') AS role,
				ai.anon_username,
				(SELECT COUNT(*) FROM post_reactions pl WHERE pl.post_id = p.id AND pl.user_id = ?) > 0 as user_liked,
				(SELECT COUNT(*) FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = ?) > 0 as user_saved,
				(SELECT COUNT(*) FROM post_shares ps WHERE ps.post_id = p.id AND ps.user_id = ?) > 0 as user_shared,
				(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_text,
				(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_color
			FROM posts p JOIN users u ON p.user_id = u.id LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN anon_identities ai ON ai.user_id = p.user_id
			WHERE p.is_anonymous = 1 AND p.deleted_at IS NULL AND u.is_active = 1 AND u.is_banned = 0
			${cursorClause}
			ORDER BY p.id DESC LIMIT ?
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
		});

		const nextCursor = posts.length === limit ? String(posts[posts.length - 1].id) : '';
		return json({ posts, next_cursor: nextCursor, limit, has_more: posts.length === limit });
	}

	// ── PREFERENCES ──
	if (action === 'preferences') {
		const settings = await db
			.prepare(
				`SELECT feed_mode, w_interests, w_interactions, w_social, w_popularity, w_recency, w_diversity FROM user_settings WHERE user_id = ?`
			)
			.get(userId);
		if (!settings) {
			return json({
				preferences: {
					algorithm: 'intelligent',
					feed_mode: 'intelligent',
					w_interests: 50,
					w_interactions: 40,
					w_social: 30,
					w_popularity: 20,
					w_recency: 70,
					w_diversity: 15,
					weights: {
						interests: 50,
						interactions: 40,
						social: 30,
						popularity: 20,
						recency: 70,
						diversity: 15
					}
				}
			});
		}
		return json({
			preferences: {
				algorithm: settings.feed_mode || 'intelligent',
				feed_mode: settings.feed_mode || 'intelligent',
				w_interests: settings.w_interests ?? 50,
				w_interactions: settings.w_interactions ?? 40,
				w_social: settings.w_social ?? 30,
				w_popularity: settings.w_popularity ?? 20,
				w_recency: settings.w_recency ?? 70,
				w_diversity: settings.w_diversity ?? 15,
				weights: {
					interests: settings.w_interests ?? 50,
					interactions: settings.w_interactions ?? 40,
					social: settings.w_social ?? 30,
					popularity: settings.w_popularity ?? 20,
					recency: settings.w_recency ?? 70,
					diversity: settings.w_diversity ?? 15
				}
			}
		});
	}

	// ── EXPLORE ──
	if (action === 'explore') {
		const cursor = url.searchParams.get('cursor') || '';
		const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 20));
		const q = (url.searchParams.get('q') || '').trim();

		let cursorClause = '';
		let searchClause = '';
		const params = [];

		if (q) {
			if (q.startsWith('#')) {
				const tag = q.slice(1).toLowerCase();
				searchClause = 'AND p.id IN (SELECT post_id FROM post_hashtags WHERE tag_name = ?)';
				params.push(tag);
			} else {
				searchClause = 'AND p.body LIKE ?';
				params.push(`%${q}%`);
			}
		}

		if (cursor) {
			const [cursorLike, cursorId] = cursor.split('_').map(Number);
			if (cursorLike !== undefined && cursorId !== undefined) {
				cursorClause = 'AND (p.like_count < ? OR (p.like_count = ? AND p.id < ?))';
				params.push(cursorLike, cursorLike, cursorId);
			}
		}
		params.push(limit);

		const cacheKey = `explore_base_${userId}_${cursor}_${limit}_${encodeURIComponent(q)}`;
		let posts = await getCache(cacheKey);

		if (!posts) {
			// Include the userId parameter for the user_id check
			params.unshift(userId);

			posts = await db
				.prepare(
					`
				SELECT p.*, p.body as content, u.username, u.display_name, u.avatar_url, u.is_verified, u.level, COALESCE(ur.role, u.role, 'user') AS role,
				ai.anon_username,
					(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_text,
					(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_color
				FROM posts p JOIN users u ON p.user_id = u.id LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN anon_identities ai ON ai.user_id = p.user_id
				WHERE p.deleted_at IS NULL AND u.is_active = 1 AND u.is_banned = 0 AND (p.privacy = 'public' OR p.user_id = ?) ${searchClause} ${cursorClause}
				ORDER BY p.like_count DESC, p.id DESC LIMIT ?
			`
				)
				.all(...params);

			const mediaMap = await fetchPostMedia(
				db,
				posts.map((p) => p.id)
			);
			posts.forEach((p) => {
				parsePostMetadata(p);
				p.media = mediaMap[p.id] || [];
			});

			await setCache(cacheKey, posts, 15000); // 15 seconds TTL
		}

		// Personalize Hybrid Cache
		if (posts.length > 0 && userId) {
			const postIds = posts.map((p) => p.id);
			const placeholders = postIds.map(() => '?').join(',');

			const likedRows = await db
				.prepare(
					`SELECT post_id FROM post_reactions WHERE user_id = ? AND post_id IN (${placeholders})`
				)
				.all(userId, ...postIds);
			const savedRows = await db
				.prepare(
					`SELECT post_id FROM saved_posts WHERE user_id = ? AND post_id IN (${placeholders})`
				)
				.all(userId, ...postIds);
			const sharedRows = await db
				.prepare(
					`SELECT post_id FROM post_shares WHERE user_id = ? AND post_id IN (${placeholders})`
				)
				.all(userId, ...postIds);

			const likedSet = new Set(likedRows.map((r) => r.post_id));
			const savedSet = new Set(savedRows.map((r) => r.post_id));
			const sharedSet = new Set(sharedRows.map((r) => r.post_id));

			posts.forEach((p) => {
				p.user_liked = likedSet.has(p.id) ? 1 : 0;
				p.user_saved = savedSet.has(p.id) ? 1 : 0;
				p.user_shared = sharedSet.has(p.id) ? 1 : 0;
			});
		}

		posts.forEach((p) => {
			anonymizePost(p, userId);
		});

		const nextCursor =
			posts.length === limit
				? `${posts[posts.length - 1].like_count}_${posts[posts.length - 1].id}`
				: '';
		return json({ posts, next_cursor: nextCursor, limit, has_more: posts.length === limit });
	}

	// ── SUGGESTED USERS ──
	if (action === 'suggested-users') {
		const users = await db
			.prepare(
				`
			SELECT id, username, display_name, avatar_url, is_verified, follower_count
			FROM users WHERE id != ? AND id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
			AND (is_active = 1 OR is_active IS NULL)
			ORDER BY follower_count DESC, created_at DESC LIMIT 6
		`
			)
			.all(userId, userId);
		return json({ users });
	}

	// ── TRENDING TAGS ──
	if (action === 'trending-tags') {
		const tags = await db
			.prepare(
				`
			SELECT tag_name as name, post_count
			FROM hashtags
			ORDER BY post_count DESC, created_at DESC LIMIT 5
		`
			)
			.all();
		return json({ tags });
	}

	// ── HOME FEED (no action) ──
	if (!action) {
		const cursorStr = url.searchParams.get('cursor') || '';
		const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 20));

		const settings = (await db
			.prepare(
				`SELECT feed_mode, w_interests, w_interactions, w_social, w_popularity, w_recency, w_diversity FROM user_settings WHERE user_id = ?`
			)
			.get(userId)) || {
			feed_mode: 'intelligent',
			w_interests: 50,
			w_interactions: 40,
			w_social: 30,
			w_popularity: 20,
			w_recency: 70,
			w_diversity: 15
		};
		const mode = url.searchParams.get('algo') || settings.feed_mode || 'intelligent';

		let posts;
		let nextCursor = '';

		if (mode === 'following' || url.searchParams.get('area') === 'following') {
			// Strict chronological feed of only following creators + self
			const cursor = parseInt(cursorStr) || 0;
			const sinceId = parseInt(url.searchParams.get('since_id')) || 0;
			let cursorClause = '';
			const params = [userId, userId, userId, userId, userId, userId, userId];
			if (sinceId > 0) {
				cursorClause = 'AND p.id > ?';
				params.push(sinceId);
			} else if (cursor > 0) {
				cursorClause = 'AND p.id < ?';
				params.push(cursor);
			}
			params.push(limit);

			posts = await db
				.prepare(
					`
				SELECT p.*, p.body as content, u.username, u.display_name, u.avatar_url, u.is_verified, u.level, COALESCE(ur.role, u.role, 'user') AS role,
				ai.anon_username,
					(SELECT COUNT(*) FROM post_reactions pl WHERE pl.post_id = p.id AND pl.user_id = ?) > 0 as user_liked,
					(SELECT COUNT(*) FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = ?) > 0 as user_saved,
					(SELECT COUNT(*) FROM post_shares ps WHERE ps.post_id = p.id AND ps.user_id = ?) > 0 as user_shared,
					(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_text,
					(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_color
				FROM posts p JOIN users u ON p.user_id = u.id LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN anon_identities ai ON ai.user_id = p.user_id
				WHERE p.deleted_at IS NULL AND u.is_active = 1 AND u.is_banned = 0
				  AND (p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) OR p.user_id = ?)
				  AND (p.is_anonymous = 0 OR p.is_anonymous IS NULL)
				  AND p.id NOT IN (SELECT cs.post_id FROM content_signals cs WHERE cs.user_id = ?)
				  AND p.user_id NOT IN (SELECT su.snoozed_id FROM snoozed_users su WHERE su.snoozer_id = ? AND (su.snoozed_until IS NULL OR su.snoozed_until > datetime('now')))
				${cursorClause}
				ORDER BY p.id DESC LIMIT ?
			`
				)
				.all(...params);

			nextCursor = posts.length === limit ? String(posts[posts.length - 1].id) : '';
		} else if (mode === 'radar' || mode === 'chronological') {
			// Radar: Strict chronological but mixing following + recent trending
			const cursor = parseInt(cursorStr) || 0;
			const sinceId = parseInt(url.searchParams.get('since_id')) || 0;
			let cursorClause = '';
			const params = [userId, userId, userId, userId, userId, userId, userId];
			if (sinceId > 0) {
				cursorClause = 'AND p.id > ?';
				params.push(sinceId);
			} else if (cursor > 0) {
				cursorClause = 'AND p.id < ?';
				params.push(cursor);
			}
			params.push(limit);

			posts = await db
				.prepare(
					`
				SELECT p.*, p.body as content, u.username, u.display_name, u.avatar_url, u.is_verified, u.level, COALESCE(ur.role, u.role, 'user') AS role,
				ai.anon_username,
					(SELECT COUNT(*) FROM post_reactions pl WHERE pl.post_id = p.id AND pl.user_id = ?) > 0 as user_liked,
					(SELECT COUNT(*) FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = ?) > 0 as user_saved,
					(SELECT COUNT(*) FROM post_shares ps WHERE ps.post_id = p.id AND ps.user_id = ?) > 0 as user_shared,
					(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_text,
					(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_color
				FROM posts p JOIN users u ON p.user_id = u.id LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN anon_identities ai ON ai.user_id = p.user_id
				WHERE p.deleted_at IS NULL AND u.is_active = 1 AND u.is_banned = 0
				  AND (p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) OR p.user_id = ? OR p.privacy = 'public')
				  AND p.id NOT IN (SELECT cs.post_id FROM content_signals cs WHERE cs.user_id = ?)
				  AND p.user_id NOT IN (SELECT su.snoozed_id FROM snoozed_users su WHERE su.snoozer_id = ? AND (su.snoozed_until IS NULL OR su.snoozed_until > datetime('now')))
				${cursorClause}
				ORDER BY p.id DESC LIMIT ?
			`
				)
				.all(...params);

			nextCursor = posts.length === limit ? String(posts[posts.length - 1].id) : '';
		} else {
			// Intelligent or Retention — the six weights map 1:1 to the sliders in /settings.
			let wInt = settings.w_interests / 100.0; // thematic interest match (shared hashtags)
			let wIta = settings.w_interactions / 100.0; // creator affinity (past reactions to this author)
			let wSoc = settings.w_social / 100.0; // direct social graph (following / self)
			let wPop = settings.w_popularity / 100.0; // virality
			let wRec = settings.w_recency / 100.0; // freshness
			let wDiv = settings.w_diversity / 100.0; // deterministic spread

			if (mode === 'retention') {
				// Discovery over social graph — favor popularity, recency, diversity and thematic interest
				wInt = 0.6;
				wIta = 0.3;
				wSoc = 0.2;
				wPop = 1.0;
				wRec = 0.8;
				wDiv = 0.8;
			}

			let cursorScore = 1000000;
			let cursorId = 0;
			if (cursorStr) {
				const parts = cursorStr.split('_');
				cursorScore = parseFloat(parts[0]);
				cursorId = parseInt(parts[1]);
			}

			// Deterministic ranking formula with xAI Heavy Ranker weights and exponential decay
			const scoreExpr = `(
				(
					(${wSoc} * CASE WHEN p.is_anonymous = 1 THEN 40 WHEN p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) THEN 150 WHEN p.user_id = ? THEN 100 ELSE 0 END) +
					(${wIta} * CASE WHEN p.is_anonymous = 1 THEN 0 ELSE MIN(150, (SELECT COUNT(*) FROM post_reactions pra JOIN posts pa ON pa.id = pra.post_id WHERE pra.user_id = ? AND pa.user_id = p.user_id) * 30) END) +
					(${wInt} * MIN(120, (SELECT COUNT(*) FROM post_hashtags ph WHERE ph.post_id = p.id AND ph.tag_name IN (SELECT ph2.tag_name FROM post_hashtags ph2 JOIN post_reactions pri ON pri.post_id = ph2.post_id WHERE pri.user_id = ?)) * 40)) +
					(${wPop} * (
						MIN(40, p.like_count * 1) +
						MIN(40, p.save_count * 5) +
						MIN(50, p.share_count * 8) +
						MIN(50, p.comment_count * 6) +
						MIN(60, p.author_replies_count * 20)
					)) +
					(${wRec} * (100.0 * EXP(-0.693 * (julianday('now') - julianday(p.created_at)) / 0.25))) +
					(CASE WHEN (julianday('now') - julianday(p.created_at)) * 1440 < 120 AND p.first_engagement_at IS NOT NULL
						THEN MIN(100, (p.like_count + p.comment_count * 3 + p.share_count * 2) / MAX(1, (julianday('now') - julianday(p.first_engagement_at)) * 1440) * 10)
						ELSE 0 END) +
					(${wDiv} * (((p.id * 17) + ?) % 100)) -
					(CASE WHEN (SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = ?) IS NOT NULL THEN 50 ELSE 0 END)
				) * (0.5 + (COALESCE(u.reputation_score, 50) / 100.0) * 0.8)
			)`;

			let retentionFilter = '';
			if (mode === 'retention') {
				retentionFilter = `AND p.id NOT IN (SELECT fi.post_id FROM feed_impressions fi WHERE fi.user_id = ? AND fi.seen_at > datetime('now', '-2 days'))`;
			}

			const sinceId = parseInt(url.searchParams.get('since_id')) || 0;
			const paginationClause =
				sinceId > 0 ? `WHERE id > ?` : `WHERE (feed_score < ? OR (feed_score = ? AND id < ?))`;

			const query = `
				SELECT * FROM (
					SELECT p.*, p.body as content, u.username, u.display_name, u.avatar_url, u.is_verified, u.level, COALESCE(ur.role, u.role, 'user') AS role,
				ai.anon_username,
						(SELECT COUNT(*) FROM post_reactions pl WHERE pl.post_id = p.id AND pl.user_id = ?) > 0 as user_liked,
						(SELECT COUNT(*) FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = ?) > 0 as user_saved,
						(SELECT COUNT(*) FROM post_shares ps WHERE ps.post_id = p.id AND ps.user_id = ?) > 0 as user_shared,
						(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_text,
						(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_color,
						${scoreExpr} as feed_score
					FROM posts p JOIN users u ON p.user_id = u.id LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN anon_identities ai ON ai.user_id = p.user_id
					WHERE p.deleted_at IS NULL AND u.is_active = 1 AND u.is_banned = 0
					  AND (p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) OR p.user_id = ? OR p.privacy = 'public')
					  AND p.id NOT IN (SELECT cs.post_id FROM content_signals cs WHERE cs.user_id = ?)
					  AND p.user_id NOT IN (SELECT su.snoozed_id FROM snoozed_users su WHERE su.snoozer_id = ? AND (su.snoozed_until IS NULL OR su.snoozed_until > datetime('now')))
					  ${retentionFilter}
				)
				${paginationClause}
				ORDER BY feed_score DESC, id DESC LIMIT ?
			`;

			const queryParams = [
				userId,
				userId,
				userId, // user_liked, user_saved, user_shared
				userId,
				userId, // scoreExpr (wSoc following check, wSoc self check)
				userId, // scoreExpr (wIta interactions affinity seed)
				userId, // scoreExpr (wInt interests hashtag match seed)
				userId, // scoreExpr (wDiv pseudo-random seed)
				userId, // scoreExpr (liked penalty)
				userId,
				userId, // base filter (following check, self check)
				userId, // content_signals filter
				userId // snoozed_users filter
			];

			if (mode === 'retention') {
				queryParams.push(userId); // feed_impressions filter
			}

			if (sinceId > 0) {
				queryParams.push(sinceId);
			} else {
				queryParams.push(cursorScore, cursorScore, cursorId);
			}
			// Fetch extra candidate batch for diversity filtering (3x limit ensures ample headroom)
			queryParams.push(limit * 3);

			const rawCandidates = await db.prepare(query).all(...queryParams);
			posts = applyDiversityFilters(rawCandidates, limit);

			nextCursor =
				posts.length === limit
					? `${posts[posts.length - 1].feed_score}_${posts[posts.length - 1].id}`
					: '';
		}

		// Asynchronously register impressions in batch buffer
		if (posts.length > 0 && userId) {
			queueImpressions(
				userId,
				posts.map((p) => p.id)
			);
		}

		const mediaMap = await fetchPostMedia(
			db,
			posts.map((p) => p.id)
		);
		posts.forEach((p) => {
			parsePostMetadata(p);
			p.media = mediaMap[p.id] || [];
			anonymizePost(p, userId);
		});

		return json({ posts, next_cursor: nextCursor, limit, has_more: posts.length === limit });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function PUT({ request, url, params }) {
	const pathClean = params?.path || url.pathname.replace(/^\/api\/feed\/?/, '');
	const action = pathClean ? pathClean.split('/')[0] : '';
	if (action === 'preferences') {
		const userId = await requireAuth(request);
		const data = await request.json();
		const w = data.weights || data;
		const mode = data.algorithm || data.feed_mode || 'intelligent';
		const db = getDb();
		const exists = await db
			.prepare(`SELECT user_id FROM user_settings WHERE user_id = ?`)
			.get(userId);
		if (exists) {
			await db
				.prepare(
					`UPDATE user_settings SET feed_mode=?, w_interests=?, w_interactions=?, w_social=?, w_popularity=?, w_recency=?, w_diversity=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`
				)
				.run(
					mode,
					w.interests ?? w.w_interests ?? 50,
					w.interactions ?? w.w_interactions ?? 40,
					w.social ?? w.w_social ?? 30,
					w.popularity ?? w.w_popularity ?? 20,
					w.recency ?? w.w_recency ?? 70,
					w.diversity ?? w.w_diversity ?? 15,
					userId
				);
		} else {
			await db
				.prepare(
					`INSERT INTO user_settings (user_id, feed_mode, w_interests, w_interactions, w_social, w_popularity, w_recency, w_diversity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					userId,
					mode,
					w.interests ?? w.w_interests ?? 50,
					w.interactions ?? w.w_interactions ?? 40,
					w.social ?? w.w_social ?? 30,
					w.popularity ?? w.w_popularity ?? 20,
					w.recency ?? w.w_recency ?? 70,
					w.diversity ?? w.w_diversity ?? 15
				);
		}
		return json({ success: true, message: 'Feed preferences updated successfully' });
	}
	return json({ error: 'Endpoint not found' }, { status: 404 });
}
