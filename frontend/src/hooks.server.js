/**
 * VSocial — Server Hooks
 * Setup wizard guard · Cron workers · Security headers
 */
import { initDb, getDb, getDriverInfo, getUploadsDir } from '$lib/server/db.js';
import { decodeToken } from '$lib/server/jwt.js';
import { existsSync, unlinkSync } from 'fs';
import { resolve, basename } from 'path';

// Auto-initialize database on server start
try {
	await initDb();
	const info = getDriverInfo();
	// Asegurar que el super_admin esté verificado
	await getDb().prepare('UPDATE users SET is_verified = 1 WHERE id = 1').run();
	console.log(`[boot] DB ready — driver: ${info.driver}, WAL: ${info.supportsWal}`);
} catch (err) {
	console.error('[boot] Database init failed:', err.message);
}

// In-Memory Rate Limiter Map
const rateLimits = new Map();
const MAX_REQUESTS = 1000; // max peticiones por minuto por IP

let cronsStarted = false;

function startCrons() {
	if (cronsStarted) return;
	cronsStarted = true;

	// ── 1. Scheduled Post Publisher (every 60s) ──
	setInterval(async () => {
		try {
			const db = getDb();
			const due = await db
				.prepare(
					`
				SELECT id, user_id FROM posts
				WHERE status = 'scheduled' AND scheduled_at <= datetime('now')
				LIMIT 50
			`
				)
				.all();

			if (due.length > 0) {
				for (const post of due) {
					await db.prepare("UPDATE posts SET status = 'published' WHERE id = ?").run(post.id);
					await db
						.prepare(
							`
						INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id, message)
						SELECT f.follower_id, ?, 'new_post', 'post', ?, 'Nueva publicación programada.'
						FROM follows f WHERE f.following_id = ?
					`
						)
						.run(post.user_id, post.id, post.user_id);
				}
				console.log(`[cron] Published ${due.length} scheduled post(s)`);
			}
		} catch (err) {
			console.error('[cron] Scheduled publisher error:', err.message);
		}
	}, 60_000);

	// ── 2. Daily Memories "Un día como hoy" (runs at 00:01) ──
	setInterval(async () => {
		try {
			const now = new Date();
			if (now.getHours() !== 0 || now.getMinutes() !== 1) return;

			const db = getDb();
			const memories = await db
				.prepare(
					`
				SELECT p.id, p.user_id, p.created_at
				FROM posts p
				WHERE strftime('%m-%d', p.created_at) = strftime('%m-%d', 'now')
				  AND strftime('%Y', p.created_at) != strftime('%Y', 'now')
				LIMIT 200
			`
				)
				.all();

			if (memories.length > 0) {
				for (const m of memories) {
					const yearsAgo = now.getFullYear() - new Date(m.created_at).getFullYear();
					await db
						.prepare(
							`
						INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id, message)
						VALUES (?, ?, 'memory', 'post', ?, ?)
					`
						)
						.run(
							m.user_id,
							m.user_id,
							m.id,
							`📸 Un día como hoy, hace ${yearsAgo} año(s), publicaste un recuerdo.`
						);
				}
				console.log(`[cron] Generated ${memories.length} memory notification(s)`);
			}
		} catch (err) {
			console.error('[cron] Memories error:', err.message);
		}
	}, 60_000);

	// ── 3. Expired Stories Cleanup (every 5 min) ──
	setInterval(async () => {
		try {
			const db = getDb();
			const result = await db
				.prepare("DELETE FROM stories WHERE expires_at < datetime('now')")
				.run();
			if (result.changes > 0) {
				console.log(`[cron] Cleaned ${result.changes} expired story(ies)`);
			}
		} catch (err) {
			console.error('[cron] Stories cleanup error:', err.message);
		}
	}, 300_000);

	// ── 4. Expired Snooze Cleanup (every hour) ──
	setInterval(async () => {
		try {
			const db = getDb();
			await db.prepare("DELETE FROM snoozed_users WHERE snoozed_until < datetime('now')").run();
		} catch (err) {
			console.error('[cron] Snooze cleanup error:', err.message);
		}
	}, 3_600_000);

	// ── 5. Limpieza del Rate Limiter (every 2 min) ──
	setInterval(() => {
		const now = Date.now();
		for (const [ip, data] of rateLimits.entries()) {
			if (now - data.start > 60_000) {
				// Si expiró la ventana de 1 minuto, liberar memoria
				rateLimits.delete(ip);
			}
		}
	}, 120_000);

	// ── 6. RGPD Erasure: hard-delete cuentas soft-deleteradas hace >30 días + ficheros huérfanos (daily) ──
	setInterval(async () => {
		try {
			const db = getDb();
			// Cuentas que superan la ventana de gracia de 30 días
			const expired = await db
				.prepare(
					`
				SELECT id, avatar_url, cover_url FROM users
				WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-30 days')
			`
				)
				.all();

			if (expired.length === 0) return;

			// Limpiar ficheros de avatar/portada en disco antes de perder las URLs
			for (const u of expired) {
				for (const url of [u.avatar_url, u.cover_url]) {
					if (!url || !url.startsWith('/uploads/')) continue;
					const sub = url.startsWith('/uploads/avatars/') ? 'avatars' : 'covers';
					try {
						const filePath = resolve(getUploadsDir(sub), basename(url));
						if (existsSync(filePath)) unlinkSync(filePath);
					} catch (_e) {
						/* fichero ya ausente — ignorar */
					}
				}
			}

			// Hard-delete: ON DELETE CASCADE elimina wallets/transacciones, posts, comentarios,
			// messages, reacciones, follows, stories, reels, marketplace, gigs, activity_logs,
			// notifications, oauth_accounts, check_ins, sesiones, ajustes, etc.
			const ids = expired.map((u) => u.id);
			const ph = ids.map(() => '?').join(',');
			const result = await db.prepare(`DELETE FROM users WHERE id IN (${ph})`).run(...ids);
			console.log(
				`[cron] GDPR erasure: hard-deleted ${result.changes} user(s) + cascaded records + orphaned files`
			);
		} catch (err) {
			console.error('[cron] GDPR erasure error:', err.message);
		}
	}, 86_400_000);

	console.log('[boot] All cron workers started');
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const { pathname } = event.url;
	let clientIp = 'unknown';
	try {
		clientIp = event.getClientAddress();
	} catch (_e) {
		const forwarded = event.request.headers.get('x-forwarded-for');
		clientIp = forwarded ? forwarded.split(',')[0] : '127.0.0.1';
	}
	const method = event.request.method;

	// ── 1. In-Memory Rate Limiter (Token Bucket / Sliding Window) ──
	if (pathname.startsWith('/api/') || method !== 'GET') {
		let isStaff = false;

		// Intentar verificar rol mediante JWT (Bypass de Rate Limit para Staff)
		try {
			const authHeader = event.request.headers.get('authorization');
			if (authHeader) {
				const match = authHeader.match(/^Bearer\s+(\S+)$/i);
				if (match) {
					const decoded = decodeToken(match[1]);
					if (decoded && decoded.user_id) {
						const db = getDb();
						const user = await db
							.prepare(
								"SELECT COALESCE((SELECT role FROM user_roles WHERE user_id = u.id), u.role, 'user') as effective_role, is_verified FROM users u WHERE u.id = ?"
							)
							.get(decoded.user_id);

						event.locals.user = {
							id: decoded.user_id,
							role: user ? user.effective_role : 'user',
							is_verified: user ? user.is_verified : 0
						};

						if (
							user &&
							(['admin', 'super_admin', 'moderator', 'team', 'staff'].includes(
								user.effective_role
							) ||
								user.is_verified === 1)
						) {
							isStaff = true;
						}
					}
				}
			}
		} catch (_e) {
			// Ignorar errores de BD aquí; si falla, asume que no es staff y aplica rate limit.
		}

		if (!isStaff && clientIp !== '127.0.0.1' && clientIp !== '::1') {
			const now = Date.now();
			const rlData = rateLimits.get(clientIp);

			if (!rlData) {
				rateLimits.set(clientIp, { count: 1, start: now });
			} else {
				if (now - rlData.start > 60_000) {
					// Reiniciar ventana tras 1 minuto
					rateLimits.set(clientIp, { count: 1, start: now });
				} else {
					rlData.count++;
					if (rlData.count > MAX_REQUESTS) {
						console.warn(`[security] Rate limit superado por IP: ${clientIp}`);
						return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
							status: 429,
							headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
						});
					}
				}
			}
		}
	}

	// ── 2. Strict Origin Enforcement (Anti-CSRF API Guard) ──
	if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
		const origin = event.request.headers.get('origin');
		const referer = event.request.headers.get('referer');
		const host = event.url.host;

		// Validar que el origen o referer venga estrictamente de nuestro propio dominio
		if (origin && new URL(origin).host !== host) {
			console.warn(`[security] CSRF Origin rechazado: ${origin} vs ${host}`);
			return new Response('Forbidden - Invalid Origin', { status: 403 });
		}
		if (!origin && referer && new URL(referer).host !== host) {
			console.warn(`[security] CSRF Referer rechazado: ${referer} vs ${host}`);
			return new Response('Forbidden - Invalid Referer', { status: 403 });
		}
	}

	// ── Feature Flags Guard ──
	if (
		!pathname.startsWith('/_app/') &&
		!pathname.startsWith('/admin') &&
		pathname !== '/setup' &&
		pathname !== '/install'
	) {
		try {
			const db = getDb();
			const settingsRows = await db
				.prepare(
					"SELECT key, value FROM system_settings WHERE key IN ('reels_enabled', 'stories_enabled', 'groups_enabled', 'marketplace_enabled', 'gamification_enabled')"
				)
				.all();
			const settings = {};
			for (const r of settingsRows) {
				try {
					settings[r.key] = JSON.parse(r.value);
				} catch {
					settings[r.key] = r.value;
				}
			}

			const parseBool = (val) => val !== '0' && val !== false && val !== 'false';
			const isApi = pathname.startsWith('/api/');
			const checkPath = isApi ? pathname.substring(4) : pathname; // remove /api

			if (checkPath.startsWith('/reels') && !parseBool(settings.reels_enabled)) {
				return isApi
					? new Response(JSON.stringify({ error: 'Feature disabled' }), { status: 403 })
					: new Response('', { status: 302, headers: { Location: '/' } });
			}
			if (checkPath.startsWith('/stories') && !parseBool(settings.stories_enabled)) {
				return isApi
					? new Response(JSON.stringify({ error: 'Feature disabled' }), { status: 403 })
					: new Response('', { status: 302, headers: { Location: '/' } });
			}
			if (checkPath.startsWith('/groups') && !parseBool(settings.groups_enabled)) {
				return isApi
					? new Response(JSON.stringify({ error: 'Feature disabled' }), { status: 403 })
					: new Response('', { status: 302, headers: { Location: '/' } });
			}
			if (checkPath.startsWith('/marketplace') && !parseBool(settings.marketplace_enabled)) {
				return isApi
					? new Response(JSON.stringify({ error: 'Feature disabled' }), { status: 403 })
					: new Response('', { status: 302, headers: { Location: '/' } });
			}
			if (checkPath.startsWith('/leaderboard') && !parseBool(settings.gamification_enabled)) {
				return isApi
					? new Response(JSON.stringify({ error: 'Feature disabled' }), { status: 403 })
					: new Response('', { status: 302, headers: { Location: '/' } });
			}
		} catch (_e) {
			// ignore DB errors during guard, fallback to allow
		}
	}

	const response = await resolve(event);

	// ── 3. Security Headers (Helmet Equivalent) ──
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY'); // Previene Clickjacking estrictamente
	response.headers.set('X-XSS-Protection', '1; mode=block'); // Legacy XSS Protection
	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload'); // Fuerza HTTPS
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(self)');

	// ── Start crons on first request ──
	if (!cronsStarted) {
		startCrons();
	}

	// ── Setup Wizard Guard ──
	if (pathname.startsWith('/api/') || pathname.startsWith('/_app/') || pathname === '/setup') {
		return response;
	}

	try {
		const db = getDb();
		const count = await db.prepare('SELECT COUNT(*) as cnt FROM users').get();

		if (count.cnt === 0 && pathname !== '/setup') {
			return new Response('', {
				status: 302,
				headers: { Location: '/setup' }
			});
		}
	} catch (err) {
		// Solo redirigir a /install si el error indica que la BD no está configurada o la tabla no existe.
		// Si es un bloqueo temporal (SQLITE_BUSY) inducido por el rate limiter, NO redirigir.
		const msg = err.message || '';
		if (msg.includes('no such table') || msg.includes('not initialized')) {
			if (
				pathname !== '/install' &&
				!pathname.startsWith('/api/install') &&
				!pathname.startsWith('/_app/')
			) {
				return new Response('', {
					status: 302,
					headers: { Location: '/install' }
				});
			}
		} else {
			// Error transitorio de SQLite bajo carga. Se registra pero no se redirige.
			console.error(`[hooks] Temporal DB error during setup guard: ${msg}`);
		}
	}

	return response;
}

/**
 * Global error handler — catches unhandled async errors from +server.js endpoints
 * This prevents unhandled promise rejections from crashing the server
 * and provides structured error responses to the client
 */
export function handleError({ error, event }) {
	const err = error instanceof Error ? error : new Error(String(error));

	// Log detailed error server-side for debugging
	console.error(`[error] ${event.url.pathname}:`, {
		message: err.message,
		stack: err.stack?.split('\n').slice(0, 3).join('\n'),
		method: event.request.method,
		timestamp: new Date().toISOString()
	});

	// DB-specific errors: provide helpful context
	if (
		err.message.includes('DB run error') ||
		err.message.includes('DB get error') ||
		err.message.includes('DB all error')
	) {
		return {
			status: 500,
			message: 'Database operation failed'
		};
	}

	// Generic error: don't leak internal details to client
	return {
		status: 500,
		message: 'Internal server error'
	};
}
