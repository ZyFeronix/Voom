/**
 * VSocial — Upload API
 * POST /api/upload — Generic file upload
 */
import { json } from '@sveltejs/kit';
import { getUploadsDir } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

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

export async function POST({ request }) {
	const userId = await requireAuth(request);

	const maxMb = 50;
	const maxBytes = maxMb * 1024 * 1024;
	const formData = await request.formData();
	const file = formData.get('file');
	if (!file) return json({ error: 'No file uploaded' }, { status: 400 });
	if (file.size > maxBytes)
		return json({ error: `File exceeds maximum allowed size of ${maxMb}MB` }, { status: 400 });

	const mimeType = file.type;
	if (!ALLOWED_MIMES[mimeType])
		return json({ error: 'Invalid file type. MIME detected: ' + mimeType }, { status: 400 });

	const ext = ALLOWED_MIMES[mimeType];
	const context = ['avatar', 'cover', 'chat', 'listing', 'post', 'font'].includes(
		formData.get('context')
	)
		? formData.get('context')
		: 'chat';
	const subfolder = context + 's';
	const uploadDir = getUploadsDir(subfolder);

	const newName = `${userId}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
	const buffer = Buffer.from(await file.arrayBuffer());
	writeFileSync(resolve(uploadDir, newName), buffer);

	const url = `/uploads/${subfolder}/${newName}`;
	const type = mimeType.startsWith('image/') ? 'image' : 'audio';
	return json({ success: true, url, type, mime: mimeType, size: file.size });
}
