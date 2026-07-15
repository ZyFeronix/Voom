import { getDb } from './db.js';

let initialized = false;

/**
 * Ensures the system_cache table exists. Runs once per process.
 */
async function ensureCacheTable() {
    if (initialized) return;
    const db = getDb();
    await db.exec(`
        CREATE TABLE IF NOT EXISTS system_cache (
            key VARCHAR(100) PRIMARY KEY,
            value TEXT NOT NULL,
            expires_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_system_cache_expires ON system_cache(expires_at);
    `);
    
    // Opportunistic cleanup on boot
    const now = Date.now();
    try {
        const stmt = db.prepare('DELETE FROM system_cache WHERE expires_at < ?');
        await stmt.run(now);
    } catch (e) {
        console.error('[cache] Error in cleanup:', e);
    }
    
    initialized = true;
}

/**
 * Gets a value from the persistent cache.
 * Returns null if it doesn't exist or has expired.
 * @param {string} key 
 * @returns {Promise<any>}
 */
export async function getCache(key) {
    await ensureCacheTable();
    const db = getDb();
    
    const now = Date.now();
    const stmt = db.prepare('SELECT value, expires_at FROM system_cache WHERE key = ?');
    const result = await stmt.get(key);
    
    if (!result) return null;
    
    if (now > result.expires_at) {
        // Expired, delete it and return null
        const delStmt = db.prepare('DELETE FROM system_cache WHERE key = ?');
        await delStmt.run(key);
        return null;
    }
    
    try {
        return JSON.parse(result.value);
    } catch (e) {
        return result.value;
    }
}

/**
 * Sets a value in the persistent cache.
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlMs Time to live in milliseconds (default: 60s)
 */
export async function setCache(key, value, ttlMs = 60000) {
    await ensureCacheTable();
    const db = getDb();
    
    const expiresAt = Date.now() + ttlMs;
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    const stmt = db.prepare(`
        INSERT INTO system_cache (key, value, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            expires_at = excluded.expires_at
    `);
    
    await stmt.run(key, stringValue, expiresAt);
}

/**
 * Invalidate a specific cache key early.
 * @param {string} key 
 */
export async function invalidateCache(key) {
    await ensureCacheTable();
    const db = getDb();
    const stmt = db.prepare('DELETE FROM system_cache WHERE key = ?');
    await stmt.run(key);
}
