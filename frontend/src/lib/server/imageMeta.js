/**
 * VSocial — Image Metadata & Dimension Extractor
 * Pure JS binary header parser for PNG, GIF, WebP, and JPEG.
 */

export function getImageMetadata(buffer) {
	if (!buffer || buffer.length < 16) {
		return null;
	}

	// 1. PNG (89 50 4E 47 0D 0A 1A 0A)
	if (
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47 &&
		buffer.length >= 24
	) {
		const width = buffer.readUInt32BE(16);
		const height = buffer.readUInt32BE(20);
		// Check for APNG (animated PNG)
		const isAnimated = buffer.includes(Buffer.from('acTL'));
		return {
			format: 'png',
			mimeType: 'image/png',
			width,
			height,
			isAnimated
		};
	}

	// 2. GIF (GIF87a or GIF89a)
	if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer.length >= 10) {
		const width = buffer.readUInt16LE(6);
		const height = buffer.readUInt16LE(8);
		// Count image descriptors to detect animation
		let isAnimated = false;
		let imgDescriptors = 0;
		for (let i = 10; i < buffer.length - 1; i++) {
			if (buffer[i] === 0x2c) {
				imgDescriptors++;
				if (imgDescriptors > 1) {
					isAnimated = true;
					break;
				}
			}
		}
		return {
			format: 'gif',
			mimeType: 'image/gif',
			width,
			height,
			isAnimated
		};
	}

	// 3. WebP (RIFF....WEBP)
	if (
		buffer[0] === 0x52 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x46 &&
		buffer.toString('ascii', 8, 12) === 'WEBP'
	) {
		const chunkType = buffer.toString('ascii', 12, 16);

		// VP8X (Extended format)
		if (chunkType === 'VP8X' && buffer.length >= 30) {
			const flags = buffer[20];
			const isAnimated = (flags & 0x02) !== 0;
			const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
			const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
			return {
				format: 'webp',
				mimeType: 'image/webp',
				width,
				height,
				isAnimated
			};
		}

		// VP8 (Lossy format)
		if (chunkType === 'VP8 ' && buffer.length >= 30) {
			if (buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
				const width = buffer.readUInt16LE(26) & 0x3fff;
				const height = buffer.readUInt16LE(28) & 0x3fff;
				return {
					format: 'webp',
					mimeType: 'image/webp',
					width,
					height,
					isAnimated: false
				};
			}
		}

		// VP8L (Lossless format)
		if (chunkType === 'VP8L' && buffer.length >= 25) {
			if (buffer[20] === 0x2f) {
				const b0 = buffer[21];
				const b1 = buffer[22];
				const b2 = buffer[23];
				const b3 = buffer[24];
				const width = 1 + (((b1 & 0x3f) << 8) | b0);
				const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
				return {
					format: 'webp',
					mimeType: 'image/webp',
					width,
					height,
					isAnimated: false
				};
			}
		}
	}

	// 4. JPEG (FF D8 FF)
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
		let offset = 2;
		while (offset < buffer.length) {
			if (buffer[offset] !== 0xff) {
				offset++;
				continue;
			}
			const marker = buffer[offset + 1];
			// SOF markers (baseline, extended, progressive, etc.)
			if (
				(marker >= 0xc0 && marker <= 0xc3) ||
				(marker >= 0xc5 && marker <= 0xc7) ||
				(marker >= 0xc9 && marker <= 0xcb) ||
				(marker >= 0xcd && marker <= 0xcf)
			) {
				if (offset + 9 <= buffer.length) {
					const height = buffer.readUInt16BE(offset + 5);
					const width = buffer.readUInt16BE(offset + 7);
					return {
						format: 'jpeg',
						mimeType: 'image/jpeg',
						width,
						height,
						isAnimated: false
					};
				}
			}
			// Skip marker length
			if (offset + 4 <= buffer.length) {
				const length = buffer.readUInt16BE(offset + 2);
				offset += 2 + length;
			} else {
				break;
			}
		}
	}

	return null;
}
