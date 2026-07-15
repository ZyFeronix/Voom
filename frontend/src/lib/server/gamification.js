import { getDb } from './db.js';

// ============================================================================
// Gamification Engine - V-SOCIAL
// Core logic for XP, Levels, and Streaks
// ============================================================================

const XP_PER_LEVEL_FACTOR = 100;
const MAX_LEVEL = 20;

/**
 * Calculates the level based on XP using an exponential curve.
 * Level = floor(sqrt(XP / 100)) + 1
 * Level 1: 0 XP
 * Level 2: 100 XP
 * Level 3: 400 XP
 * Level 4: 900 XP
 * Level 10: 8100 XP
 * Level 20: 36100 XP
 */
export function calculateLevel(xp) {
    if (xp <= 0) return 1;
    const calcLevel = Math.floor(Math.sqrt(xp / XP_PER_LEVEL_FACTOR)) + 1;
    return Math.min(calcLevel, MAX_LEVEL);
}

/**
 * Calculates the XP required to reach a specific level.
 */
export function getXpForLevel(level) {
    if (level <= 1) return 0;
    return Math.pow(level - 1, 2) * XP_PER_LEVEL_FACTOR;
}

/**
 * Awards XP to a user and updates their level if they leveled up.
 * Transactions should be handled by the caller or inside this function.
 * @param {Object} db - Database wrapper instance
 * @param {Number} userId - The ID of the user
 * @param {Number} amount - XP to add (can be negative to deduct)
 * @returns {Promise<{ leveledUp: boolean, newLevel: number, newXp: number }>}
 */
export async function awardXP(db, userId, amount) {
    if (amount === 0) return { leveledUp: false, newLevel: 1, newXp: 0 };

    const user = await db.prepare('SELECT xp_points, level FROM users WHERE id = ?').get(userId);
    if (!user) throw new Error('User not found');

    const currentXp = user.xp_points || 0;
    const currentLevel = user.level || 1;
    
    const newXp = Math.max(0, currentXp + amount);
    const newLevel = calculateLevel(newXp);
    
    const leveledUp = newLevel > currentLevel;

    await db.prepare('UPDATE users SET xp_points = ?, level = ? WHERE id = ?').run(newXp, newLevel, userId);

    return { leveledUp, newLevel, newXp };
}

/**
 * Processes a daily check-in.
 * Validates if the user can check in today, updates the streak, and awards XP.
 * @param {Object} db - Database wrapper instance
 * @param {Number} userId - The ID of the user
 * @returns {Promise<{ success: boolean, message: string, newStreak: number, xpAwarded: number, nextCheckinAt: Date }>}
 */
export async function processCheckin(db, userId) {
    const user = await db.prepare('SELECT checkin_streak, last_checkin_at FROM users WHERE id = ?').get(userId);
    if (!user) throw new Error('User not found');

    const now = new Date();
    const lastCheckin = user.last_checkin_at ? new Date(user.last_checkin_at + 'Z') : null;
    
    let newStreak = 1;
    let xpAwarded = 10; // Base XP for check-in

    if (lastCheckin) {
        // Calculate the difference in hours
        const diffMs = now.getTime() - lastCheckin.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 20) {
            // Already checked in within the last 20 hours (prevent spamming)
            const nextTime = new Date(lastCheckin.getTime() + (20 * 60 * 60 * 1000));
            return { 
                success: false, 
                message: 'Ya has hecho check-in. Vuelve más tarde.', 
                newStreak: user.checkin_streak, 
                xpAwarded: 0,
                nextCheckinAt: nextTime
            };
        } else if (diffHours > 48) {
            // Streak broken (more than 48 hours passed)
            newStreak = 1;
        } else {
            // Valid consecutive check-in
            newStreak = (user.checkin_streak || 0) + 1;
        }
    }

    // Add bonus XP based on streak (e.g., +2 XP per day of streak, max +50 XP bonus)
    const streakBonus = Math.min((newStreak - 1) * 2, 50);
    xpAwarded += streakBonus;

    // Apply the XP and update check-in stats
    // We use SQLite's datetime('now') to store UTC
    await db.prepare(`
        UPDATE users 
        SET checkin_streak = ?, 
            last_checkin_at = datetime('now')
        WHERE id = ?
    `).run(newStreak, userId);

    const xpResult = await awardXP(db, userId, xpAwarded);

    return { 
        success: true, 
        message: 'Check-in exitoso', 
        newStreak, 
        xpAwarded, 
        leveledUp: xpResult.leveledUp,
        newLevel: xpResult.newLevel,
        newXp: xpResult.newXp,
        nextCheckinAt: new Date(now.getTime() + (20 * 60 * 60 * 1000))
    };
}

/**
 * Awards XP but enforces a daily limit for a specific source.
 * Automatically creates the daily_xp_limits table if missing (dynamic schema for shared hosting).
 * @param {Object} db - Database wrapper instance
 * @param {Number} userId - The ID of the user
 * @param {Number} amount - XP to add
 * @param {String} sourceKey - The source identifier (e.g., 'time_online')
 * @param {Number} dailyLimit - Maximum XP allowed per day for this source
 * @returns {Promise<{ awarded: boolean, amountAwarded: number, leveledUp: boolean }>}
 */
export async function awardDailyCappedXP(db, userId, amount, sourceKey, dailyLimit) {
    if (amount <= 0) return { awarded: false, amountAwarded: 0, leveledUp: false };
    
    // Dynamic schema validation
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS daily_xp_limits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            date_key VARCHAR(10) NOT NULL,
            source_key VARCHAR(50) NOT NULL,
            xp_amount INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, date_key, source_key)
        )
    `).run().catch(() => {});

    // Get current UTC date in YYYY-MM-DD format
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];

    const currentRecord = await db.prepare(
        'SELECT xp_amount FROM daily_xp_limits WHERE user_id = ? AND date_key = ? AND source_key = ?'
    ).get(userId, dateKey, sourceKey);

    const currentXp = currentRecord ? currentRecord.xp_amount : 0;
    
    if (currentXp >= dailyLimit) {
        return { awarded: false, amountAwarded: 0, leveledUp: false };
    }

    const availableToAward = Math.min(amount, dailyLimit - currentXp);
    
    if (availableToAward <= 0) return { awarded: false, amountAwarded: 0, leveledUp: false };

    // Upsert record
    await db.prepare(`
        INSERT INTO daily_xp_limits (user_id, date_key, source_key, xp_amount)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, date_key, source_key) 
        DO UPDATE SET xp_amount = xp_amount + excluded.xp_amount, updated_at = datetime('now')
    `).run(userId, dateKey, sourceKey, availableToAward);

    const result = await awardXP(db, userId, availableToAward);
    
    return { 
        awarded: true, 
        amountAwarded: availableToAward, 
        leveledUp: result.leveledUp 
    };
}
