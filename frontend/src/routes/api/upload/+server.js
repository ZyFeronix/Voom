/**
 * Voom! — Upload API
 * POST /api/upload — Generic file upload
 */
import { json } from '@sveltejs/kit';
import { getUploadsDir } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { imageSize } from 'image-size';

const ALLOWED_MIMES = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'audio/webm': 'webm',
	'audio/mp4': 'mp4',
	'audio/mpeg': 'mp3',
	'audio/ogg': 'ogg',
	'video/mp4': 'mp4',
	'video/webm': 'webm',
	'font/otf': 'otf',
	'font/ttf': 'ttf',
	'font/woff2': 'woff2',
	'font/woff': 'woff',
	'application/x-font-opentype': 'otf',
	'application/x-font-truetype': 'ttf',
	'application/font-woff': 'woff'
};

/**
 * Deduce la extensión de una fuente por firma binaria. Los navegadores mandan
 * los .ttf/.otf (y a veces .woff/.woff2) como application/octet-stream, así que
 * el MIME declarado no basta para aceptarlas.
 *   OTF/TTC: 'OTTO' | 'ttcf' · TTF: 0x00010000 · WOFF: 'wOFF' · WOFF2: 'wOF2'
 */
function detectFontExtension(buffer) {
	if (!buffer || buffer.length < 4) return null;
	const tag = buffer.toString('latin1', 0, 4);
	if (tag === 'OTTO' || tag === 'ttcf') return 'otf';
	if (tag === 'wOFF') return 'woff';
	if (tag === 'wOF2') return 'woff2';
	if (buffer[0] === 0x00 && buffer[1] === 0x01 && buffer[2] === 0x00 && buffer[3] === 0x00)
		return 'ttf';
	return null;
}

/**
 * Validación server-side de dimensiones para imágenes de perfil (REQUERIMIENTOS
 * 1.3): el ImageCropperModal ya recorta en cliente, pero el servidor es fuente
 * de verdad — rechaza avatares no cuadrados y portadas sin proporción de banner.
 */
function validateProfileImage(context, buffer) {
	if (context !== 'avatar' && context !== 'cover') return null;
	let dims;
	try {
		dims = imageSize(buffer);
	} catch {
		return 'No se pudo leer la imagen (archivo corrupto o no soportado)';
	}
	const { width, height } = dims;
	if (!width || !height) return 'No se pudo leer la imagen';
	if (context === 'avatar') {
		if (width < 100 || height < 100) {
			return 'El avatar debe medir al menos 100×100 píxeles';
		}
		const ratio = width / height;
		if (ratio < 0.95 || ratio > 1.05) {
			return 'El avatar debe ser cuadrado (proporción 1:1)';
		}
	}
	if (context === 'cover') {
		if (width < 800) {
			return 'La portada debe medir al menos 800px de ancho';
		}
		const ratio = width / height;
		if (ratio < 2 || ratio > 8) {
			return 'La portada debe tener proporción de banner (entre 2:1 y 8:1)';
		}
	}
	return null;
}

export async function POST({ request }) {
	const userId = await requireAuth(request);

	const maxMb = 50;
	const maxBytes = maxMb * 1024 * 1024;
	const formData = await request.formData();
	const file = formData.get('file');
	if (!file) return json({ error: 'No file uploaded' }, { status: 400 });
	if (file.size > maxBytes)
		return json({ error: `File exceeds maximum allowed size of ${maxMb}MB` }, { status: 400 });

	let mimeType = file.type;
	let ext = ALLOWED_MIMES[mimeType];
	let buffer = null;

	// Fuente con MIME genérico (octet-stream): validar por firma binaria.
	if (!ext && (mimeType === 'application/octet-stream' || mimeType === '')) {
		buffer = Buffer.from(await file.arrayBuffer());
		const fontExt = detectFontExtension(buffer);
		if (fontExt) {
			ext = fontExt;
			mimeType = `font/${fontExt}`;
		}
	}

	if (!ext)
		return json({ error: 'Invalid file type. MIME detected: ' + mimeType }, { status: 400 });

	const context = ['avatar', 'cover', 'chat', 'listing', 'post', 'font'].includes(
		formData.get('context')
	)
		? formData.get('context')
		: 'chat';
	const subfolder = context + 's';
	const uploadDir = getUploadsDir(subfolder);

	const newName = `${userId}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
	if (!buffer) buffer = Buffer.from(await file.arrayBuffer());
	if (mimeType.startsWith('image/')) {
		const dimError = validateProfileImage(context, buffer);
		if (dimError) return json({ error: dimError }, { status: 400 });
	}
	writeFileSync(resolve(uploadDir, newName), buffer);

	const url = `/uploads/${subfolder}/${newName}`;
	const type = mimeType.startsWith('image/')
		? 'image'
		: mimeType.startsWith('font/') ||
			  mimeType.startsWith('application/x-font') ||
			  mimeType.startsWith('application/font')
			? 'font'
			: mimeType.startsWith('video/')
				? 'video'
				: 'audio';
	return json({ success: true, url, type, mime: mimeType, size: file.size });
}
