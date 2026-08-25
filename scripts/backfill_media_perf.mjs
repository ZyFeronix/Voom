/**
 * Retro-relleno de optimizaciones de medios (migración 015_media_perf).
 *
 * 1. reels.video_width / video_height: dimensiones leídas con ffmpeg para
 *    todos los reels que aún no las tienen → el cliente elimina el CLS.
 * 2. listing_media.thumb_url: thumbnail JPEG (540px) para cada medio local
 *    de marketplace que aún no lo tiene → el grid deja de servir originales.
 *
 * Uso:  node scripts/backfill_media_perf.mjs [--dry-run]
 */
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');

// Resuelve dependencias desde frontend/node_modules sin acoplar este script.
const { createRequire } = await import('module');
const require = createRequire(resolve(ROOT, 'frontend', 'package.json'));
const { createClient } = require('@libsql/client');

// Los helpers viven en el código del servidor de la app (ESM puro).
const media = await import(
	`file:///${resolve(ROOT, 'frontend/src/lib/server/media.js').replace(/\\/g, '/')}`
);

const db = createClient({ url: `file:${resolve(ROOT, 'database.sqlite')}` });
console.log('[backfill] BD:', resolve(ROOT, 'database.sqlite'));

// ── 1. Dimensiones de reels ──────────────────────────────────────────────────
const reelsRes = await db.execute(
	"SELECT id, video_url FROM reels WHERE video_width IS NULL AND video_url LIKE '/uploads/%'"
);
console.log(`[reels] pendientes: ${reelsRes.rows.length}`);
let reelOk = 0;
for (const row of reelsRes.rows) {
	const abs = resolve(ROOT, 'uploads', String(row.video_url).slice('/uploads/'.length));
	if (!existsSync(abs)) {
		console.log(`  reel ${row.id}: archivo ausente, se omite`);
		continue;
	}
	const dims = await media.getVideoDimensions(abs);
	if (dims) {
		if (!DRY) {
			await db.execute({
				sql: 'UPDATE reels SET video_width = ?, video_height = ? WHERE id = ?',
				args: [dims.width, dims.height, row.id]
			});
		}
		reelOk++;
		console.log(`  reel ${row.id}: ${dims.width}x${dims.height}`);
	} else {
		console.log(`  reel ${row.id}: no se pudieron leer dimensiones`);
	}
}

// ── 2. Thumbnails de listing_media ───────────────────────────────────────────
const mediaRes = await db.execute(
	"SELECT id, media_url FROM listing_media WHERE thumb_url IS NULL AND media_url LIKE '/uploads/listings/%'"
);
console.log(`[marketplace] medios pendientes: ${mediaRes.rows.length}`);
let thumbOk = 0;
for (const row of mediaRes.rows) {
	const url = String(row.media_url);
	if (!/\.(jpe?g|png|webp|gif|avif)$/i.test(url)) continue;
	const srcAbs = resolve(ROOT, 'uploads', url.slice('/uploads/'.length));
	if (!existsSync(srcAbs)) {
		console.log(`  medio ${row.id}: archivo ausente, se omite`);
		continue;
	}
	const thumbName = `thumb_backfill_${row.id}.jpg`;
	const thumbAbs = resolve(ROOT, 'uploads', 'listingthumbs', thumbName);
	const ok = await media.generateImageThumbnail(srcAbs, thumbAbs);
	if (ok && existsSync(thumbAbs)) {
		if (!DRY) {
			await db.execute({
				sql: 'UPDATE listing_media SET thumb_url = ? WHERE id = ?',
				args: [`/uploads/listingthumbs/${thumbName}`, row.id]
			});
		}
		thumbOk++;
		console.log(`  medio ${row.id}: thumbnail OK`);
	} else {
		console.log(`  medio ${row.id}: fallo generando thumbnail`);
	}
}

console.log(
	`\n[backfill] completo${DRY ? ' (dry-run, nada escrito)' : ''} — reels: ${reelOk}, thumbnails: ${thumbOk}`
);
