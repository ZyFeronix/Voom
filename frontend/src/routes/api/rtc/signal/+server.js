import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';
import { getSocketIO } from '$lib/server/socket.js';

/** Lazy-init the rtc_signals table once per process */
let tableReady = false;
async function ensureTable(db) {
	if (tableReady) return;
	await db.exec(`
		CREATE TABLE IF NOT EXISTS rtc_signals (
			id             INTEGER PRIMARY KEY AUTOINCREMENT,
			sender_id      INTEGER NOT NULL,
			recipient_id   INTEGER NOT NULL,
			conversation_id INTEGER NOT NULL,
			payload        TEXT    NOT NULL,
			created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_rtc_signals_recipient ON rtc_signals(recipient_id, id);
	`);
	tableReady = true;
}

export async function POST({ request }) {
	const userId = await requireAuth(request);
	const db = getDb();

	try {
		const body = await request.json();
		const { recipient_id, conversation_id, payload } = body;

		if (!recipient_id || !conversation_id || !payload) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		await ensureTable(db);

		// If it's a hangup, clean ALL signals for this conversation immediately
		// so the peer doesn't process stale ICE/offer after the call ended.
		if (payload.type === 'hangup') {
			await db.prepare(`DELETE FROM rtc_signals WHERE conversation_id = ?`).run(conversation_id);
		} else {
			// Remove stale signals for this conversation (older than 90 seconds)
			await db
				.prepare(
					`DELETE FROM rtc_signals WHERE conversation_id = ? AND created_at < datetime('now', '-90 seconds')`
				)
				.run(conversation_id);
		}

		// Insert the new signal
		const res = await db
			.prepare(
				`INSERT INTO rtc_signals (sender_id, recipient_id, conversation_id, payload)
			 VALUES (?, ?, ?, ?)`
			)
			.run(userId, recipient_id, conversation_id, JSON.stringify(payload));

		const io = getSocketIO();
		if (io) {
			const signalObj = await db
				.prepare('SELECT * FROM rtc_signals WHERE id = ?')
				.get(res.lastInsertRowid);
			if (signalObj) {
				io.to(`user_${recipient_id}`).emit('rtc_signal', { signals: [signalObj] });
			}
		}

		// Periodic global cleanup every 30 requests
		const c = (globalThis._rtcCleanCount = (globalThis._rtcCleanCount || 0) + 1);
		if (c % 30 === 0) {
			db.prepare(`DELETE FROM rtc_signals WHERE created_at < datetime('now', '-5 minutes')`).run();
		}

		return json({ success: true });
	} catch (e) {
		console.error('[RTC Signal] Error:', e);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
