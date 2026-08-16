/**
 * VSocial — Media Security & Validation Pipeline
 * Validates binary magic numbers (file signatures) to prevent malicious upload masquerading.
 */

/**
 * Detect file MIME type based on binary magic numbers
 * @param {Uint8Array|Buffer} buffer
 * @returns {string|null} detected MIME type or null if unknown
 */
export function detectMimeType(buffer) {
	if (!buffer || buffer.length < 12) return null;

	// JPEG: FF D8 FF
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
		return 'image/jpeg';
	}

	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47 &&
		buffer[4] === 0x0d &&
		buffer[5] === 0x0a &&
		buffer[6] === 0x1a &&
		buffer[7] === 0x0a
	) {
		return 'image/png';
	}

	// GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
	if (
		buffer[0] === 0x47 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x38 &&
		(buffer[4] === 0x37 || buffer[4] === 0x39) &&
		buffer[5] === 0x61
	) {
		return 'image/gif';
	}

	// WebP: RIFF [4 bytes] WEBP (52 49 46 46 .... 57 45 42 50)
	if (
		buffer[0] === 0x52 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x46 &&
		buffer[8] === 0x57 &&
		buffer[9] === 0x45 &&
		buffer[10] === 0x42 &&
		buffer[11] === 0x50
	) {
		return 'image/webp';
	}

	// WebM / Matroska: 1A 45 DF A3
	if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
		return 'video/webm';
	}

	// MP4 / QuickTime / ISO Base Media File (ftyp signature at offset 4..8)
	if (
		buffer[4] === 0x66 && // 'f'
		buffer[5] === 0x74 && // 't'
		buffer[6] === 0x79 && // 'y'
		buffer[7] === 0x70 // 'p'
	) {
		const brand = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]);
		if (brand === 'avif' || brand === 'avis') {
			return 'image/avif';
		}
		return 'video/mp4';
	}

	// Audio MPEG (MP3): ID3 tag (49 44 33) or sync word (FF FB / FF F3 / FF F2)
	if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
		return 'audio/mpeg';
	}
	if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
		return 'audio/mpeg';
	}

	// Audio OGG: OggS (4F 67 67 53)
	if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
		return 'audio/ogg';
	}

	return null;
}

/**
 * Validate upload buffer against allowed types and max size
 * @param {Object} options
 * @param {Buffer|Uint8Array} options.buffer
 * @param {string} [options.declaredMime]
 * @param {string} [options.filename]
 * @param {string[]} [options.allowedCategories] ['image', 'video', 'audio']
 * @param {number} [options.maxSizeMB]
 * @returns {{ valid: boolean, mimeType: string|null, error?: string }}
 */
export function validateMediaUpload({
	buffer,
	declaredMime = '',
	filename = '',
	allowedCategories = ['image', 'video', 'audio'],
	maxSizeMB = 25
}) {
	if (!buffer || buffer.length === 0) {
		return { valid: false, mimeType: null, error: 'El archivo está vacío' };
	}

	const sizeMB = buffer.length / (1024 * 1024);
	if (sizeMB > maxSizeMB) {
		return {
			valid: false,
			mimeType: null,
			error: `El archivo supera el tamaño máximo permitido (${maxSizeMB}MB)`
		};
	}

	const detectedMime = detectMimeType(buffer);
	if (!detectedMime) {
		// Fallback check for safe SVG images if declared
		if (declaredMime === 'image/svg+xml' || (filename && filename.toLowerCase().endsWith('.svg'))) {
			const text = buffer.slice(0, 1024).toString('utf8');
			if (text.includes('<svg') && !text.includes('<script') && !text.includes('javascript:')) {
				return { valid: true, mimeType: 'image/svg+xml' };
			}
			return {
				valid: false,
				mimeType: null,
				error: 'Archivo SVG inválido o potencialmente inseguro'
			};
		}
		return { valid: false, mimeType: null, error: 'Formato de archivo no reconocido o corrupto' };
	}

	const category = detectedMime.split('/')[0];
	if (!allowedCategories.includes(category)) {
		return {
			valid: false,
			mimeType: detectedMime,
			error: `Tipo de archivo no permitido (${category})`
		};
	}

	return { valid: true, mimeType: detectedMime };
}

/**
 * Sanitize filename to prevent directory traversal
 * @param {string} filename
 * @returns {string}
 */
export function sanitizeMediaFilename(filename) {
	if (!filename) return `${Date.now()}_file`;
	const basename = filename.replace(/^.*[/\\]/, '');
	return basename
		.replace(/[^a-zA-Z0-9._-]/g, '_')
		.replace(/\.{2,}/g, '_')
		.toLowerCase();
}
