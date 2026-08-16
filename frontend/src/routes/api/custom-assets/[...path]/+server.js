/**
 * VSocial — Custom Assets API (Emotes, Stickers, Emojis, GIFs)
 * PRE-PRODUCTION EXPERIMENTAL FEATURE
 * Exclusively for 'team' (Equipo V-SOCIAL) and higher staff roles.
 *
 * GET    /api/custom-assets       — List custom assets (with filters)
 * GET    /api/custom-assets/specs — Technical dimensions and rules
 * POST   /api/custom-assets       — Upload & register custom asset
 * DELETE /api/custom-assets/:id   — Delete custom asset
 */
import { json } from '@sveltejs/kit';
import { getDb, getUploadsDir } from '$lib/server/db.js';
import { requireAuth, requireTeamOrHigher } from '$lib/server/auth.js';
import { getImageMetadata } from '$lib/server/imageMeta.js';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// Specification constraints for each asset type
const ASSET_SPECS = {
	emoji: {
		label: 'Emoji Personalizado',
		targetWidth: 64,
		targetHeight: 64,
		minWidth: 32,
		maxWidth: 128,
		minHeight: 32,
		maxHeight: 128,
		strictSquare: true,
		maxBytes: 256 * 1024, // 256 KB
		allowedMimes: ['image/png', 'image/webp'],
		description:
			'Icono cuadrado para texto en línea, comentarios y estados. Fondo transparente recomendado (1:1, 64×64 o 128×128 px).'
	},
	emote: {
		label: 'Emote de Transmisión / Chat',
		targetWidth: 112,
		targetHeight: 112,
		minWidth: 28,
		maxWidth: 128,
		minHeight: 28,
		maxHeight: 128,
		strictSquare: true,
		maxBytes: 512 * 1024, // 512 KB
		allowedMimes: ['image/png', 'image/webp', 'image/gif'],
		description: 'Emblema para reacciones y chat estilo stream (1:1 exacto, 112×112 px estándar).'
	},
	sticker: {
		label: 'Sticker de Mensajería',
		targetWidth: 320,
		targetHeight: 320,
		minWidth: 128,
		maxWidth: 512,
		minHeight: 128,
		maxHeight: 512,
		strictSquare: false,
		maxBytes: 1024 * 1024, // 1 MB
		allowedMimes: ['image/png', 'image/webp', 'image/gif'],
		description:
			'Ilustración o pegatina de alta resolución para mensajes y publicaciones (320×320 a 512×512 px).'
	},
	gif: {
		label: 'GIF Animado / Expresión',
		targetWidth: 256,
		targetHeight: 256,
		minWidth: 64,
		maxWidth: 480,
		minHeight: 64,
		maxHeight: 480,
		strictSquare: false,
		maxBytes: 2560 * 1024, // 2.5 MB
		allowedMimes: ['image/gif', 'image/webp'],
		description:
			'Animación en bucle para momentos destacados y reacciones dinámicas (máximo 480×480 px, 2.5 MB).'
	}
};

/**
 * GET /api/custom-assets
 * Dispatches:
 *   /api/custom-assets/specs -> Returns dimension technical specs
 *   /api/custom-assets -> Returns asset list
 */
export async function GET({ url, params, request }) {
	const path = (params.path || '').trim();

	// 1. GET /api/custom-assets/specs
	if (path === 'specs') {
		return json({
			success: true,
			specs: ASSET_SPECS,
			authorized_roles: ['team', 'support', 'moderator', 'admin', 'super_admin', 'staff'],
			environment: 'pre-production-experimental'
		});
	}

	// 2. GET /api/custom-assets (List items)
	const db = getDb();
	const type = url.searchParams.get('type');
	const search = (url.searchParams.get('search') || '').trim().toLowerCase();
	const mineOnly = url.searchParams.get('mine') === '1' || url.searchParams.get('mine') === 'true';

	let userId = null;
	if (mineOnly) {
		userId = await requireAuth(request);
	}

	let sql = `
		SELECT ca.*, u.username, u.display_name, u.avatar_url, COALESCE(ur.role, u.role, 'user') as author_role
		FROM custom_assets ca
		JOIN users u ON u.id = ca.user_id
		LEFT JOIN user_roles ur ON ur.user_id = u.id
		WHERE 1=1
	`;
	const queryArgs = [];

	if (type && ASSET_SPECS[type]) {
		sql += ` AND ca.asset_type = ?`;
		queryArgs.push(type);
	}

	if (userId) {
		sql += ` AND ca.user_id = ?`;
		queryArgs.push(userId);
	}

	if (search) {
		sql += ` AND (ca.name LIKE ? OR ca.shortcode LIKE ?)`;
		queryArgs.push(`%${search}%`, `%${search}%`);
	}

	sql += ` ORDER BY ca.created_at DESC LIMIT 100`;

	const assets = await db.prepare(sql).all(...queryArgs);
	return json({ success: true, assets });
}

/**
 * POST /api/custom-assets
 * Uploads, validates exact dimensions, and saves new custom asset
 */
