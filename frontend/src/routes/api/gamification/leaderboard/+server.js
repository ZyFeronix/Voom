// ============================================================================
// GET /api/gamification/leaderboard — Clasificaciones de la Arena Voom!
// ============================================================================
// Query params:
//   type  = 'level' | 'streak' | 'creators'  (default 'level')
//   limit = 1..100                            (default 50)
//
// Respuesta:
//   {
//     users:           Top N filas del ranking,
//     total:           usuarios elegibles totales para este ranking,
//     currentUserRank: puesto del usuario autenticado (null si anónimo o sin datos),
//     currentUserData: fila del usuario actual (null si no clasificado),
//     neighbors:       ventana de ~7 filas alrededor del usuario cuando está
//                      FUERA del top devuelto; cada fila lleva `rank`.
//                      Vacío si el usuario está dentro del top o es anónimo.
//   }
//
// Rankings:
//   level    → level DESC, xp_points DESC
//   streak   → checkin_streak DESC, last_checkin_at DESC (solo racha > 0)
//   creators → engagement de los últimos 30 días: SUM(likes + comentarios +
//              shares) sobre posts públicos/publicados/no borrados, agrupado
//              por autor. No requiere migraciones: agrega columnas existentes.
//
// Campos por fila: id, username, display_name, avatar_url, is_verified,
// custom_status, role, title_text, title_color + métricas del ranking
// (level/xp_points | checkin_streak/last_checkin_at | engagement/post_count).

import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { optionalAuth } from '$lib/server/auth.js';

const CREATOR_WINDOW_DAYS = 30;

const CREATORS_POSTS_JOIN = `
		JOIN posts p ON p.user_id = u.id
			AND p.deleted_at IS NULL
			AND p.privacy = 'public'
			AND (p.status = 'published' OR p.status IS NULL)
			AND p.created_at > datetime('now', '-${CREATOR_WINDOW_DAYS} days')`;

const ACTIVE_USER_WHERE = `WHERE u.is_active = 1 AND u.is_banned = 0`;

const TITLE_SUBSELECT = `
					(SELECT title FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_text,
					(SELECT color FROM user_titles WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as title_color`;

/**
 * Devuelve una página ORDENADA del ranking solicitado.
 * @returns {Promise<Array<object>>}
 */
async function fetchBoard(db, type, limit, offset = 0) {
	if (type === 'level') {
		return db
			.prepare(
				`SELECT u.id, u.username, u.display_name, u.avatar_url, u.level, u.xp_points,
					u.is_verified, u.custom_status, COALESCE(ur.role, u.role, 'user') AS role,
					${TITLE_SUBSELECT}
				FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
				WHERE u.is_active = 1 AND u.is_banned = 0 AND u.level IS NOT NULL
				ORDER BY u.level DESC, u.xp_points DESC
				LIMIT ? OFFSET ?`
			)
			.all(limit, offset);
	}

	if (type === 'streak') {
		return db
			.prepare(
				`SELECT u.id, u.username, u.display_name, u.avatar_url, u.level,
					u.checkin_streak, u.last_checkin_at,
					u.is_verified, u.custom_status, COALESCE(ur.role, u.role, 'user') AS role,
					${TITLE_SUBSELECT}
				FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
				WHERE u.is_active = 1 AND u.is_banned = 0 AND u.checkin_streak > 0
				ORDER BY u.checkin_streak DESC, u.last_checkin_at DESC
				LIMIT ? OFFSET ?`
			)
			.all(limit, offset);
	}

	// creators
	return db
		.prepare(
			`SELECT u.id, u.username, u.display_name, u.avatar_url,
					u.is_verified, u.custom_status, COALESCE(ur.role, u.role, 'user') AS role,
					${TITLE_SUBSELECT},
					COALESCE(SUM(p.like_count + p.comment_count + p.share_count), 0) AS engagement,
					COUNT(p.id) AS post_count
				FROM users u
				LEFT JOIN user_roles ur ON ur.user_id = u.id
				${CREATORS_POSTS_JOIN}
				${ACTIVE_USER_WHERE}
				GROUP BY u.id
				HAVING engagement > 0
				ORDER BY engagement DESC, post_count DESC, u.username ASC
				LIMIT ? OFFSET ?`
		)
		.all(limit, offset);
}

/** Total de usuarios elegibles para el ranking. */
async function fetchTotal(db, type) {
	if (type === 'level') {
		const row = await db
			.prepare(
				`SELECT COUNT(*) AS total FROM users WHERE is_active = 1 AND is_banned = 0 AND level IS NOT NULL`
			)
			.get();
		return row?.total || 0;
	}
	if (type === 'streak') {
		const row = await db
			.prepare(
				`SELECT COUNT(*) AS total FROM users WHERE is_active = 1 AND is_banned = 0 AND checkin_streak > 0`
			)
			.get();
		return row?.total || 0;
	}
	// creators
	const row = await db
		.prepare(
			`SELECT COUNT(*) AS total FROM (
				SELECT p.user_id
				FROM posts p
				JOIN users u ON u.id = p.user_id AND u.is_active = 1 AND u.is_banned = 0
				WHERE p.deleted_at IS NULL AND p.privacy = 'public'
					AND (p.status = 'published' OR p.status IS NULL)
					AND p.created_at > datetime('now', '-${CREATOR_WINDOW_DAYS} days')
				GROUP BY p.user_id
				HAVING COALESCE(SUM(p.like_count + p.comment_count + p.share_count), 0) > 0
			)`
		)
		.get();
	return row?.total || 0;
}

