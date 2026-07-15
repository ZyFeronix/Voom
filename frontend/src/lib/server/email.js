/**
 * VSocial — Email Engine (Nodemailer + Token System)
 */
import { getDb } from './db.js';
import { randomBytes } from 'crypto';

let transporter = null;

export async function initTransporter() {
	if (transporter) return transporter;
	const db = getDb();
	const host = db.prepare("SELECT value FROM system_settings WHERE key = 'smtp_host'").get()?.value;
	if (!host) return null;

	const nodemailer = await import('nodemailer');
	const port = parseInt(db.prepare("SELECT value FROM system_settings WHERE key = 'smtp_port'").get()?.value || '587');
	const user = db.prepare("SELECT value FROM system_settings WHERE key = 'smtp_user'").get()?.value;
	const pass = db.prepare("SELECT value FROM system_settings WHERE key = 'smtp_pass'").get()?.value;

	transporter = nodemailer.default.createTransport({
		host, port,
		secure: port === 465,
		auth: user && pass ? { user, pass } : undefined
	});
	return transporter;
}

export function generateToken() {
	return randomBytes(32).toString('hex');
}

export function createEmailToken(userId, type = 'verify') {
	const db = getDb();
	const token = generateToken();
	const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
	db.prepare('INSERT INTO email_tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)')
		.run(userId, token, type, expiresAt);
	return token;
}

export function validateEmailToken(token) {
	const db = getDb();
	const row = db.prepare('SELECT * FROM email_tokens WHERE token = ? AND used = 0').get(token);
	if (!row) return null;
	if (new Date(row.expires_at + 'Z').getTime() < Date.now()) {
		db.prepare('DELETE FROM email_tokens WHERE id = ?').run(row.id);
		return null;
	}
	return row;
}

export function consumeEmailToken(token) {
	const db = getDb();
	const row = validateEmailToken(token);
	if (!row) return null;
	db.prepare('UPDATE email_tokens SET used = 1 WHERE id = ?').run(row.id);
	return row;
}

const baseStyle = `
<body style="margin:0;padding:0;font-family:'Inter',system-ui,sans-serif;background:linear-gradient(135deg,#E0F7FA,#ECEFF1);">
<div style="max-width:480px;margin:40px auto;background:rgba(255,255,255,0.7);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.8);border-radius:20px;box-shadow:0 8px 32px rgba(46,134,232,0.1);overflow:hidden;">
<div style="background:linear-gradient(145deg,#4AABDF,#2E86E8);padding:28px 32px;text-align:center;">
<span style="font-family:'Outfit',sans-serif;font-size:1.5rem;font-weight:900;color:#fff;letter-spacing:-0.02em;">VSocial</span>
</div><div style="padding:32px;">`;
const endStyle = `</div><div style="text-align:center;padding:16px;font-size:11px;color:#7D97AE;">© 2026 VSocial Inc.</div></div></body>`;

export function renderVerifyEmail(token, name) {
	const link = `/api/auth/verify-email?token=${token}`;
	return `${baseStyle}
<h2 style="font-family:'Outfit',sans-serif;font-size:1.25rem;font-weight:800;color:#253650;margin:0 0 12px;">Hola, ${name}</h2>
<p style="font-size:0.9rem;color:#546D8A;line-height:1.6;margin:0 0 24px;">Confirma tu correo electrónico para activar tu cuenta. Este enlace expira en 15 minutos.</p>
<a href="${link}" style="display:inline-block;background:linear-gradient(145deg,#4AABDF,#2E86E8);color:#fff;text-decoration:none;font-weight:700;font-size:0.95rem;padding:12px 32px;border-radius:999px;box-shadow:0 4px 14px rgba(46,134,232,0.28);">Verificar correo</a>
<p style="font-size:0.75rem;color:#7D97AE;margin:24px 0 0;">Si no creaste esta cuenta, ignora este mensaje.</p>
${endStyle}`;
}

export function renderResetEmail(token, name) {
	const link = `/reset-password?token=${token}`;
	return `${baseStyle}
<h2 style="font-family:'Outfit',sans-serif;font-size:1.25rem;font-weight:800;color:#253650;margin:0 0 12px;">${name}, ¿olvidaste tu contraseña?</h2>
<p style="font-size:0.9rem;color:#546D8A;line-height:1.6;margin:0 0 24px;">Genera una nueva contraseña. Este enlace expira en 15 minutos.</p>
<a href="${link}" style="display:inline-block;background:linear-gradient(145deg,#4AABDF,#2E86E8);color:#fff;text-decoration:none;font-weight:700;font-size:0.95rem;padding:12px 32px;border-radius:999px;box-shadow:0 4px 14px rgba(46,134,232,0.28);">Resetear contraseña</a>
<p style="font-size:0.75rem;color:#7D97AE;margin:24px 0 0;">Si no solicitaste esto, tu cuenta está segura.</p>
${endStyle}`;
}

export async function sendEmail(to, subject, html) {
	const t = await initTransporter();
	if (!t) { console.warn('[email] No SMTP configured, skipping send to', to); return false; }
	const db = getDb();
	const from = db.prepare("SELECT value FROM system_settings WHERE key = 'smtp_from'").get()?.value || 'noreply@vsocial.app';
	try {
		await t.sendMail({ from, to, subject, html });
		return true;
	} catch (err) {
		console.error('[email] Send failed:', err.message);
		return false;
	}
}
