/**
 * VSocial — Setup Wizard API
 * GET  /api/setup — Check if setup needed
 * POST /api/setup — Create Super Admin + base config
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import bcrypt from 'bcryptjs';

export async function GET() {
	const db = getDb();
	const count = await db.prepare('SELECT COUNT(*) as cnt FROM users').get();
	return json({ needsSetup: count.cnt === 0 });
}

export async function POST({ request }) {
	const db = getDb();
	const count = await db.prepare('SELECT COUNT(*) as cnt FROM users').get();
	if (count.cnt > 0) {
		return json({ error: 'La plataforma ya tiene usuarios' }, { status: 400 });
	}

	const data = await request.json();
	const siteName = (data.site_name || '').trim();
	const adminUser = (data.admin_username || '').trim();
	const adminEmail = (data.admin_email || '').trim();
	const adminPass = data.admin_password || '';

	if (!siteName || siteName.length < 2) return json({ error: 'Nombre del sitio requerido' }, { status: 400 });
	if (!adminUser || !/^[a-zA-Z0-9_]{3,32}$/.test(adminUser)) return json({ error: 'Usuario invalido' }, { status: 400 });
	if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) return json({ error: 'Email invalido' }, { status: 400 });
	if (adminPass.length < 8) return json({ error: 'Contraseña minimo 8 caracteres' }, { status: 400 });

	try {
		const hash = await bcrypt.hash(adminPass, 12);

		const result = await db.prepare(
			"INSERT INTO users (username, email, password_hash, display_name, role, is_verified, email_verified) VALUES (?, ?, ?, ?, 'super_admin', 1, 1)"
		).run(adminUser, adminEmail, hash, adminUser);
		const userId = result.lastInsertRowid;

		await db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'super_admin')").run(userId);
		await db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'admin')").run(userId);
		await db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(userId);
		await db.prepare('INSERT OR IGNORE INTO wallets (user_id, balance) VALUES (?, 1000)').run(userId);

		const upsert = await db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
		await upsert.run('site_name', siteName);
		await upsert.run('setup_completed', '1');
		await upsert.run('setup_completed_at', new Date().toISOString());
		if (data.allow_registration !== undefined) {
			await upsert.run('allow_registration', data.allow_registration ? '1' : '0');
		}
		if (data.theme) await upsert.run('default_theme', data.theme);
		if (data.language) await upsert.run('default_language', data.language);

		const catCount = await db.prepare('SELECT COUNT(*) as cnt FROM marketplace_categories').get();
		if (catCount.cnt === 0) {
			const insertCat = db.prepare('INSERT INTO marketplace_categories (name, icon, slug) VALUES (?, ?, ?)');
			await insertCat.run('Arte Digital', 'palette', 'arte-digital');
			await insertCat.run('Servicios Creativos', 'brush', 'servicios');
			await insertCat.run('Electrónica', 'devices', 'electronica');
			await insertCat.run('Moda Virtual', 'checkroom', 'moda');
			await insertCat.run('Cursos & Tutoriales', 'school', 'educacion');
		}

		return json({ success: true, message: 'Setup completado.' });
	} catch (e) {
		return json({ error: 'Error: ' + e.message }, { status: 500 });
	}
}
