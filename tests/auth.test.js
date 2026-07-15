import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, getDb, closeDb } from '../frontend/src/lib/server/db.js';
import { validateEmail, validateUsername, validatePassword, sanitizeInput } from '../frontend/src/lib/server/security.js';

describe('Security Utilities', () => {
	it('should validate correct email', () => {
		expect(validateEmail('test@example.com')).toBe(true);
		expect(validateEmail('invalid')).toBe(false);
	});

	it('should validate username', () => {
		expect(validateUsername('user_name')).toBe(true);
		expect(validateUsername('us')).toBe(false);
	});

	it('should validate password', () => {
		expect(validatePassword('password123')).toBe(true);
		expect(validatePassword('123')).toBe(false);
	});

	it('should sanitize input', () => {
		expect(sanitizeInput('<script>alert(1)</script>')).toBe('alert(1)');
		expect(sanitizeInput('  hello  ')).toBe('hello');
	});
});

describe('Database Connection', () => {
	beforeAll(async () => {
		await initDb();
	});

	afterAll(() => {
		closeDb();
	});

	it('should connect to the database', () => {
		const db = getDb();
		expect(db).toBeDefined();
	});

	it('should execute a simple query', () => {
		const db = getDb();
		const result = db.prepare('SELECT 1 as value').get();
		expect(result.value).toBe(1);
	});
});
