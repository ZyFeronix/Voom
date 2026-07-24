/**
 * VSocial — Universal Database Adapter
 * Auto-detects available driver:
 *   1. @libsql/client (preferred — prebuilds, WAL, remote support)
 *   2. better-sqlite3 (fallback — already installed, native, WAL)
 *
 * Both expose the SAME async API: db.prepare(sql).run/get/all() → Promise
 */
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { config } from 'dotenv';

const rootDir = resolve(
	dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1'),
	'..',
	'..',
	'..',
	'..'
);
config({ path: resolve(rootDir, '.env') });

const DB_PATH = process.env.DB_PATH || resolve(rootDir, 'database.sqlite');
const DB_URL = process.env.DATABASE_URL || `file:${DB_PATH}`;
const DB_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN || undefined;

const isLocal = DB_URL.startsWith('file:');
const dbDir = isLocal ? dirname(DB_URL.replace('file:', '')) : null;
if (dbDir && !existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

let rawClient = null;
let driverName = null;
let initialized = false;

/**
 * Wrap any driver into a unified async API
 */
function createWrapper(driver, raw) {
	if (driver === '@libsql/client') {
		return {
			prepare(sql) {
				return {
					async run(...args) {
						try {
							const r = await raw.execute({ sql, args });
							return {
								changes: r.rowsAffected,
								lastInsertRowid: r.lastInsertRowid ? Number(r.lastInsertRowid) : 0
							};
						} catch (e) {
							throw new Error(`DB run error: ${e.message}\nSQL: ${sql}`);
						}
					},
					async get(...args) {
						try {
							const r = await raw.execute({ sql, args });
							return r.rows.length > 0 ? { ...r.rows[0] } : undefined;
						} catch (e) {
							throw new Error(`DB get error: ${e.message}\nSQL: ${sql}`);
						}
					},
					async all(...args) {
						try {
							const r = await raw.execute({ sql, args });
							return r.rows.map((row) => ({ ...row }));
						} catch (e) {
							throw new Error(`DB all error: ${e.message}\nSQL: ${sql}`);
						}
					}
				};
			},
			async exec(sql) {
				try {
					await raw.executeMultiple(sql);
				} catch (e) {
					throw new Error(`DB exec error: ${e.message}`);
				}
			},
			transaction(fn) {
				return async () => {
					await raw.execute('BEGIN IMMEDIATE');
					try {
						await fn();
						await raw.execute('COMMIT');
					} catch (e) {
						await raw
							.execute('ROLLBACK')
							.catch((err) => console.error('[db] ROLLBACK failed:', err.message));
						throw e;
					}
				};
			},
			close() {
				raw.close();
			}
		};
	}

	// better-sqlite3: wrap sync API into async (returns Promises for compatibility)
	return {
		prepare(sql) {
			const stmt = raw.prepare(sql);
			return {
				async run(...args) {
					try {
						const r = stmt.run(...args);
						return { changes: r.changes, lastInsertRowid: Number(r.lastInsertRowid) };
					} catch (e) {
						throw new Error(`DB run error: ${e.message}\nSQL: ${sql}`);
					}
				},
				async get(...args) {
					try {
						const r = stmt.get(...args);
						return r !== undefined ? { ...r } : undefined;
					} catch (e) {
						throw new Error(`DB get error: ${e.message}\nSQL: ${sql}`);
					}
				},
				async all(...args) {
					try {
						return stmt.all(...args).map((r) => ({ ...r }));
					} catch (e) {
						throw new Error(`DB all error: ${e.message}\nSQL: ${sql}`);
					}
				}
			};
		},
		async exec(sql) {
			try {
				raw.exec(sql);
			} catch (e) {
				throw new Error(`DB exec error: ${e.message}`);
			}
		},
		transaction(fn) {
			const txn = raw.transaction(fn);
			return async () => txn();
		},
		close() {
			raw.close();
		}
	};
}

let dbWrapper = null;

export async function initDb() {
	if (dbWrapper && initialized) return dbWrapper;

	// ── Try @libsql/client first ──
	try {
		const { createClient } = await import('@libsql/client');
		rawClient = createClient({ url: DB_URL, authToken: DB_AUTH_TOKEN });
		if (isLocal) {
			await rawClient.execute('PRAGMA journal_mode = WAL');
			await rawClient.execute('PRAGMA synchronous = NORMAL');
			await rawClient.execute('PRAGMA foreign_keys = ON');
			await rawClient.execute('PRAGMA busy_timeout = 5000');
			await rawClient.execute('PRAGMA cache_size = -64000');
			await rawClient.execute('PRAGMA temp_store = MEMORY');

			// Ensure activity_logs table exists if database came from an older version
			await rawClient
				.execute(
					`CREATE TABLE IF NOT EXISTS activity_logs (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				action_type VARCHAR(50) NOT NULL,
				entity_type VARCHAR(50) NOT NULL,
				entity_id INTEGER NOT NULL,
				metadata TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)`
				)
				.catch(() => {});
			await rawClient
				.execute(
					`CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id, created_at DESC)`
				)
				.catch(() => {});
			await rawClient
				.execute(
					`CREATE UNIQUE INDEX IF NOT EXISTS unique_activity_idx ON activity_logs (user_id, action_type, entity_id, entity_type)`
				)
				.catch(() => {});

		} else {
			await rawClient.execute('PRAGMA foreign_keys = ON').catch(() => {});
		}
		driverName = '@libsql/client';
		dbWrapper = createWrapper(driverName, rawClient);
		initialized = true;
		console.log(
			`[db] @libsql/client ready | mode: ${isLocal ? 'local+WAL' : 'remote'} | ${DB_URL}`
		);
		return dbWrapper;
	} catch (e) {
		console.log(`[db] @libsql/client not available: ${e.message}`);
	}

	// ── Fallback to better-sqlite3 ──
	try {
		const Database = (await import('better-sqlite3')).default;
		const localPath = isLocal ? DB_URL.replace('file:', '') : DB_PATH;
		rawClient = new Database(localPath);
		rawClient.pragma('journal_mode = WAL');
		rawClient.pragma('synchronous = NORMAL');
		rawClient.pragma('foreign_keys = ON');
		rawClient.pragma('busy_timeout = 5000');
		rawClient.pragma('cache_size = -64000');
		rawClient.pragma('temp_store = MEMORY');
		driverName = 'better-sqlite3';
		dbWrapper = createWrapper(driverName, rawClient);
		initialized = true;
		console.log(`[db] better-sqlite3 ready | WAL | ${localPath}`);
		return dbWrapper;
	} catch (e) {
		console.log(`[db] better-sqlite3 not available: ${e.message}`);
	}

	throw new Error(
		'No database driver available.\n' +
			'Install one: npm install @libsql/client  OR  npm install better-sqlite3'
	);
}

export function getDb() {
	if (!dbWrapper)
		throw new Error('Database not initialized. Ensure initDb() was called in hooks.server.js');
	return dbWrapper;
}

export function closeDb() {
	if (dbWrapper) {
		try {
			dbWrapper.close();
		} catch {}
		rawClient = null;
		dbWrapper = null;
		initialized = false;
	}
}

export function getDriverInfo() {
	return {
		driver: driverName || 'none',
		mode: isLocal ? 'local+WAL' : 'remote',
		supportsWal: isLocal,
		url: DB_URL
	};
}

export async function runSchema() {
	const schemaPath = resolve(rootDir, 'schema_sqlite.sql');
	if (!existsSync(schemaPath)) throw new Error('schema_sqlite.sql not found at project root');
	const schema = readFileSync(schemaPath, 'utf-8');
	const db = getDb();
	await db.exec(schema);
}

export function getRootDir() {
	return rootDir;
}

export function getUploadsDir(subfolder = '') {
	const uploadsDir = resolve(rootDir, 'uploads', subfolder);
	if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
	return uploadsDir;
}

export default { initDb, getDb, closeDb, getDriverInfo, runSchema, getRootDir, getUploadsDir };
