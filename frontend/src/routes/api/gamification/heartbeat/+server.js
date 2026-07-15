import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { awardDailyCappedXP } from '$lib/server/gamification.js';

/**
 * Endpoint para recompensar el tiempo en línea.
 * Se espera que el cliente lo llame cada 2 minutos.
 */
export async function POST({ request }) {
    const userId = await requireAuth(request);
    const db = getDb();
    
    // Otorga 1 XP por cada latido (ping), con un máximo de 100 XP diarios por tiempo en línea.
    try {
        const result = await awardDailyCappedXP(db, userId, 1, 'time_online', 100);
        return json({ 
            success: true, 
            awarded: result.awarded, 
            amount: result.amountAwarded,
            leveledUp: result.leveledUp
        });
    } catch (e) {
        console.error('[Heartbeat XP Error]', e);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