export async function POST({ request }) {
	const { userId } = await requireTeamOrHigher(request);

	const formData = await request.formData();
	const file = formData.get('file');
	const name = (formData.get('name') || '').trim();
	let shortcode = (formData.get('shortcode') || '').trim();
	const assetType = (formData.get('asset_type') || 'emote').trim().toLowerCase();

	if (!file) {
		return json({ error: 'Debes seleccionar un archivo de imagen.' }, { status: 400 });
	}

	if (!name || name.length < 2 || name.length > 64) {
		return json(
			{ error: 'El nombre del activo debe tener entre 2 y 64 caracteres.' },
			{ status: 400 }
		);
	}

	// Format shortcode: sanitize to alphanumeric/underscore and ensure leading/trailing colons
	shortcode = shortcode.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
	if (!shortcode || shortcode.length < 2 || shortcode.length > 32) {
		return json(
			{
				error:
					'El código corto (shortcode) debe contener solo letras, números o guiones bajos (entre 2 y 32 caracteres).'
			},
			{ status: 400 }
		);
	}
	const formattedShortcode = `:${shortcode}:`;

	const spec = ASSET_SPECS[assetType];
	if (!spec) {
		return json(
			{
				error: `Tipo de activo inválido: "${assetType}". Tipos válidos: emoji, emote, sticker, gif.`
			},
			{ status: 400 }
		);
	}

	// Validate file size
	if (file.size > spec.maxBytes) {
		const maxKb = Math.round(spec.maxBytes / 1024);
		return json(
			{
				error: `El archivo supera el tamaño máximo permitido para ${spec.label} (${maxKb} KB). Peso actual: ${Math.round(file.size / 1024)} KB.`
			},
			{ status: 400 }
		);
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const meta = getImageMetadata(buffer);

	if (!meta) {
		return json(
			{
				error:
					'Formato de imagen inválido o corrupto. Asegúrate de subir un archivo PNG, WebP o GIF válido.'
			},
			{ status: 400 }
		);
	}

	if (!spec.allowedMimes.includes(meta.mimeType)) {
		return json(
			{
				error: `El tipo MIME ${meta.mimeType} no está permitido para ${spec.label}. Formatos permitidos: ${spec.allowedMimes.map((m) => m.split('/')[1].toUpperCase()).join(', ')}.`
			},
			{ status: 400 }
		);
	}

	// Validate Dimensions
	const { width, height } = meta;

	if (spec.strictSquare && width !== height) {
		return json(
			{
				error: `Las medidas para ${spec.label} deben ser estrictamente cuadradas (relación de aspecto 1:1). Medidas recibidas: ${width}×${height} px.`
			},
			{ status: 400 }
		);
	}

	if (
		width < spec.minWidth ||
		width > spec.maxWidth ||
		height < spec.minHeight ||
		height > spec.maxHeight
	) {
		return json(
			{
				error: `Dimensiones fuera del rango exacto para ${spec.label}. Rango requerido: de ${spec.minWidth}×${spec.minHeight} px a ${spec.maxWidth}×${spec.maxHeight} px (Objetivo recomendado: ${spec.targetWidth}×${spec.targetHeight} px). Medidas recibidas: ${width}×${height} px.`
			},
			{ status: 400 }
		);
	}

	// Animated GIF validation
	if (assetType === 'gif' && !meta.isAnimated && meta.mimeType !== 'image/gif') {
		return json(
			{
				error:
					'Para la categoría GIF animado, el archivo debe ser un GIF o WebP con animación activa.'
			},
			{ status: 400 }
		);
	}

	// Prepare file storage
	const ext = meta.format;
	const uploadDir = getUploadsDir('emotes');
	if (!existsSync(uploadDir)) {
		mkdirSync(uploadDir, { recursive: true });
	}

	const fileName = `${userId}_${assetType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
	const destPath = resolve(uploadDir, fileName);

	writeFileSync(destPath, buffer);
	const fileUrl = `/uploads/emotes/${fileName}`;

	// Save in DB
	const db = getDb();
	const result = await db
		.prepare(
			`INSERT INTO custom_assets 
			(user_id, name, shortcode, asset_type, url, width, height, size_bytes, mime_type, is_animated, is_approved)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
		)
		.run(
			userId,
			name,
			formattedShortcode,
			assetType,
			fileUrl,
			width,
			height,
			file.size,
			meta.mimeType,
			meta.isAnimated ? 1 : 0
		);

	const createdAsset = await db
		.prepare(
			`SELECT ca.*, u.username, u.display_name, u.avatar_url, COALESCE(ur.role, u.role, 'user') as author_role
			 FROM custom_assets ca
			 JOIN users u ON u.id = ca.user_id
			 LEFT JOIN user_roles ur ON ur.user_id = u.id
			 WHERE ca.id = ?`
		)
		.get(result.lastInsertRowid);

	return json({
		success: true,
		message: `¡${spec.label} "${name}" subido y verificado con éxito!`,
		asset: createdAsset
	});
}

/**
 * DELETE /api/custom-assets/:id
 */
export async function DELETE({ params, request }) {
	const { userId, role } = await requireTeamOrHigher(request);
	const assetId = parseInt(params.path, 10);

	if (!assetId || isNaN(assetId)) {
		return json({ error: 'ID de activo inválido.' }, { status: 400 });
	}

	const db = getDb();
	const asset = await db.prepare('SELECT * FROM custom_assets WHERE id = ?').get(assetId);

	if (!asset) {
		return json({ error: 'Activo no encontrado.' }, { status: 404 });
	}

	const isStaff = ['admin', 'super_admin'].includes(role);
	if (asset.user_id !== userId && !isStaff) {
		return json(
			{ error: 'No tienes permiso para eliminar este activo personalizado.' },
			{ status: 403 }
		);
	}

	// Delete file from disk if exists
	try {
		if (asset.url && asset.url.startsWith('/uploads/emotes/')) {
			const fileName = asset.url.replace('/uploads/emotes/', '');
			const filePath = resolve(getUploadsDir('emotes'), fileName);
			if (existsSync(filePath)) {
				unlinkSync(filePath);
			}
		}
	} catch (e) {
		console.warn('Could not delete file from disk:', e);
	}

	await db.prepare('DELETE FROM custom_assets WHERE id = ?').run(assetId);

	return json({ success: true, message: 'Activo eliminado correctamente.' });
}
