import { getDb } from '$lib/server/db.js';
import { existsSync } from 'fs';
import { resolve } from 'path';

function getIsInstalled() {
	return (
		existsSync(resolve(process.cwd(), '..', 'install.lock')) ||
		existsSync(resolve(process.cwd(), 'install.lock')) ||
		existsSync(resolve(process.cwd(), '..', 'installed.lock')) ||
		existsSync(resolve(process.cwd(), 'installed.lock'))
	);
}

export async function load({ _locals }) {
	let settings = {};

	try {
		const db = getDb();
		const rows = await db
			.prepare(
				"SELECT key, value FROM system_settings WHERE key IN ('platform_mode', 'reels_enabled', 'stories_enabled', 'groups_enabled', 'marketplace_enabled', 'gamification_enabled')"
			)
			.all();
		for (const r of rows) {
			try {
				settings[r.key] = JSON.parse(r.value);
			} catch {
				settings[r.key] = r.value;
			}
		}
	} catch (e) {
		console.error('Error loading system settings in layout:', e);
	}

	return {
		isInstalled: getIsInstalled(),
		globalSettings: settings
	};
}
