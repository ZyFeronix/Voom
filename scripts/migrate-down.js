/**
 * VSocial Migration Downgrade Runner
 * Usage: node scripts/migrate-down.js [number_of_migrations]
 */
import { resolve } from 'path';
import fs from 'fs';
import { initDb, getDb, getRootDir } from '../frontend/src/lib/server/db.js';

const count = parseInt(process.argv[2] || '1', 10);

async function run() {
    await initDb();
    const db = getDb();
    
    const migrations = db.prepare(
        'SELECT name FROM _migrations ORDER BY id DESC LIMIT ?'
    ).all(count);

    for (const { name } of migrations) {
        const downFile = resolve(getRootDir(), 'migrations', name.replace('.sql', '.down.sql'));
        
        if (!fs.existsSync(downFile)) {
            console.warn(`[migrations] No down file for ${name}, skipping.`);
            continue;
        }

        const sql = fs.readFileSync(downFile, 'utf8');
        
        try {
            db.exec(sql);
            db.prepare('DELETE FROM _migrations WHERE name = ?').run(name);
            console.log(`[migrations] Reverted: ${name}`);
        } catch (err) {
            console.error(`[migrations] Failed reverting ${name}: ${err.message}`);
            process.exit(1);
        }
    }

    console.log('[migrations] Downgrade complete.');
}

run();
