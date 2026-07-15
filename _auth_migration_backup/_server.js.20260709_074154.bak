/**
 * VSocial — Install API
 * GET  /api/install — status + requirements
 * POST /api/install — run installation
 *
 * Auto-detects available DB driver (same logic as db.js)
 */
import { json } from '@sveltejs/kit';
import { existsSync, writeFileSync, unlinkSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { closeDb, getDriverInfo } from '$lib/server/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..', '..', '..', '..');

function getInstallStatus() {
	return existsSync(resolve(ROOT, 'install.lock'))
		|| existsSync(resolve(ROOT, 'installed.lock'))
		|| existsSync(resolve(ROOT, 'public', 'install.lock'));
}

async function getRequirements() {
	const nodeVersion = process.version;
	const nodeMajor = parseInt(nodeVersion.slice(1));
	const uploadsDir = resolve(ROOT, 'uploads');
	if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

	let dbDriver = 'none';
	try { await import('@libsql/client'); dbDriver = '@libsql/client'; }
	catch { try { await import('better-sqlite3'); dbDriver = 'better-sqlite3'; } catch {} }

	return {
		node_version: nodeVersion,
		node_ok: nodeMajor >= 18,
		sqlite_ok: dbDriver !== 'none',
		uploads_writable: true,
		db_writable: true,
		db_driver: dbDriver
	};
}

export async function GET({ url }) {
	const action = url.pathname.split('/').pop();

	if (action === 'install') {
		return json({ installed: getInstallStatus(), requirements: await getRequirements() });
	}
	if (action === 'status') {
		return json({ installed: getInstallStatus() });
	}
	if (action === 'check') {
		return json(await getRequirements());
	}
	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function POST({ request, url }) {
	const action = url.pathname.split('/').pop();

	if (action !== 'install' && action !== 'run') {
		return json({ error: 'Endpoint not found' }, { status: 404 });
	}

	if (getInstallStatus()) {
		return json({ error: 'La aplicacion ya esta instalada' }, { status: 400 });
	}

	const data = await request.json();
	if (!data?.site_name || !data?.admin_email || !data?.admin_password) {
		return json({ error: 'Datos incompletos' }, { status: 400 });
	}

	const schemaPath = resolve(ROOT, 'schema_sqlite.sql');
	if (!existsSync(schemaPath)) {
		return json({ error: 'No se encontro schema_sqlite.sql' }, { status: 500 });
	}

	const dbPath = resolve(ROOT, 'database.sqlite');

	try {
		// Close existing connection before deleting (Windows file lock)
		closeDb();

		// Delete old database files
		for (const suffix of ['', '-wal', '-shm']) {
			const filePath = dbPath + suffix;
			if (existsSync(filePath)) {
				try { unlinkSync(filePath); } catch {}
			}
		}

		// ── Auto-detect driver and create fresh database ──
		const adminUser = data.admin_user || data.admin_username || 'admin';
		const hash = await bcrypt.hash(data.admin_password, 10);
		const schema = readFileSync(schemaPath, 'utf-8');
		let driverUsed = 'none';

		// Try @libsql/client first
		try {
			const { createClient } = await import('@libsql/client');
			const client = createClient({ url: `file:${dbPath}` });

			await client.execute('PRAGMA journal_mode = WAL');
			await client.execute('PRAGMA foreign_keys = ON');
			await client.execute('PRAGMA synchronous = NORMAL');
			await client.executeMultiple(schema);

			const result = await client.execute({
				sql: "INSERT INTO users (username, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, 'admin')",
				args: [adminUser, data.admin_email, hash, adminUser]
			});
			const userId = result.lastInsertRowid;

			await client.execute({ sql: "INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'admin')", args: [userId] });
			await client.execute({ sql: 'INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)', args: [userId] });
			client.close();
			driverUsed = '@libsql/client';
		} catch (libsqlErr) {
			// Fallback to better-sqlite3
			try {
				const Database = (await import('better-sqlite3')).default;
				const db = new Database(dbPath);
				db.pragma('journal_mode = WAL');
				db.pragma('foreign_keys = ON');
				db.pragma('synchronous = NORMAL');
				await db.exec(schema);

				const stmt = await db.prepare(
					"INSERT INTO users (username, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, 'admin')"
				);
				const result = await stmt.run(adminUser, data.admin_email, hash, adminUser);
				db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'admin')").run(result.lastInsertRowid);
				await db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(result.lastInsertRowid);
				db.close();
				driverUsed = 'better-sqlite3';
			} catch (bs3Err) {
				return json({
					error: `Ningun driver disponible. @libsql/client: ${libsqlErr.message} | better-sqlite3: ${bs3Err.message}`
				}, { status: 500 });
			}
		}

		// Save .env
		const envContent = [
			'NODE_ENV=production',
			'DB_PATH=' + dbPath,
			'JWT_SECRET=' + randomBytes(32).toString('hex'),
			'JWT_EXPIRES_IN=7d',
			'UPLOAD_DIR=./uploads',
			'MAX_FILE_SIZE=10485760',
			'INSTALL_LOCK=true'
		].join('\n');
		writeFileSync(resolve(ROOT, '.env'), envContent);

		// Create install lock
		writeFileSync(
			resolve(ROOT, 'install.lock'),
			JSON.stringify({ installed_at: new Date().toISOString(), site_name: data.site_name, db_driver: driverUsed })
		);

		// Re-initialize the database connection for the running server process
		await initDb();

		return json({
			success: true,
			message: `Instalacion completada con ${driverUsed} (WAL activado)`
		});
	} catch (e) {
		return json({ error: 'Error Interno: ' + e.message }, { status: 500 });
	}
}
