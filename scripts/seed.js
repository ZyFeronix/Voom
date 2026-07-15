/**
 * VSocial Database Seeder
 * Usage: node scripts/seed.js
 */
import { initDb, getDb } from '../frontend/src/lib/server/db.js';

async function run() {
    await initDb();
    const db = getDb();

    console.log('[seed] Seeding database...');

    // Seed system settings
    const settings = [
        ['site_name', 'VSocial'],
        ['allow_registration', '1'],
        ['max_upload_size_mb', '50'],
        ['reels_enabled', '1'],
        ['marketplace_enabled', '1'],
        ['maintenance_mode', '0'],
        ['groups_enabled', '1'],
        ['stories_enabled', '1'],
        ['demo_mode', '0'],
        ['email_verification_required', '0']
    ];

    for (const [key, value] of settings) {
        try {
            db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING').run(key, value);
        } catch (e) {
            // ignore
        }
    }

    // Seed marketplace categories
    const categories = [
        ['Arte Digital', 'palette', 'arte-digital'],
        ['Servicios Creativos', 'brush', 'servicios'],
        ['Electrnica', 'devices', 'electronica'],
        ['Moda Virtual', 'checkroom', 'moda'],
        ['Cursos & Tutoriales', 'school', 'educacion'],
        ['Msica & Audio', 'audiotrack', 'musica'],
        ['Fotografa & Video', 'videocam', 'multimedia']
    ];

    for (const [name, icon, slug] of categories) {
        try {
            db.prepare('INSERT INTO marketplace_categories (name, icon, slug) VALUES (?, ?, ?) ON CONFLICT(slug) DO NOTHING').run(name, icon, slug);
        } catch (e) {
            // ignore
        }
    }

    console.log('[seed] Done.');
}

run().catch(err => {
    console.error('[seed] Error:', err.message);
    process.exit(1);
});
