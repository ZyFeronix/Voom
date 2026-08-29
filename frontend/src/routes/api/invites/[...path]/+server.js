/**
 * Voom! — Invitaciones API (beta cerrada)
 *
 * Gestión admin de los códigos de invitación del registro (migración 019).
 * La lectura y escritura exigen permiso `settings.manage` (staff autorizado);
 * el consumo de códigos ocurre en /api/auth/register, nunca aquí.
 *
 * Sub-rutas:
 *   GET    /api/invites          → lista + resumen de códigos (staff)
 *   POST   /api/invites          → generar N códigos (staff)  { count?, max_uses?, expires_at?, label? }
 *   PUT    /api/invites/:id      → editar código (staff)      { is_active?, max_uses?, expires_at?, label? }
 *   DELETE /api/invites/:id      → eliminar código (staff)
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requirePerm } from '$lib/server/auth.js';
import { createInvites, listInvites, deleteInvite } from '$lib/server/invites.js';
import { logAdminAction } from '$lib/server/audit.js';

function getIp(request) {
	return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
}

/** Normaliza la fecha de expiración a DATETIME UTC ('YYYY-MM-DD HH:MM:SS'). */
function sanitizeExpiry(value) {
	const raw = String(value || '').trim();
	if (!raw) return null;
	const d = new Date(raw.length === 10 ? `${raw}T23:59:59Z` : raw);
	if (isNaN(d.getTime())) return null;
	return d.toISOString().slice(0, 19).replace('T', ' ');
}

export async function GET({ request }) {
	await requirePerm(request, 'settings.manage');
	const invites = await listInvites();

	const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
	const stats = {
		total: invites.length,
		active: invites.filter((i) => i.is_active && (!i.expires_at || i.expires_at > now)).length,
		exhausted: invites.filter((i) => i.max_uses !== null && i.uses_count >= i.max_uses).length,
		totalRegistrations: invites.reduce((acc, i) => acc + (i.used_by_count || 0), 0)
	};

	return json({ success: true, invites, stats });
}

export async function POST({ request }) {
	const { userId } = await requirePerm(request, 'settings.manage');
	const body = await request.json();

	const count = parseInt(body.count, 10) || 1;
	if (count < 1 || count > 100) {
		return json({ error: 'La cantidad debe estar entre 1 y 100' }, { status: 400 });
	}

	let maxUses =
		body.max_uses === null || body.max_uses === undefined || body.max_uses === ''
			? null
			: parseInt(body.max_uses, 10);
	if (maxUses !== null && (isNaN(maxUses) || maxUses < 1 || maxUses > 10000)) {
		return json({ error: 'El máximo de usos debe estar entre 1 y 10000' }, { status: 400 });
	}

	const expiresAt = sanitizeExpiry(body.expires_at);
	const label =
		String(body.label || '')
			.trim()
			.slice(0, 120) || null;

	const created = await createInvites({
		count,
		maxUses,
		expiresAt,
		label,
		createdBy: userId
	});

	await logAdminAction(
		userId,
		'invite.create',
		'invite',
		null,
		{ count, max_uses: maxUses, expires_at: expiresAt, label },
		getIp(request)
	);
	const fresh = await listInvites();
	return json({ success: true, created, invites: fresh }, { status: 201 });
}

export async function PUT({ request, params }) {
	const { userId } = await requirePerm(request, 'settings.manage');
	const parts = params.path ? params.path.split('/') : [];
	const id = parseInt(parts[0] || '0');
	if (!id) return json({ error: 'ID de invitación inválido' }, { status: 400 });

	const db = getDb();
	const body = await request.json();

	const invite = await db.prepare('SELECT * FROM invite_codes WHERE id = ?').get(id);
	if (!invite) return json({ error: 'Invitación no encontrada' }, { status: 404 });

	const changes = {};

	if (body.is_active !== undefined) {
		const active = body.is_active === true || body.is_active === '1' || body.is_active === 1;
		changes.is_active = active ? 1 : 0;
	}
	if (body.max_uses !== undefined) {
		const maxUses =
			body.max_uses === null || body.max_uses === '' ? null : parseInt(body.max_uses, 10);
		if (maxUses !== null && (isNaN(maxUses) || maxUses < 1 || maxUses < invite.uses_count)) {
			return json(
				{ error: 'El máximo de usos no puede ser menor que los usos ya registrados' },
				{ status: 400 }
			);
		}
		changes.max_uses = maxUses;
	}
	if (body.expires_at !== undefined) {
		changes.expires_at = sanitizeExpiry(body.expires_at);
	}
	if (body.label !== undefined) {
		changes.label =
			String(body.label || '')
				.trim()
				.slice(0, 120) || null;
	}

	if (Object.keys(changes).length === 0) {
		return json({ error: 'Nada que actualizar' }, { status: 400 });
	}

	const sets = Object.keys(changes)
		.map((k) => `${k} = ?`)
		.join(', ');
	await db
		.prepare(`UPDATE invite_codes SET ${sets} WHERE id = ?`)
		.run(...Object.values(changes), id);

	await logAdminAction(
		userId,
		'invite.update',
		'invite',
		id,
		{
			from: {
				is_active: invite.is_active,
				max_uses: invite.max_uses,
				expires_at: invite.expires_at,
				label: invite.label
			},
			to: changes
		},
		getIp(request)
	);
	const invites = await listInvites();
	return json({ success: true, invites });
}

export async function DELETE({ request, params }) {
	const { userId } = await requirePerm(request, 'settings.manage');
	const parts = params.path ? params.path.split('/') : [];
	const id = parseInt(parts[0] || '0');
	if (!id) return json({ error: 'ID de invitación inválido' }, { status: 400 });

	const deleted = await deleteInvite(id);
	if (!deleted) return json({ error: 'Invitación no encontrada' }, { status: 404 });

	await logAdminAction(userId, 'invite.delete', 'invite', id, null, getIp(request));
	const invites = await listInvites();
	return json({ success: true, invites });
}
