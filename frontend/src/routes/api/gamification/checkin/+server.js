import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { processCheckin } from '$lib/server/gamification.js';

export async function POST({ locals }) {
	if (!locals.user) {
		return json({ success: false, message: 'Unauthorized' }, { status: 401 });
	}

	try {
		const db = getDb();
		const result = await processCheckin(db, locals.user.id);

		return json(result);
	} catch (error) {
		console.error('[API Gamification Checkin]', error);
		return json({ success: false, message: 'Error procesando check-in' }, { status: 500 });
	}
}

export async function GET({ locals }) {
	if (!locals.user) {
		return json({ canCheckin: false }, { status: 401 });
	}

	try {
		const db = getDb();
		const user = await db
			.prepare('SELECT checkin_streak, last_checkin_at FROM users WHERE id = ?')
			.get(locals.user.id);

		let canCheckin = true;
		let nextCheckin = null;
		let streak = user?.checkin_streak || 0;

		if (user && user.last_checkin_at) {
			const lastCheckin = new Date(user.last_checkin_at + 'Z');
			const now = new Date();
			const diffHours = (now.getTime() - lastCheckin.getTime()) / (1000 * 60 * 60);

			if (diffHours < 20) {
				canCheckin = false;
				nextCheckin = new Date(lastCheckin.getTime() + 20 * 60 * 60 * 1000);
			} else if (diffHours > 48) {
				streak = 0; // Se perdió la racha
			}
		}

		return json({
			canCheckin,
			streak,
			nextCheckin
		});
	} catch (error) {
		console.error('[API Gamification Status]', error);
		return json({ canCheckin: false }, { status: 500 });
	}
}