/**
 * Puesto + fila del usuario autenticado para el ranking dado.
 * @returns {Promise<{rank: number|null, data: object|null}>}
 */
async function fetchCurrentUserStanding(db, userId, type) {
	if (type === 'level') {
		const u = await db
			.prepare(
				`SELECT u.id, u.username, u.display_name, u.avatar_url, u.level, u.xp_points,
						u.checkin_streak, u.last_checkin_at, u.is_verified, u.custom_status,
						COALESCE(ur.role, u.role, 'user') AS role,
						${TITLE_SUBSELECT}
					FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
					WHERE u.id = ?`
			)
			.get(userId);
		if (!u || u.level === null || u.level === undefined) return { rank: null, data: null };
		const r = await db
			.prepare(
				`SELECT COUNT(*) + 1 AS rank FROM users
					WHERE is_active = 1 AND is_banned = 0 AND level IS NOT NULL
					AND (level > ? OR (level = ? AND xp_points > ?))`
			)
			.get(u.level, u.level, u.xp_points);
		return { rank: r.rank, data: u };
	}

	if (type === 'streak') {
		const u = await db
			.prepare(
				`SELECT u.id, u.username, u.display_name, u.avatar_url, u.level,
						u.checkin_streak, u.last_checkin_at, u.is_verified, u.custom_status,
						COALESCE(ur.role, u.role, 'user') AS role,
						${TITLE_SUBSELECT}
					FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
					WHERE u.id = ?`
			)
			.get(userId);
		if (!u || !u.checkin_streak || u.checkin_streak <= 0) return { rank: null, data: null };
		const r = await db
			.prepare(
				`SELECT COUNT(*) + 1 AS rank FROM users
					WHERE is_active = 1 AND is_banned = 0 AND checkin_streak > 0
					AND (checkin_streak > ? OR (checkin_streak = ? AND last_checkin_at > ?))`
			)
			.get(u.checkin_streak, u.checkin_streak, u.last_checkin_at);
		return { rank: r.rank, data: u };
	}

	// creators — el engagement propio se calcula con el mismo criterio.
	const mine = await db
		.prepare(
			`SELECT COALESCE(SUM(p.like_count + p.comment_count + p.share_count), 0) AS engagement,
					COUNT(p.id) AS post_count
				FROM posts p
				WHERE p.user_id = ? AND p.deleted_at IS NULL AND p.privacy = 'public'
					AND (p.status = 'published' OR p.status IS NULL)
					AND p.created_at > datetime('now', '-${CREATOR_WINDOW_DAYS} days')`
		)
		.get(userId);
	if (!mine || !mine.post_count) return { rank: null, data: null };

	const above = await db
		.prepare(
			`SELECT COUNT(*) AS cnt FROM (
				SELECT p.user_id
				FROM posts p
				JOIN users u2 ON u2.id = p.user_id AND u2.is_active = 1 AND u2.is_banned = 0
				WHERE p.deleted_at IS NULL AND p.privacy = 'public'
					AND (p.status = 'published' OR p.status IS NULL)
					AND p.created_at > datetime('now', '-${CREATOR_WINDOW_DAYS} days')
				GROUP BY p.user_id
				HAVING COALESCE(SUM(p.like_count + p.comment_count + p.share_count), 0) > ?
			)`
		)
		.get(mine.engagement);

	const u = await db
		.prepare(
			`SELECT u.id, u.username, u.display_name, u.avatar_url, u.level, u.xp_points,
					u.checkin_streak, u.last_checkin_at, u.is_verified, u.custom_status,
					COALESCE(ur.role, u.role, 'user') AS role,
					${TITLE_SUBSELECT}
				FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
				WHERE u.id = ?`
		)
		.get(userId);
	if (!u) return { rank: null, data: null };
	u.engagement = mine.engagement;
	u.post_count = mine.post_count;
	return { rank: (above?.cnt || 0) + 1, data: u };
}

export async function GET({ request, url }) {
	const db = getDb();
	const type = url.searchParams.get('type') || 'level';
	const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit')) || 50));

	if (!['level', 'streak', 'creators'].includes(type)) {
		return json({ error: 'Invalid leaderboard type' }, { status: 400 });
	}

	try {
		const userId = await optionalAuth(request);
		const users = await fetchBoard(db, type, limit, 0);

		let currentUserRank = null;
		let currentUserData = null;
		let neighbors = [];

		if (userId) {
			// 1) ¿Está dentro del top ya cargado?
			const indexInTop = users.findIndex((u) => u.id === userId);
			if (indexInTop !== -1) {
				currentUserRank = indexInTop + 1;
				currentUserData = users[indexInTop];
			} else {
				// 2) Fuera del top: puesto exacto + ventana de vecinos alrededor.
				const standing = await fetchCurrentUserStanding(db, userId, type);
				currentUserRank = standing.rank;
				currentUserData = standing.data;

				if (currentUserRank != null && currentUserData) {
					const windowStart = Math.max(0, currentUserRank - 4); // 3 encima + yo + 3 debajo
					const rawWindow = await fetchBoard(db, type, 7, windowStart);
					neighbors = rawWindow.map((u, i) => ({ ...u, rank: windowStart + i + 1 }));
				}
			}
		}

		const total = await fetchTotal(db, type);

		return json({ users, total, currentUserRank, currentUserData, neighbors });
	} catch (e) {
		console.error('[API Gamification Leaderboard]', e);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
