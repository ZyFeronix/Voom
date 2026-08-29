/**
 * Voom! — Códigos de invitación (beta cerrada, migración 019).
 *
 * Gate de registro: cuando el setting `require_invite_code` está activo, el
 * registro exige un código activo, no expirado y con usos disponibles.
 * El consumo es atómico (UPDATE condicional) para tolerar registros
 * concurrentes con el mismo código, y `invite_uses` impide reutilizar un
 * código por usuario (UNIQUE user_id).
 */
import { randomBytes } from 'node:crypto';
import { getDb } from './db.js';

/** Normaliza la entrada del usuario: mayúsculas y sin espacios. */
export function normalizeCode(raw) {
	return String(raw ?? '')
		.trim()
		.toUpperCase();
}

/** Genera el valor de un código con formato VOOM-XXXX-XXXX (32 bits de entropía). */
export function generateCodeValue() {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I/O/0/1 para dictado en voz alta
	const bytes = randomBytes(8);
	const pick = (i) => alphabet[bytes[i] % alphabet.length];
	const part = (off) => `${pick(off)}${pick(off + 1)}${pick(off + 2)}${pick(off + 3)}`;
	return `VOOM-${part(0)}-${part(4)}`;
}

/**
 * Crea N códigos de invitación.
 * @param {object} opts
 * @param {number} [opts.count=1]      cuántos códigos generar (1-100)
 * @param {number|null} [opts.maxUses] NULL = ilimitado
 * @param {string|null} [opts.expiresAt] 'YYYY-MM-DD' o DATETIME; NULL = sin expiración
 * @param {string|null} [opts.label]   nota interna del admin
 * @param {number|null} [opts.createdBy]
 * @returns {Promise<Array<{id:number, code:string}>>}
 */
export async function createInvites({
	count = 1,
	maxUses = null,
	expiresAt = null,
	label = null,
	createdBy = null
} = {}) {
	const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 100);
	const db = getDb();
	const created = [];
	for (let i = 0; i < n; i++) {
		// Bucle de reintento: la UNIQUE de `code` puede colisionar en teoría.
		for (let attempt = 0; attempt < 5; attempt++) {
			const code = generateCodeValue();
			try {
				const res = await db
					.prepare(
						`INSERT INTO invite_codes (code, label, max_uses, expires_at, created_by)
						 VALUES (?, ?, ?, ?, ?)`
					)
					.run(code, label ?? null, maxUses ?? null, expiresAt ?? null, createdBy ?? null);
				created.push({ id: Number(res.lastInsertRowid), code });
				break;
			} catch (_err) {
				if (attempt === 4) throw _err;
				// Colisión de código: reintentar con otro valor.
			}
		}
	}
	return created;
}

/** Lista todos los códigos con el conteo de usuarios que los usaron. */
export async function listInvites() {
	const db = getDb();
	const { rows } = await db
		.prepare(
			`SELECT ic.id, ic.code, ic.label, ic.max_uses, ic.uses_count, ic.expires_at,
			        ic.is_active, ic.created_by, ic.created_at,
			        (SELECT COUNT(*) FROM invite_uses iu WHERE iu.code_id = ic.id) AS used_by_count
			 FROM invite_codes ic
			 ORDER BY ic.created_at DESC, ic.id DESC`
		)
		.all();
	return rows ?? [];
}

/** Devuelve un código (sin validar) o null. */
export async function getInviteByCode(code) {
	const db = getDb();
	const row = await db
		.prepare(`SELECT * FROM invite_codes WHERE code = ?`)
		.get(normalizeCode(code));
	return row ?? null;
}

/**
 * Valida un código sin consumirlo.
 * @returns {Promise<{valid: boolean, reason: 'invalid'|'inactive'|'exhausted'|'expired'|null, invite: object|null}>}
 */
export async function validateCode(code) {
	const invite = await getInviteByCode(code);
	if (!invite) return { valid: false, reason: 'invalid', invite: null };
	if (!invite.is_active) return { valid: false, reason: 'inactive', invite };
	if (invite.max_uses !== null && invite.uses_count >= invite.max_uses) {
		return { valid: false, reason: 'exhausted', invite };
	}
	if (
		invite.expires_at &&
		invite.expires_at <= new Date().toISOString().slice(0, 19).replace('T', ' ')
	) {
		return { valid: false, reason: 'expired', invite };
	}
	return { valid: true, reason: null, invite };
}

/**
 * Consume un uso del código de forma atómica y registra al usuario.
 * @returns {Promise<{ok: boolean, reason: 'invalid'|'inactive'|'exhausted'|'expired'|'already_used'|null, invite: object|null}>}
 */
export async function consumeCode(code, userId) {
	const normalized = normalizeCode(code);
	if (!normalized) return { ok: false, reason: 'invalid', invite: null };
	const db = getDb();

	// UPDATE condicional: solo marca el consumo si el código sigue válido
	// en el momento exacto de la carrera (activo, con cupo y sin expirar).
	const res = await db
		.prepare(
			`UPDATE invite_codes SET uses_count = uses_count + 1
			 WHERE code = ? AND is_active = 1
			   AND (max_uses IS NULL OR uses_count < max_uses)
			   AND (expires_at IS NULL OR expires_at > datetime('now'))`
		)
		.run(normalized);

	if (!res.changes) {
		const { valid, reason } = await validateCode(normalized);
		return { ok: false, reason: valid ? 'invalid' : reason, invite: null };
	}

	const invite = await getInviteByCode(normalized);
	try {
		await db
			.prepare(`INSERT INTO invite_uses (code_id, user_id) VALUES (?, ?)`)
			.run(invite.id, userId);
	} catch (_err) {
		// user_id UNIQUE: el usuario ya usó un código → revertir el consumo.
		await db
			.prepare(`UPDATE invite_codes SET uses_count = MAX(uses_count - 1, 0) WHERE id = ?`)
			.run(invite.id);
		return { ok: false, reason: 'already_used', invite };
	}
	return { ok: true, reason: null, invite };
}

/** Elimina un código (los usos se borran en cascada). Devuelve true si existía. */
export async function deleteInvite(id) {
	const db = getDb();
	const res = await db.prepare(`DELETE FROM invite_codes WHERE id = ?`).run(id);
	return res.changes > 0;
}

export default {
	normalizeCode,
	generateCodeValue,
	createInvites,
	listInvites,
	getInviteByCode,
	validateCode,
	consumeCode,
	deleteInvite
};
