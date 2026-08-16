/**
 * VSocial Security Module
 * Rate limiting, input validation, and security helpers
 */
import { error } from '@sveltejs/kit';

// Simple in-memory rate limiter
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 1000; // per window

export function checkRateLimit(ident) {
	const now = Date.now();
	const record = rateLimitMap.get(ident);

	if (!record) {
		rateLimitMap.set(ident, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
		return true;
	}

	if (now > record.resetAt) {
		record.count = 1;
		record.resetAt = now + RATE_LIMIT_WINDOW;
		return true;
	}

	if (record.count >= MAX_REQUESTS) {
		throw error(429, 'Too Many Requests');
	}

	record.count++;
	return true;
}

export function validateEmail(email) {
	const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return re.test(email);
}

export function validateUsername(username) {
	const re = /^[a-zA-Z0-9_]{3,32}$/;
	return re.test(username);
}

export function sanitizeInput(str) {
	if (typeof str !== 'string') return '';
	return str.replace(/[<>]/g, '').trim();
}

export function validatePassword(password) {
	if (typeof password !== 'string') return false;
	return password.length >= 8;
}

export function anonymizePost(post, currentUserId) {
	if (!post) return post;
	if (post.is_anonymous == 1 || post.is_anonymous === true) {
		const isOwner = Boolean(currentUserId && Number(currentUserId) === Number(post.user_id));
		const anonName = post.anon_username || null;
		post.is_anonymous = 1;
		post.is_author = isOwner ? 1 : 0;
		post.username = anonName || 'anonimo';
		post.display_name = anonName || 'Usuario Anónimo';
		post.avatar_url = null;
		post.is_verified = 0;
		post.level = null;
		post.role = 'user';
		post.title_text = null;
		post.title_color = null;
		if (!isOwner) {
			post.user_id = null;
		}
	}
	return post;
}

// Permanent anonymous username for a user (their public anonymous persona)
export async function getAnonIdentity(db, userId) {
	if (!userId) return null;
	const row = await db
		.prepare('SELECT anon_username FROM anon_identities WHERE user_id = ?')
		.get(userId);
	return row?.anon_username || null;
}

// Force anonymity on a comment (used for comments on anonymous posts).
// `anonUsername` is the commenter's permanent anonymous identity.
export function anonymizeComment(comment, anonUsername) {
	if (!comment) return comment;
	comment.is_anonymous = 1;
	comment.anon_username = anonUsername || null;
	comment.username = anonUsername || 'anonimo';
	comment.display_name = anonUsername || 'Usuario Anónimo';
	comment.avatar_url = null;
	comment.is_verified = 0;
	comment.role = 'user';
	return comment;
}
