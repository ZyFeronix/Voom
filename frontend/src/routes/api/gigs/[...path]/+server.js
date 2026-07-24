/**
 * VSocial — Gigs API
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export async function GET({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const db = getDb();

	if (action && /^\d+$/.test(action)) {
		const gig = await db
			.prepare(
				'SELECT g.*, u.username, u.display_name, u.avatar_url, u.is_verified, u.category as creator_category FROM gigs g JOIN users u ON g.user_id = u.id WHERE g.id = ?'
			)
			.get(parseInt(action));
		if (!gig) return json({ error: 'Gig no encontrado' }, { status: 404 });
		gig.tags = gig.tags ? gig.tags.split(',') : [];
		return json({ gig });
	}

	const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
	const limit = Math.min(30, Math.max(1, parseInt(url.searchParams.get('limit')) || 15));
	const offset = (page - 1) * limit;

	if (url.searchParams.get('my') || url.searchParams.get('mine')) {
		const userId = await requireAuth(request);
		const gigs = await db
			.prepare(
				'SELECT g.*, u.username, u.display_name, u.avatar_url, u.is_verified FROM gigs g JOIN users u ON g.user_id = u.id WHERE g.user_id = ? ORDER BY g.created_at DESC LIMIT ? OFFSET ?'
			)
			.all(userId, limit, offset);
		gigs.forEach((g) => {
			g.tags = g.tags ? g.tags.split(',') : [];
		});
		return json({ gigs });
	}

	if (url.searchParams.has('applications')) {
		const userId = await requireAuth(request);
		const apps = await db
			.prepare(
				'SELECT ga.*, g.title as gig_title, g.category, g.type, g.price_min, g.price_max, u.username as owner_username, u.display_name as owner_name, u.avatar_url as owner_avatar FROM gig_applications ga JOIN gigs g ON ga.gig_id = g.id JOIN users u ON g.user_id = u.id WHERE ga.user_id = ? ORDER BY ga.created_at DESC LIMIT ? OFFSET ?'
			)
			.all(userId, limit, offset);
		return json({ applications: apps });
	}

	const where = ["g.status = 'open'"];
	const vals = [];
	if (url.searchParams.get('category')) {
		where.push('g.category = ?');
		vals.push(url.searchParams.get('category'));
	}
	if (url.searchParams.get('type')) {
		where.push('g.type = ?');
		vals.push(url.searchParams.get('type'));
	}
	if (url.searchParams.get('q')) {
		const lq = `%${url.searchParams.get('q')}%`;
		where.push('(g.title LIKE ? OR g.description LIKE ? OR g.tags LIKE ?)');
		vals.push(lq, lq, lq);
	}

	const whereStr = where.join(' AND ');
	const gigs = await db
		.prepare(
			`SELECT g.*, u.username, u.display_name, u.avatar_url, u.is_verified, u.category as creator_category FROM gigs g JOIN users u ON g.user_id = u.id WHERE ${whereStr} ORDER BY g.created_at DESC LIMIT ? OFFSET ?`
		)
		.all(...vals, limit, offset);
	gigs.forEach((g) => {
		g.tags = g.tags ? g.tags.split(',') : [];
	});
	const total = await db.prepare(`SELECT COUNT(*) FROM gigs g WHERE ${whereStr}`).get(...vals)[
		'COUNT(*)'
	];
	return json({ gigs, total, page, limit });
}

export async function POST({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const subaction = parts[1] || '';
	const userId = await requireAuth(request);
	const body = await request.json();
	const db = getDb();

	if (action && /^\d+$/.test(action) && subaction === 'apply') {
		const gigId = parseInt(action);
		const gig = await db.prepare('SELECT id, user_id, status FROM gigs WHERE id = ?').get(gigId);
		if (!gig) return json({ error: 'Gig no encontrado' }, { status: 404 });
		if (gig.status !== 'open')
			return json({ error: 'Este gig ya no acepta aplicaciones' }, { status: 400 });
		if (gig.user_id === userId)
			return json({ error: 'No puedes aplicar a tu propio gig' }, { status: 400 });

		const result = await db
			.prepare('INSERT OR IGNORE INTO gig_applications (gig_id, user_id, message) VALUES (?, ?, ?)')
			.run(gigId, userId, body.message || '');
		if (result.changes > 0)
			await db.prepare('UPDATE gigs SET apply_count = apply_count + 1 WHERE id = ?').run(gigId);
		return json({ success: true, message: 'Aplicación enviado' });
	}

	if (!action) {
		const title = (body.title || '').trim();
		const desc = (body.description || '').trim();
		if (!title || !desc)
			return json({ error: 'Título y descripción son requeridos' }, { status: 400 });

		const result = await db
			.prepare(
				'INSERT INTO gigs (user_id, title, description, category, type, price_min, price_max, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
			)
			.run(
				userId,
				title,
				desc,
				body.category || 'other',
				body.type || 'commission',
				body.price_min || 0,
				body.price_max || 0,
				Array.isArray(body.tags) ? body.tags.slice(0, 10).join(',') : ''
			);
		return json(
			{ success: true, gig_id: Number(result.lastInsertRowid), message: 'Gig publicado' },
			{ status: 201 }
		);
	}
	return json({ error: 'Endpoint no encontrado' }, { status: 404 });
}

export async function PUT({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const userId = await requireAuth(request);
	const gigId = parseInt(parts[0]);
	const body = await request.json();
	const db = getDb();

	const gig = await db.prepare('SELECT id, user_id FROM gigs WHERE id = ?').get(gigId);
	if (!gig) return json({ error: 'Gig no encontrado' }, { status: 404 });
	if (gig.user_id !== userId) return json({ error: 'Sin permiso' }, { status: 403 });

	const allowed = ['title', 'description', 'category', 'type', 'price_min', 'price_max', 'status'];
	const updates = [];
	const vals = [];
	for (const f of allowed) {
		if (body[f] !== undefined) {
			updates.push(`${f} = ?`);
			vals.push(body[f]);
		}
	}
	if (body.tags) {
		updates.push('tags = ?');
		vals.push(Array.isArray(body.tags) ? body.tags.slice(0, 10).join(',') : body.tags);
	}
	if (!updates.length) return json({ error: 'Nada que actualizar' }, { status: 400 });

	vals.push(gigId);
	await db.prepare(`UPDATE gigs SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
	return json({ success: true });
}

export async function DELETE({ request, _url, params }) {
	const userId = await requireAuth(request);
	const gigId = parseInt((params.path ? params.path.split('/') : [])[0]);
	const db = getDb();
	const gig = await db.prepare('SELECT user_id FROM gigs WHERE id = ?').get(gigId);
	if (!gig) return json({ error: 'Gig no encontrado' }, { status: 404 });
	if (gig.user_id !== userId) return json({ error: 'Sin permiso' }, { status: 403 });
	await db.prepare('DELETE FROM gigs WHERE id = ?').run(gigId);
	return json({ success: true });
}
