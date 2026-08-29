/**
 * Voom! — Auth API
 * POST /api/auth/register, login, logout
 * GET  /api/auth/me, /api/auth/sessions
 * PUT  /api/auth/change-password
 * DEL  /api/auth/sessions (?id= revoca una | ?others=1 cierra todas las demás)
 */
import { json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { getDb } from '$lib/server/db.js';
import { requireAuth, createSession } from '$lib/server/auth.js';
import { validateCode, consumeCode } from '$lib/server/invites.js';
import {
	createEmailToken,
	sendEmail,
	renderVerifyEmail,
	renderResetEmail,
	consumeEmailToken
} from '$lib/server/email.js';
import crypto from 'crypto';

// Cooldown en memoria anti-spam de reenvío (email/token endpoints): userId → ms.
const resendCooldown = new Map();

function describeUserAgent(ua) {
	if (!ua || ua === 'unknown') return { device: 'Dispositivo desconocido', browser: '' };
	const browser = /Edg\//.test(ua)
		? 'Edge'
		: /OPR\/|Opera/.test(ua)
			? 'Opera'
			: /Chrome\//.test(ua)
				? 'Chrome'
				: /Safari\//.test(ua)
					? 'Safari'
					: /Firefox\//.test(ua)
						? 'Firefox'
						: 'Navegador';
	let device = 'Escritorio';
	if (/iPhone|Android.*Mobile/.test(ua)) device = 'Móvil';
	else if (/iPad|Tablet/.test(ua)) device = 'Tablet';
	return { device, browser };
}

export async function POST({ request, url }) {
	const action = url.pathname.split('/').pop();
	const body = await request.json();
	const db = getDb();

	if (action === 'register') {
		const username = (body.username || '').trim();
		const email = (body.email || '').trim();
		const password = body.password || '';
		const displayName = (body.display_name || username).trim();
		const category = (body.category || '').trim();

		if (!username || !email || !password)
			return json({ error: 'Faltan campos obligatorios' }, { status: 400 });
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
			return json({ error: 'Formato de email inválido' }, { status: 400 });
		if (password.length < 8)
			return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
		if (!/^[a-zA-Z0-9_]{3,32}$/.test(username))
			return json({ error: 'Usuario inválido' }, { status: 400 });

		// RGPD: edad mínima 13 + consentimiento de Términos y Privacidad
		const birthDate = (body.birth_date || '').trim();
		const acceptedTerms = !!body.accepted_terms;
		if (!birthDate)
			return json({ error: 'La fecha de nacimiento es obligatoria' }, { status: 400 });
		const ageYears = Math.floor((Date.now() - new Date(birthDate).getTime()) / 31557600000);
		if (isNaN(ageYears) || ageYears < 13)
			return json({ error: 'Debes tener al menos 13 años para registrarte' }, { status: 403 });
		if (!acceptedTerms)
			return json(
				{ error: 'Debes aceptar los Términos y la Política de Privacidad' },
				{ status: 400 }
			);

		const existing = await db
			.prepare('SELECT id FROM users WHERE username = ? OR email = ?')
			.get(username, email);
		if (existing) return json({ error: 'El usuario o email ya está en uso' }, { status: 409 });

		// Beta cerrada: flags de registro (parse tolerante — el instalador escribe
		// 'true'/'false' y el panel admin '1'/'0', nunca comparar con === '1').
		const flagRows = await db
			.prepare(
				"SELECT key, value FROM system_settings WHERE key IN ('allow_registration', 'require_invite_code', 'email_verification_required')"
			)
			.all();
		const flags = {};
		for (const r of flagRows) flags[r.key] = r.value;
		const isOn = (v) => v === 1 || v === '1' || v === true || v === 'true';

		if (flags.allow_registration !== undefined && !isOn(flags.allow_registration)) {
			return json({ error: 'El registro está deshabilitado actualmente' }, { status: 403 });
		}

		let pendingInviteCode = null;
		if (isOn(flags.require_invite_code)) {
			const rawCode = (body.invite_code || '').trim();
			if (!rawCode) {
				return json(
					{ error: 'Se requiere un código de invitación para registrarte' },
					{ status: 400 }
				);
			}
			const { valid, reason } = await validateCode(rawCode);
			if (!valid) {
				const messages = {
					invalid: 'El código de invitación no existe',
					inactive: 'Este código de invitación está desactivado',
					exhausted: 'Este código de invitación no tiene más usos disponibles',
					expired: 'Este código de invitación ha expirado'
				};
				return json(
					{ error: messages[reason] || 'Código de invitación inválido' },
					{ status: 403 }
				);
			}
			pendingInviteCode = rawCode;
		}

		const passwordHash = await bcrypt.hash(password, 10);
		const result = await db
			.prepare(
				"INSERT INTO users (username, email, password_hash, display_name, category, birth_date, terms_accepted_at, privacy_accepted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))"
			)
			.run(username, email, passwordHash, displayName || username, category, birthDate);
		const userId = Number(result.lastInsertRowid);

		await db
			.prepare("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'user')")
			.run(userId);

		await db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(userId);

		// Consumo atómico del código (ya con el usuario creado, para trazabilidad
		// en invite_uses). Si una carrera paralela agotó el código, se deshace
		// la cuenta recién creada (cascada sobre roles/settings/sesiones).
		if (pendingInviteCode) {
			const consumed = await consumeCode(pendingInviteCode, userId);
			if (!consumed.ok) {
				await db.prepare('DELETE FROM users WHERE id = ?').run(userId);
				return json({ error: 'Este código de invitación ya no está disponible' }, { status: 403 });
			}
		}

		// Verificación de email (si el admin la exige). Best-effort: sin SMTP
		// sendEmail es no-op con log y el registro sigue creando la cuenta.
		let verificationPending = false;
		if (isOn(flags.email_verification_required)) {
			verificationPending = true;
			const verifyToken = await createEmailToken(userId, 'verify');
			const name = displayName || username;
			sendEmail(
				email,
				'Verifica tu correo — Voom!',
				renderVerifyEmail(verifyToken, name, url.origin)
			).catch(() => {});
		}

		const token = await createSession(userId, request);
		const user = await db
			.prepare(
				`
			SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.cover_url,
				u.bio, u.category, u.is_verified, u.follower_count, u.following_count,
				COALESCE(ur.role, u.role, 'user') AS role,
				(SELECT theme FROM user_settings WHERE user_id = u.id) AS preferred_theme,
				(SELECT accent_color FROM user_settings WHERE user_id = u.id) AS preferred_accent_color,
				(SELECT app_font FROM user_settings WHERE user_id = u.id) AS preferred_app_font,
				(SELECT font_scale FROM user_settings WHERE user_id = u.id) AS preferred_font_scale,
				(SELECT density FROM user_settings WHERE user_id = u.id) AS preferred_density,
				(SELECT app_wallpaper_url FROM user_settings WHERE user_id = u.id) AS preferred_wallpaper_url,
				(SELECT wallpaper_dim FROM user_settings WHERE user_id = u.id) AS preferred_wallpaper_dim,
				(SELECT font_family FROM profile_customizations WHERE user_id = u.id) AS profile_font_family,
				(SELECT custom_font_url FROM profile_customizations WHERE user_id = u.id) AS profile_custom_font_url,
				(SELECT card_opacity FROM user_settings WHERE user_id = u.id) AS preferred_card_opacity,
				(SELECT border_radius FROM user_settings WHERE user_id = u.id) AS preferred_border_radius,
				(SELECT wallpaper_mode FROM user_settings WHERE user_id = u.id) AS preferred_wallpaper_mode,
				(SELECT aero_gloss FROM user_settings WHERE user_id = u.id) AS preferred_aero_gloss,
				(SELECT active_preset FROM user_settings WHERE user_id = u.id) AS preferred_active_preset
			FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id WHERE u.id = ? LIMIT 1
		`
			)
			.get(userId);

		return json({ token, user, email_verification_required: verificationPending }, { status: 201 });
	}

	if (action === 'login') {
		const loginId = (body.login || body.identifier || body.email || '').trim();
		const password = body.password || '';
		if (!loginId || !password) return json({ error: 'Credenciales requeridas' }, { status: 400 });

		const user = await db
			.prepare(
				`
			SELECT u.id, u.username, u.email, u.password_hash, u.display_name, u.avatar_url,
				u.cover_url, u.bio, u.category, u.is_verified, u.email_verified,
				u.follower_count, u.following_count, u.is_banned, u.is_active, u.deleted_at,
				COALESCE(ur.role, u.role, 'user') AS role,
				(SELECT theme FROM user_settings WHERE user_id = u.id) AS preferred_theme,
				(SELECT accent_color FROM user_settings WHERE user_id = u.id) AS preferred_accent_color,
				(SELECT app_font FROM user_settings WHERE user_id = u.id) AS preferred_app_font,
				(SELECT font_scale FROM user_settings WHERE user_id = u.id) AS preferred_font_scale,
				(SELECT density FROM user_settings WHERE user_id = u.id) AS preferred_density,
				(SELECT app_wallpaper_url FROM user_settings WHERE user_id = u.id) AS preferred_wallpaper_url,
				(SELECT wallpaper_dim FROM user_settings WHERE user_id = u.id) AS preferred_wallpaper_dim,
				(SELECT font_family FROM profile_customizations WHERE user_id = u.id) AS profile_font_family,
				(SELECT custom_font_url FROM profile_customizations WHERE user_id = u.id) AS profile_custom_font_url,
				(SELECT card_opacity FROM user_settings WHERE user_id = u.id) AS preferred_card_opacity,
				(SELECT border_radius FROM user_settings WHERE user_id = u.id) AS preferred_border_radius,
				(SELECT wallpaper_mode FROM user_settings WHERE user_id = u.id) AS preferred_wallpaper_mode,
				(SELECT aero_gloss FROM user_settings WHERE user_id = u.id) AS preferred_aero_gloss,
				(SELECT active_preset FROM user_settings WHERE user_id = u.id) AS preferred_active_preset
			FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
			WHERE u.email = ? OR u.username = ? LIMIT 1
		`
			)
			.get(loginId, loginId);

		if (!user) return json({ error: 'Credenciales incorrectas' }, { status: 401 });
		if (user.is_banned) return json({ error: 'Esta cuenta ha sido suspendida' }, { status: 403 });

		const valid = await bcrypt.compare(password, user.password_hash);
		if (!valid) return json({ error: 'Credenciales incorrectas' }, { status: 401 });

		// Verificación de email exigida: bloquear cuentas sin verificar. El admin
		// creado por /setup e /install nace verificado (email_verified=1).
		const verifyFlag = await db
			.prepare("SELECT value FROM system_settings WHERE key = 'email_verification_required'")
			.get();
		const flagOn = (v) => v === 1 || v === '1' || v === true || v === 'true';
		if (flagOn(verifyFlag?.value) && !user.email_verified) {
			return json(
				{
					error: 'Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
					code: 'EMAIL_NOT_VERIFIED'
				},
				{ status: 403 }
			);
		}

		// RGPD: ventana de reactivación de cuenta borrada (soft-delete). Si el usuario
		// inicia sesión dentro de los 30 días se reactiva; pasado ese plazo (el cron ya
		// debería haber hard-deleteado la fila) se bloquea. No filtramos inactivos antes
		// de verificar la contraseña para no revelar si la cuenta existe.
		if (!user.is_active && user.deleted_at) {
			const deletedMs = Date.now() - new Date(user.deleted_at).getTime();
			if (deletedMs > 30 * 86400000)
				return json({ error: 'Esta cuenta ha sido eliminada permanentemente' }, { status: 403 });
			await db
				.prepare('UPDATE users SET deleted_at = NULL, is_active = 1 WHERE id = ?')
				.run(user.id);
		}

		await db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(user.id);

		const token = await createSession(user.id, request);
		delete user.password_hash;
		delete user.is_banned;
		delete user.is_active;
		delete user.deleted_at;

		return json({ token, user });
	}

	if (action === 'logout') {
		const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
		if (token) {
			const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
			await db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(tokenHash);
		}
		return json({ success: true });
	}

	// ── POST /api/auth/forgot-password — solicita email de reset ──
	// Respuesta SIEMPRE neutra: no revela si el email existe en la plataforma.
	if (action === 'forgot-password') {
		const email = (body.email || '').trim().toLowerCase();
		if (!email) return json({ error: 'Email requerido' }, { status: 400 });

		const user = await db
			.prepare('SELECT id, display_name, username, email_verified FROM users WHERE email = ?')
			.get(email);
		if (user && user.email_verified) {
			// Cooldown en memoria: 1 email por cuenta por minuto (anti-spam de buzón).
			const now = Date.now();
			const last = resendCooldown.get(`reset:${user.id}`) || 0;
			if (now - last < 60_000) {
				return json({ success: true, message: 'Si el email existe, te hemos enviado un enlace.' });
			}
			resendCooldown.set(`reset:${user.id}`, now);

			// Invalida tokens reset anteriores: solo el último enlace es válido.
			await db
				.prepare(
					"UPDATE email_tokens SET used = 1 WHERE user_id = ? AND type = 'reset' AND used = 0"
				)
				.run(user.id);
			const resetToken = await createEmailToken(user.id, 'reset');
			const name = user.display_name || user.username;
			sendEmail(
				email,
				'Recupera tu contraseña — Voom!',
				renderResetEmail(resetToken, name, url.origin)
			).catch(() => {});
		}
		return json({ success: true, message: 'Si el email existe, te hemos enviado un enlace.' });
	}

	// ── POST /api/auth/reset-password — consume token y fija nueva contraseña ──
	if (action === 'reset-password') {
		const token = (body.token || '').trim();
		const password = body.password || '';
		if (!token) return json({ error: 'Token requerido' }, { status: 400 });
		if (password.length < 8) {
			return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
		}

		const row = await consumeEmailToken(token);
		if (!row || row.type !== 'reset') {
			return json(
				{ error: 'El enlace es inválido o ha expirado. Solicita otro.' },
				{ status: 400 }
			);
		}

		const passwordHash = await bcrypt.hash(password, 10);
		const result = await db
			.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
			.run(passwordHash, row.user_id);
		if (!result.changes) {
			return json({ error: 'Usuario no encontrado' }, { status: 404 });
		}

		// La contraseña cambió: cerrar todas las sesiones activas de la cuenta.
		await db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(row.user_id);

		return json({ success: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
	}

	// ── POST /api/auth/resend-verification — reenvía el email de verificación ──
	if (action === 'resend-verification') {
		const loginId = (body.email || body.login || '').trim().toLowerCase();
		if (!loginId) return json({ error: 'Email requerido' }, { status: 400 });

		const user = await db
			.prepare(
				'SELECT id, display_name, username, email, email_verified FROM users WHERE email = ? OR username = ?'
			)
			.get(loginId, loginId);
		if (user && !user.email_verified) {
			const now = Date.now();
			const last = resendCooldown.get(`verify:${user.id}`) || 0;
			if (now - last >= 60_000) {
				resendCooldown.set(`verify:${user.id}`, now);
				await db
					.prepare(
						"UPDATE email_tokens SET used = 1 WHERE user_id = ? AND type = 'verify' AND used = 0"
					)
					.run(user.id);
				const verifyToken = await createEmailToken(user.id, 'verify');
				const name = user.display_name || user.username;
				sendEmail(
					user.email,
					'Verifica tu correo — Voom!',
					renderVerifyEmail(verifyToken, name, url.origin)
				).catch(() => {});
			}
		}
		return json({
			success: true,
			message: 'Si el email existe y está sin verificar, te hemos enviado un enlace.'
		});
	}

	return json({ error: 'Endpoint no encontrado' }, { status: 404 });
}

export async function GET({ request, url, params }) {
	const action = params?.action || url.pathname.replace(/\/+$/, '').split('/').pop();

	// ── GET /api/auth/verify-email?token= — clic desde el email ──
	// Navegación del usuario: redirige a /login con el resultado en la query.
	if (action === 'verify-email') {
		const token = url.searchParams.get('token') || '';
		const db = getDb();
		const row = token ? await consumeEmailToken(token) : null;
		if (!row || row.type !== 'verify') {
			return new Response('', { status: 302, headers: { Location: '/login?verified=0' } });
		}
		await db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(row.user_id);
		return new Response('', { status: 302, headers: { Location: '/login?verified=1' } });
	}

	// ── GET /api/auth/config — flags públicos de registro (sin auth) ──
	if (action === 'config') {
		const db = getDb();
		const rows = await db
			.prepare(
				"SELECT key, value FROM system_settings WHERE key IN ('allow_registration', 'require_invite_code')"
			)
			.all();
		const flags = {};
		for (const r of rows) flags[r.key] = r.value;
		const isOn = (v) => v === 1 || v === '1' || v === true || v === 'true';
		return json({
			allow_registration:
				flags.allow_registration === undefined ? true : isOn(flags.allow_registration),
			require_invite_code: isOn(flags.require_invite_code)
		});
	}

	if (action === 'me') {
		const userId = await requireAuth(request);
		const db = getDb();
		const user = await db
			.prepare(
				`
			SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.cover_url, u.bio, u.category,
				COALESCE(ur.role, u.role, 'user') AS role,
				u.is_verified, u.payment_link, u.follower_count, u.following_count, u.created_at,
				u.level, u.xp_points, u.custom_status, u.custom_status_text, u.custom_status_expires_at,
				(SELECT theme FROM user_settings WHERE user_id = u.id) AS preferred_theme,
				(SELECT accent_color FROM user_settings WHERE user_id = u.id) AS preferred_accent_color,
				(SELECT app_font FROM user_settings WHERE user_id = u.id) AS preferred_app_font,
				(SELECT font_scale FROM user_settings WHERE user_id = u.id) AS preferred_font_scale,
				(SELECT density FROM user_settings WHERE user_id = u.id) AS preferred_density,
				(SELECT app_wallpaper_url FROM user_settings WHERE user_id = u.id) AS preferred_wallpaper_url,
				(SELECT wallpaper_dim FROM user_settings WHERE user_id = u.id) AS preferred_wallpaper_dim,
				(SELECT font_family FROM profile_customizations WHERE user_id = u.id) AS profile_font_family,
				(SELECT custom_font_url FROM profile_customizations WHERE user_id = u.id) AS profile_custom_font_url,
				(SELECT card_opacity FROM user_settings WHERE user_id = u.id) AS preferred_card_opacity,
				(SELECT border_radius FROM user_settings WHERE user_id = u.id) AS preferred_border_radius,
				(SELECT wallpaper_mode FROM user_settings WHERE user_id = u.id) AS preferred_wallpaper_mode,
				(SELECT aero_gloss FROM user_settings WHERE user_id = u.id) AS preferred_aero_gloss,
				(SELECT active_preset FROM user_settings WHERE user_id = u.id) AS preferred_active_preset
			FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
			WHERE u.id = ? LIMIT 1
		`
			)
			.get(userId);
		if (!user) return json({ error: 'Usuario no encontrado' }, { status: 404 });
		return json({ user });
	}

	// ── GET /api/auth/sessions — lista de sesiones activas del usuario ──
	if (action === 'sessions') {
		const userId = await requireAuth(request);
		const db = getDb();

		// Identificar la sesión actual por el hash del Bearer token
		const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
		const currentHash = bearer ? crypto.createHash('sha256').update(bearer).digest('hex') : null;

		const sessions = await db
			.prepare(
				`SELECT id, ip_address, user_agent, created_at, expires_at, token_hash
				 FROM user_sessions
				 WHERE user_id = ? AND expires_at > datetime('now')
				 ORDER BY (token_hash = ?) DESC, created_at DESC`
			)
			.all(userId, currentHash);

		return json({
			sessions: sessions.map((s) => ({
				id: s.id,
				ip_address: s.ip_address,
				device: describeUserAgent(s.user_agent),
				user_agent: s.user_agent,
				created_at: s.created_at,
				expires_at: s.expires_at,
				is_current: currentHash != null && s.token_hash === currentHash
			}))
		});
	}

	return json({ error: 'Endpoint no encontrado' }, { status: 404 });
}

export async function DELETE({ request, url }) {
	const action = params_action(url);

	if (action !== 'sessions') return json({ error: 'Endpoint no encontrado' }, { status: 404 });

	const userId = await requireAuth(request);
	const db = getDb();

	const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
	const currentHash = bearer ? crypto.createHash('sha256').update(bearer).digest('hex') : null;

	// Cerrar todas las demás sesiones
	if (url.searchParams.get('others') === '1') {
		if (!currentHash)
			return json({ error: 'No se pudo identificar la sesión actual' }, { status: 400 });
		const result = await db
			.prepare(`DELETE FROM user_sessions WHERE user_id = ? AND token_hash != ?`)
			.run(userId, currentHash);
		return json({ success: true, revoked: result.changes });
	}

	// Revocar una sesión concreta (nunca la actual desde aquí)
	const sessionId = parseInt(url.searchParams.get('id'));
	if (!sessionId) return json({ error: 'Falta el parámetro id' }, { status: 400 });

	const target = await db
		.prepare('SELECT id, token_hash FROM user_sessions WHERE id = ? AND user_id = ?')
		.get(sessionId, userId);
	if (!target) return json({ error: 'Sesión no encontrada' }, { status: 404 });
	if (currentHash && target.token_hash === currentHash) {
		return json(
			{ error: 'No puedes cerrar la sesión actual desde aquí; usa "Cerrar sesión"' },
			{ status: 400 }
		);
	}

	await db.prepare('DELETE FROM user_sessions WHERE id = ?').run(sessionId);
	return json({ success: true });
}

function params_action(url) {
	return url.pathname.replace(/\/+$/, '').split('/').pop();
}

export async function PUT({ request, url }) {
	const action = url.pathname.split('/').pop();

	if (action === 'change-password') {
		const userId = await requireAuth(request);
		const body = await request.json();
		const { currentPassword, newPassword } = body;
		if (!currentPassword || !newPassword)
			return json({ error: 'Faltan campos de contraseña' }, { status: 400 });
		if (newPassword.length < 8)
			return json(
				{ error: 'La nueva contraseña debe tener al menos 8 caracteres' },
				{ status: 400 }
			);

		const db = getDb();
		const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
		if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
			return json({ error: 'Contraseña actual incorrecta' }, { status: 401 });
		}

		const newHash = await bcrypt.hash(newPassword, 10);
		await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);

		// Seguridad: tras cambiar la contraseña se cierran todas las demás sesiones
		const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
		if (bearer) {
			const currentHash = crypto.createHash('sha256').update(bearer).digest('hex');
			await db
				.prepare('DELETE FROM user_sessions WHERE user_id = ? AND token_hash != ?')
				.run(userId, currentHash);
		}

		return json({ success: true, message: 'Contraseña actualizada' });
	}

	return json({ error: 'Endpoint no encontrado' }, { status: 404 });
}
