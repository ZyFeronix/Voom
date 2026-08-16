/**
 * VSocial — Tags API
 *
 * Tags curados por administración que alimentan los filtros de /explore.
 * La lectura es pública; la escritura exige rol de administrador.
 *
 * Sub-rutas:
 *   GET    /api/tags            → lista de tags (pública, incluye post_count)
 *   POST   /api/tags            → crear tag (admin)        { name, icon? }
 *   PUT    /api/tags/:id        → actualizar tag (admin)   { name?, icon? }
 *   DELETE /api/tags/:id        → eliminar tag (admin)
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAdmin } from '$lib/server/auth.js';

const VALID_ICONS = new Set([
	'sell',
	'sports_esports',
	'palette',
	'music_note',
	'auto_awesome',
	'live_tv',
	'movie',
	'photo_camera',
	'code',
	'school',
	'fitness_center',
	'restaurant',
	'pets',
	'favorite',
	'star',
	'videogame_asset',
	'brush',
	'mic',
	'headphones',
	'public',
	'rocket_launch',
	'science',
	'memory',
	'architecture'
]);

/** "Arte Digital" → "arte-digital" (sin acentos, minúsculas, guiones). */
function slugify(name) {
	return String(name || '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function sanitizeName(value) {
	return String(value || '')
		.trim()
		.slice(0, 60);
}

function sanitizeIcon(value) {
	const icon = String(value || '')
		.trim()
		.slice(0, 40);
	return VALID_ICONS.has(icon) ? icon : 'sell';
}

const TAG_SELECT = `
	SELECT t.*,
		(SELECT COUNT(*) FROM post_hashtags ph WHERE ph.tag_name = t.slug) AS post_count
	FROM tags t
`;

export async function GET({ url }) {
	const db = getDb();
	const q = (url.searchParams.get('q') || '').trim().toLowerCase();

	let rows;
	if (q) {
		rows = await db
			.prepare(`${TAG_SELECT} WHERE t.name LIKE ? OR t.slug LIKE ? ORDER BY t.name ASC`)
			.all(`%${q}%`, `%${q}%`);
	} else {
		rows = await db.prepare(`${TAG_SELECT} ORDER BY t.name ASC`).all();
	}

	return json({ success: true, tags: rows });
}

export async function POST({ request }) {
	await requireAdmin(request);
	const db = getDb();
	const body = await request.json();

	const name = sanitizeName(body.name);
	if (!name) return json({ error: 'El nombre del tag es obligatorio' }, { status: 400 });

	const slug = slugify(name);
	if (!slug) return json({ error: 'Nombre de tag inválido' }, { status: 400 });

	const existing = await db.prepare('SELECT id FROM tags WHERE slug = ?').get(slug);
	if (existing) {
		return json({ error: 'Ya existe un tag con ese nombre' }, { status: 409 });
	}

	const icon = sanitizeIcon(body.icon);
	const result = await db
		.prepare('INSERT INTO tags (name, slug, icon) VALUES (?, ?, ?)')
		.run(name, slug, icon);

	const tag = await db.prepare(`${TAG_SELECT} WHERE t.id = ?`).get(result.lastInsertRowid);
	return json({ success: true, tag });
}

export async function PUT({ request, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const id = parseInt(parts[0] || '0');
	if (!id) return json({ error: 'ID de tag inválido' }, { status: 400 });

	await requireAdmin(request);
	const db = getDb();
	const body = await request.json();

	const tag = await db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
	if (!tag) return json({ error: 'Tag no encontrado' }, { status: 404 });

	let name = tag.name;
	let slug = tag.slug;
	let icon = tag.icon;

	if (body.name !== undefined) {
		name = sanitizeName(body.name);
		if (!name) return json({ error: 'El nombre del tag es obligatorio' }, { status: 400 });
		slug = slugify(name);
		const clash = await db.prepare('SELECT id FROM tags WHERE slug = ? AND id != ?').get(slug, id);
		if (clash) {
			return json({ error: 'Ya existe un tag con ese nombre' }, { status: 409 });
		}
	}
	if (body.icon !== undefined) {
		icon = sanitizeIcon(body.icon);
	}

	await db
		.prepare('UPDATE tags SET name = ?, slug = ?, icon = ? WHERE id = ?')
		.run(name, slug, icon, id);

	const updated = await db.prepare(`${TAG_SELECT} WHERE t.id = ?`).get(id);
	return json({ success: true, tag: updated });
}

export async function DELETE({ request, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const id = parseInt(parts[0] || '0');
	if (!id) return json({ error: 'ID de tag inválido' }, { status: 400 });

	await requireAdmin(request);
	const db = getDb();

	const result = await db.prepare('DELETE FROM tags WHERE id = ?').run(id);
	if (result.changes === 0) {
		return json({ error: 'Tag no encontrado' }, { status: 404 });
	}

	return json({ success: true, message: 'Tag eliminado' });
}
