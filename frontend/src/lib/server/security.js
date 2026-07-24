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
