/**
 * Voom! Migration Runner
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
    await db.exec(createMigrationsTable);

    const migrationsDir = resolve(getRootDir(), 'migrations');

    if (!fs.existsSync(migrationsDir)) {
        console.log('[migrations] No migrations directory found. Skipping.');
        process.exit(0);
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'))
        .sort();

    // Baseline: BD creada con schema_sqlite.sql (instalador/zip) no tiene la
    // tabla _migrations, pero YA contiene el schema completo. Si existen tablas
    // de usuario y no hay registro, marcar todas las migraciones como aplicadas
    // para no re-aplicar 001 (dialecto Postgres) sobre SQLite.
    const userTables = await db
        .prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_migrations'")
        .get();
    const existing = await db.prepare('SELECT COUNT(*) AS c FROM _migrations').get();

    if ((userTables?.c ?? 0) > 0 && (existing?.c ?? 0) === 0) {
        console.log('[migrations] Base de datos preexistente sin registro: stamping baseline.');
        for (const file of files) {
            await db.prepare('INSERT OR IGNORE INTO _migrations (name) VALUES (?)').run(file);
        }
        console.log('[migrations] Baseline completado:', files.length, 'migraciones marcadas.');
        console.log('[migrations] Up to date.');
        return;
    }

    for (const file of files) {
        const alreadyApplied = await db.prepare('SELECT id FROM _migrations WHERE name = ?').get(file);
        if (alreadyApplied) {
            console.log(`[migrations] Skipping ${file} (already applied)`);
            continue;
        }

        const filePath = resolve(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        try {
            await db.exec(sql);
            await db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
            console.log(`[migrations] Applied: ${file}`);
        } catch (err) {
            console.error(`[migrations] Failed on ${file}: ${err.message}`);
            process.exit(1);
        }
    }

    console.log('[migrations] Up to date.');
}

run();
