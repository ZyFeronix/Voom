/**
 * VSocial — Marketplace API
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

async function fetchListingMedia(db, listIds) {
	if (!listIds.length) return {};
	const ph = listIds.map(() => '?').join(',');
	const rows = await db
		.prepare(`SELECT listing_id, media_url FROM listing_media WHERE listing_id IN (${ph})`)
		.all(...listIds);
	const map = {};
	for (const m of rows) {
		if (!map[m.listing_id]) map[m.listing_id] = [];
		map[m.listing_id].push(m.media_url);
	}
	return map;
}

async function fetchRatings(db, listIds) {
	if (!listIds.length) return {};
	const ph = listIds.map(() => '?').join(',');
	const rows = await db
		.prepare(
			`SELECT listing_id, AVG(rating) as avg, COUNT(*) as count FROM marketplace_reviews WHERE listing_id IN (${ph}) GROUP BY listing_id`
		)
		.all(...listIds);
	const map = {};
	for (const r of rows) {
		map[r.listing_id] = { avg: Number(r.avg).toFixed(1), count: r.count };
	}
	return map;
}

const LISTING_SELECT = `
	SELECT m.*, u.username, u.display_name, u.avatar_url, u.payment_link, c.name as category_name
	FROM marketplace_listings m JOIN users u ON m.user_id = u.id
	LEFT JOIN marketplace_categories c ON m.category_id = c.id
`;

export async function GET({ _request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const db = getDb();

	if (action === 'categories') {
		return json({
			categories: await db.prepare('SELECT * FROM marketplace_categories ORDER BY id ASC').all()
		});
	}

	if (action === 'search') {
		const q = `%${url.searchParams.get('q') || ''}%`;
		const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
		const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 20));
		const offset = (page - 1) * limit;

		const listings = await db
			.prepare(
				`${LISTING_SELECT}
			WHERE m.status = 'active' AND (m.title LIKE ? OR m.description LIKE ?)
			ORDER BY m.created_at DESC LIMIT ? OFFSET ?
		`
			)
			.all(q, q, limit, offset);

		const mediaMap = await fetchListingMedia(
			db,
			listings.map((l) => l.id)
		);
		const ratingMap = await fetchRatings(
			db,
			listings.map((l) => l.id)
		);
		listings.forEach((item) => {
			item.media = mediaMap[item.id] || [];
			item.image_url = item.media[0] || null;
			item.ratings_avg = Number(ratingMap[item.id]?.avg || 0);
			item.ratings_count = ratingMap[item.id]?.count || 0;
		});
		return json({ data: listings, page, limit, has_more: listings.length === limit });
	}

	// Reviews of a listing: GET /api/marketplace/:id/reviews
	if (action && /^\d+$/.test(action) && parts[1] === 'reviews') {
		const listingId = parseInt(action);
		const reviews = await db
			.prepare(
				`SELECT r.*, u.username, u.display_name, u.avatar_url
			 FROM marketplace_reviews r JOIN users u ON r.user_id = u.id
			 WHERE r.listing_id = ? ORDER BY r.created_at DESC LIMIT 50`
			)
			.all(listingId);
		return json({ reviews });
	}

	if (action && /^\d+$/.test(action)) {
		const listing = await db.prepare(`${LISTING_SELECT} WHERE m.id = ?`).get(parseInt(action));
		if (!listing) return json({ error: 'Listing not found' }, { status: 404 });
		const mediaRows = await db
			.prepare('SELECT media_url FROM listing_media WHERE listing_id = ? ORDER BY position ASC')
			.all(parseInt(action));
		listing.media = mediaRows.map((r) => r.media_url);
		listing.image_url = listing.media[0] || null;
		const rating = await db
			.prepare(
				'SELECT AVG(rating) as avg, COUNT(*) as count FROM marketplace_reviews WHERE listing_id = ?'
			)
			.get(parseInt(action));
		listing.ratings_avg = Number(rating?.avg || 0);
		listing.ratings_count = rating?.count || 0;
		return json({ listing });
	}

	// Catalog
	const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
	const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 20));
	const offset = (page - 1) * limit;
	const listings = await db
		.prepare(
			`${LISTING_SELECT} WHERE m.status = 'active' ORDER BY m.created_at DESC LIMIT ? OFFSET ?`
		)
		.all(limit, offset);
	const mediaMap = await fetchListingMedia(
		db,
		listings.map((l) => l.id)
	);
	const ratingMap = await fetchRatings(
		db,
		listings.map((l) => l.id)
	);
	listings.forEach((item) => {
		item.media = mediaMap[item.id] || [];
		item.image_url = item.media[0] || null;
		item.ratings_avg = Number(ratingMap[item.id]?.avg || 0);
		item.ratings_count = ratingMap[item.id]?.count || 0;
	});
	return json({ data: listings, page, limit, has_more: listings.length === limit });
}

export async function POST({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const userId = await requireAuth(request);
	const body = await request.json();
	const db = getDb();

	if (!action) {
		const title = (body.title || '').trim();
		const description = (body.description || '').trim();
		const price = parseFloat(body.price) || 0;
		const categoryId = parseInt(body.category_id) || 1;
		const condition = (body.condition || 'new').trim();
		if (!title || !price) return json({ error: 'Title and price are required' }, { status: 400 });

		const result = await db
			.prepare(
				"INSERT INTO marketplace_listings (user_id, category_id, title, description, price, condition, status) VALUES (?, ?, ?, ?, ?, ?, 'active')"
			)
			.run(userId, categoryId, title, description, price, condition);
		const listingId = Number(result.lastInsertRowid);

		// Accept both `media_urls` (array) and `image_url` (string) contracts
		const mediaUrls = Array.isArray(body.media_urls)
			? body.media_urls
			: body.image_url
				? [body.image_url]
				: [];
		for (let i = 0; i < mediaUrls.length; i++) {
			if (!mediaUrls[i]) continue;
			await db
				.prepare('INSERT INTO listing_media (listing_id, media_url, position) VALUES (?, ?, ?)')
				.run(listingId, mediaUrls[i], i);
		}
		return json({ success: true, listing_id: listingId }, { status: 201 });
	}

	if (action && /^\d+$/.test(action) && parts[1] === 'offers') {
		// Client sends { amount, message }; accept legacy { price } too
		const offerPrice = parseFloat(body.amount ?? body.price) || 0;
		if (offerPrice <= 0) return json({ error: 'Invalid offer price' }, { status: 400 });
		const listingId = parseInt(action);
		const listing = await db
			.prepare('SELECT user_id, title FROM marketplace_listings WHERE id = ?')
			.get(listingId);
		if (!listing) return json({ error: 'Listing not found' }, { status: 404 });
		if (listing.user_id === userId)
			return json({ error: 'No puedes ofertar por tu propio artículo' }, { status: 400 });

		const user = await db
			.prepare('SELECT display_name, username FROM users WHERE id = ?')
			.get(userId);
		const userName = user?.display_name || user?.username || 'Alguien';

		// Persist the offer for the seller to manage
		await db
			.prepare(
				"INSERT INTO listing_offers (listing_id, buyer_id, seller_id, amount, message, status) VALUES (?, ?, ?, ?, ?, 'pending')"
			)
			.run(listingId, userId, listing.user_id, offerPrice, (body.message || '').slice(0, 500));

		await db
			.prepare(
				"INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id, message) VALUES (?, ?, 'offer', 'listing', ?, ?)"
			)
			.run(
				listing.user_id,
				userId,
				listingId,
				`${userName} te ha ofrecido $${offerPrice} por tu artículo '${listing.title}'.`
			);
		return json({ success: true, message: 'Oferta enviada al vendedor' });
	}

	if (action && /^\d+$/.test(action) && parts[1] === 'reviews') {
		const listingId = parseInt(action);
		const rating = Math.min(5, Math.max(1, parseInt(body.rating) || 5));
		const comment = (body.comment || '').trim();
		const listing = await db
			.prepare('SELECT id FROM marketplace_listings WHERE id = ?')
			.get(listingId);
		if (!listing) return json({ error: 'Listing not found' }, { status: 404 });

		await db
			.prepare(
				'INSERT INTO marketplace_reviews (listing_id, user_id, rating, comment) VALUES (?, ?, ?, ?)'
			)
			.run(listingId, userId, rating, comment);
		return json({ success: true, message: 'Reseña publicada' });
	}
	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function DELETE({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const userId = await requireAuth(request);
	const db = getDb();
	if (parts[0] && /^\d+$/.test(parts[0])) {
		const result = await db
			.prepare('DELETE FROM marketplace_listings WHERE id = ? AND user_id = ?')
			.run(parseInt(parts[0]), userId);
		if (result.changes > 0) return json({ success: true, message: 'Listing deleted' });
		return json({ error: 'Listing not found or unauthorized' }, { status: 404 });
	}
	return json({ error: 'Endpoint not found' }, { status: 404 });
}
