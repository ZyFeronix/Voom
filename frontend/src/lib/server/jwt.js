/**
 * VSocial — JWT Utilities
 * Token encoding/decoding using jsonwebtoken
 */
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '..', '..', '..', '.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'VSOCIAL_SUPER_SECRET_KEY_2026_!@#$';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '365d';

/**
 * Encode a payload into a JWT token
 */
export function encodeToken(payload) {
	return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Decode and verify a JWT token
 */
export function decodeToken(token) {
	try {
		return jwt.verify(token, JWT_SECRET);
	} catch {
		return null;
	}
}

/**
 * Extract Bearer token from Authorization header
 */
export function getBearerToken(request) {
	const auth = request.headers.get('authorization');
	if (!auth) return null;
	const match = auth.match(/^Bearer\s+(\S+)$/i);
	return match ? match[1] : null;
}

export default { encodeToken, decodeToken, getBearerToken };
