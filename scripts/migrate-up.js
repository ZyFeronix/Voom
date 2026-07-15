/**
 * VSocial Migration Runner
 * Usage: node scripts/migrate-up.js
 */
import { resolve } from 'path';
import fs from 'fs';
import { initDb, getDb, getRootDir } from '../frontend/src/lib/server/db.js';

async function run() {
    await initDb();
    const db = getDb();

    const createMigrationsTable = `
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;
    db.exec(createMigrationsTable);

    const migrationsDir = resolve(getRootDir(), 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
        console.log('[migrations] No migrations directory found. Skipping.');
        process.exit(0);
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of files) {
        const alreadyApplied = db.prepare('SELECT id FROM _migrations WHERE name = ?').get(file);
        if (alreadyApplied) {
            console.log(`[migrations] Skipping ${file} (already applied)`);
            continue;
        }

        const filePath = resolve(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        try {
            db.exec(sql);
            db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
            console.log(`[migrations] Applied: ${file}`);
        } catch (err) {
            console.error(`[migrations] Failed on ${file}: ${err.message}`);
            process.exit(1);
        }
    }

    console.log('[migrations] Up to date.');
}

run();
