/**
 * VSocial — Stories API
 */
import { json } from '@sveltejs/kit';
import { getDb, getUploadsDir } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { awardXP } from '$lib/server/gamification.js';
import { logActivity } from '$lib/server/activity.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { randomBytes } from 'crypto';

export async function GET({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	await requireAuth(request);
	const db = getDb();

	if (action === 'feed') {
		const allStories = await db
			.prepare(
				`
			SELECT s.*, u.username, u.display_name, u.avatar_url, u.is_verified
			FROM stories s JOIN users u ON s.user_id = u.id
			WHERE s.expires_at > datetime('now') ORDER BY s.created_at ASC
		`
			)
			.all();

		const grouped = {};
		for (const s of allStories) {
			if (!grouped[s.user_id]) {
				grouped[s.user_id] = {
					user_id: s.user_id,
					username: s.username,
					display_name: s.display_name,
					avatar_url: s.avatar_url,
					items: []
				};
			}
			grouped[s.user_id].items.push({
				id: s.id,
				media_url: s.media_url,
				media_type: s.media_type,
				caption: s.caption,
				background_color: s.background_color,
				text_meta: s.text_meta,
				created_at: s.created_at
			});
		}
		return json({ stories: Object.values(grouped) });
	}
	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function POST({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const userId = await requireAuth(request);
	const db = getDb();

	// POST /api/stories/:id/view
	if (parts.length >= 2 && parts[1] === 'view') {
		const storyId = parseInt(parts[0]);
		await db.prepare('UPDATE stories SET view_count = view_count + 1 WHERE id = ?').run(storyId);
		return json({ success: true });
	}

	// POST /api/stories — create story
	if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
		const contentType = request.headers.get('content-type') || '';
		let mediaUrl = '',
			mediaType = 'text',
			caption = '',
			bgColor = '#1B85F3',
			textMeta = null;

		if (contentType.includes('multipart/form-data')) {
			const formData = await request.formData();
			caption = formData.get('caption') || '';
			bgColor = formData.get('background_color') || '#1B85F3';
			textMeta = formData.get('text_meta') || null;
			const file = formData.get('media');

			if (file && file.size > 0) {
				// Validar tamaño: máx 100 MB
				if (file.size > 100 * 1024 * 1024) {
					return json({ error: 'El archivo no puede superar los 100 MB.' }, { status: 400 });
				}
				const uploadDir = getUploadsDir('stories');
				const ext = file.name.split('.').pop() || 'jpg';
				const newName = `story_${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
				const buffer = Buffer.from(await file.arrayBuffer());
				writeFileSync(resolve(uploadDir, newName), buffer);
				mediaUrl = `/uploads/stories/${newName}`;
				mediaType = file.type.includes('video') ? 'video' : 'image';
			}
		} else {
			const body = await request.json();
			mediaUrl = body.media_url || '';
			mediaType = body.media_type || 'text';
			caption = body.caption || '';
			bgColor = body.background_color || '#1B85F3';
			textMeta = body.text_meta
				? typeof body.text_meta === 'string'
					? body.text_meta
					: JSON.stringify(body.text_meta)
				: null;
		}

		// Requiere al menos media o caption
		if (!mediaUrl && !caption.trim()) {
			return json({ error: 'Se requiere al menos una imagen, video o texto.' }, { status: 400 });
		}

		// Asegura que la columna text_meta exista (migración para DBs antiguas)
		try {
			await db.prepare('ALTER TABLE stories ADD COLUMN text_meta TEXT').run();
		} catch (_e) {} // ignora si ya existe

		const result = await db
			.prepare(
				"INSERT INTO stories (user_id, media_url, media_type, caption, background_color, text_meta, expires_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+1 day'))"
			)
			.run(userId, mediaUrl, mediaType, caption, bgColor, textMeta);

		// Gamification: Create Story
		setTimeout(async () => {
			try {
				await awardXP(db, userId, 3).catch(() => {});
			} catch (e) {
				console.error('[Async Story Gamification Error]', e);
			}
		}, 0);

		await logActivity(userId, 'create', 'story', Number(result.lastInsertRowid));

		return json({ success: true, story_id: Number(result.lastInsertRowid) }, { status: 201 });
	}
	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function DELETE({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const userId = await requireAuth(request);
	const db = getDb();

	if (parts.length >= 1) {
		const storyId = parseInt(parts[0]);
		const result = await db
			.prepare('DELETE FROM stories WHERE id = ? AND user_id = ?')
			.run(storyId, userId);
		if (result.changes > 0) {
			// Gamification: Delete Story penalty
			setTimeout(async () => {
				try {
					await awardXP(db, userId, -3).catch(() => {});
				} catch (e) {
					console.error('[Async Delete Story Gamification Error]', e);
				}
			}, 0);
			return json({ success: true, message: 'Story deleted' });
		}
		return json({ error: 'Story not found or unauthorized' }, { status: 404 });
	}
	return json({ error: 'Endpoint not found' }, { status: 404 });
}
