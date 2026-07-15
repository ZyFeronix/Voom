/**
 * VSocial — Market API (offers + commission)
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { _atomicTransfer as atomicTransfer } from '../../wallet/[...path]/+server.js';

export async function GET({ request, params }) {
	const parts = params.path || [];
	const action = parts[0] || '';
	const db = getDb();

	if (action === 'listings') {
		const rows = await db.prepare(
			`SELECT m.*, u.username, u.display_name, u.avatar_url
			 FROM listings m JOIN users u ON m.user_id = u.id
			 WHERE m.status = 'active' ORDER BY m.created_at DESC`
		).all();
		return json({ success: true, data: rows });
	}

	if (action === 'jobs') {
		const rows = await db.prepare(
			`SELECT j.*, u.username, u.display_name, u.avatar_url
			 FROM jobs j JOIN users u ON j.user_id = u.id
			 WHERE j.status = 'open' ORDER BY j.created_at DESC`
		).all();
		return json({ success: true, data: rows });
	}

	if (action === 'offers') {
		const userId = await requireAuth(request);
		const rows = await db.prepare(
			`SELECT o.*,
				b.username as buyer_username, b.display_name as buyer_name,
				s.username as seller_username, s.display_name as seller_name,
				l.title as listing_title, j.title as job_title
			 FROM listing_offers o
			 LEFT JOIN users b ON o.buyer_id = b.id
			 LEFT JOIN users s ON o.seller_id = s.id
			 LEFT JOIN listings l ON o.listing_id = l.id
			 LEFT JOIN jobs j ON o.job_id = j.id
			 WHERE o.buyer_id = ? OR o.seller_id = ?
			 ORDER BY o.created_at DESC`
		).all(userId, userId);
		return json({ success: true, data: rows });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function POST({ request, params }) {
	const parts = params.path || [];
	const action = parts[0] || '';
	const subaction = parts[1] || '';
	const offerId = parts[2] || '';
	const userId = await requireAuth(request);
	const db = getDb();

	if (action === 'offers' && !subaction) {
		const body = await request.json();
		const listingId = body.listing_id || null;
		const jobId = body.job_id || null;
		const amount = parseFloat(body.amount) || 0;
		const message = (body.message || '').replace(/<[^>]*>/g, '').trim();

		if (!listingId && !jobId) return json({ error: 'Must specify listing_id or job_id' }, { status: 400 });
		if (amount <= 0) return json({ error: 'Amount must be greater than zero' }, { status: 400 });

		let sellerId;
		if (listingId) {
			sellerId = await db.prepare('SELECT user_id FROM listings WHERE id = ?').get(listingId)?.user_id;
		} else {
			sellerId = await db.prepare('SELECT user_id FROM jobs WHERE id = ?').get(jobId)?.user_id;
		}
		if (!sellerId) return json({ error: 'Item not found' }, { status: 404 });
		if (sellerId === userId) return json({ error: 'Cannot make an offer on your own item' }, { status: 400 });

		const wallet = await db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId);
		if (!wallet || wallet.balance < amount) return json({ error: 'Insufficient funds' }, { status: 400 });

		const result = await db.prepare(
			"INSERT INTO listing_offers (listing_id, job_id, buyer_id, seller_id, amount, message, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')"
		).run(listingId, jobId, userId, sellerId, amount, message);

		return json({ success: true, message: 'Offer submitted', offer_id: Number(result.lastInsertRowid) });
	}

	if (action === 'offers' && subaction === 'accept') {
		if (!offerId) return json({ error: 'Missing offer ID' }, { status: 400 });
		const o = await db.prepare('SELECT * FROM listing_offers WHERE id = ?').get(offerId);
		if (!o) return json({ error: 'Offer not found' }, { status: 404 });
		if (o.status !== 'pending') return json({ error: 'Offer is not pending' }, { status: 400 });
		if (o.seller_id !== userId) return json({ error: 'Unauthorized' }, { status: 403 });

		const amount = parseFloat(o.amount);
		const commission = amount * 0.05;
		const netToSeller = amount - commission;
		const refId = 'offer_' + o.id;

		try {
			await atomicTransfer(db, o.buyer_id, o.seller_id, netToSeller, 'market_offer', 'Payment for offer #' + o.id, refId);

			const txn = db.transaction(async () => {
				const res = await db.prepare("UPDATE wallets SET balance = balance - ?, updated_at = datetime('now') WHERE user_id = ? AND balance >= ?")
					.run(commission, o.buyer_id, commission);
				if (res.changes > 0) {
					const w = await db.prepare('SELECT id FROM wallets WHERE user_id = ?').get(o.buyer_id);
					await db.prepare("INSERT INTO transactions (user_id, wallet_id, type, amount, description, reference_id) VALUES (?, ?, 'fee', ?, 'Platform Commission', ?)")
						.run(o.buyer_id, w?.id, -commission, refId);
				}
			});
			await txn();

			await db.prepare("UPDATE listing_offers SET status = 'accepted' WHERE id = ?").run(offerId);
			if (o.listing_id) await db.prepare("UPDATE listings SET status = 'sold' WHERE id = ?").run(o.listing_id);
			if (o.job_id) await db.prepare("UPDATE jobs SET status = 'closed' WHERE id = ?").run(o.job_id);

			return json({ success: true, message: 'Offer accepted and payment secured' });
		} catch (e) {
			return json({ error: 'Payment failed: ' + e.message }, { status: 400 });
		}
	}

	if (action === 'offers' && subaction === 'reject') {
		if (!offerId) return json({ error: 'Missing offer ID' }, { status: 400 });
		await db.prepare("UPDATE listing_offers SET status = 'rejected' WHERE id = ? AND seller_id = ?").run(offerId, userId);
		return json({ success: true, message: 'Offer rejected' });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}
