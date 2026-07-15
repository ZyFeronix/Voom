/**
 * VSocial — Wallet API
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export async function _atomicTransfer(db, fromUserId, toUserId, amount, type, description, referenceId = null) {
	if (amount <= 0) throw new Error('Amount must be greater than zero.');

	const txn = db.transaction(async () => {
		const upd = await db.prepare("UPDATE wallets SET balance = balance - ?, updated_at = datetime('now') WHERE user_id = ? AND balance >= ?");
		const result = await upd.run(amount, fromUserId, amount);
		if (result.changes === 0) throw new Error('Insufficient funds or race condition intercepted.');

		const addResult = await db.prepare("UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?").run(amount, toUserId);
		if (addResult.changes === 0) {
			await db.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, ?)').run(toUserId, amount);
		}

		const senderWallet = await db.prepare('SELECT id FROM wallets WHERE user_id = ?').get(fromUserId);
		const recipientWallet = await db.prepare('SELECT id FROM wallets WHERE user_id = ?').get(toUserId);

		await db.prepare('INSERT INTO transactions (user_id, wallet_id, type, amount, description, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
			.run(fromUserId, senderWallet?.id, type + '_sent', -amount, description, referenceId);
		await db.prepare('INSERT INTO transactions (user_id, wallet_id, type, amount, description, reference_id) VALUES (?, ?, ?, ?, ?, ?)')
			.run(toUserId, recipientWallet?.id, type + '_received', amount, description, referenceId);
	});
	await txn();
}

export async function GET({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const userId = await requireAuth(request);
	const db = getDb();

	let wallet = await db.prepare('SELECT balance, currency FROM wallets WHERE user_id = ?').get(userId);
	if (!wallet) {
		await db.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, 0)').run(userId);
		wallet = { balance: 0, currency: 'USD' };
	}

	const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
	const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 20));
	const offset = (page - 1) * limit;

	if (action === 'transactions' || !action) {
		const transactions = await db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(userId, limit, offset);
		return json({ balance: wallet.balance, currency: wallet.currency || 'USD', transactions });
	}
	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function POST({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || '';
	const userId = await requireAuth(request);
	const body = await request.json();
	const db = getDb();

	if (action === 'transfer') {
		const toUserId = body.to_user_id;
		const amount = parseFloat(body.amount) || 0;
		if (!toUserId || amount <= 0) return json({ error: 'Invalid parameters' }, { status: 400 });
		try {
			await _atomicTransfer(db, userId, toUserId, amount, 'transfer', body.description || 'Direct Transfer');
			return json({ success: true, message: 'Transfer successful' });
		} catch (e) { return json({ error: e.message }, { status: 400 }); }
	}

	if (action === 'tip') {
		const toUserId = body.to_user_id;
		const amount = parseFloat(body.amount) || 0;
		if (!toUserId || amount <= 0) return json({ error: 'Parámetros inválidos' }, { status: 400 });
		if (toUserId === userId) return json({ error: 'No puedes enviarte un tip a ti mismo' }, { status: 400 });
		try {
			await _atomicTransfer(db, userId, toUserId, amount, 'tip', body.message || 'Tip');
			return json({ success: true, message: `Tip de $${amount} enviado exitosamente` });
		} catch (e) { return json({ error: e.message }, { status: 400 }); }
	}

	if (action === 'deposit') {
		const amount = parseFloat(body.amount) || 0;
		if (amount <= 0 || amount > 10000) return json({ error: 'Monto inválido (max $10,000)' }, { status: 400 });
		const txn = db.transaction(async () => {
			const upd = await db.prepare("UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?");
			const result = await upd.run(amount, userId);
			if (result.changes === 0) await db.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, ?)').run(userId, amount);
			const w = await db.prepare('SELECT id FROM wallets WHERE user_id = ?').get(userId);
			await db.prepare("INSERT INTO transactions (user_id, wallet_id, type, amount, description) VALUES (?, ?, 'deposit', ?, 'Depósito de saldo')").run(userId, w?.id, amount);
		});
		await txn();
		return json({ success: true, message: `$${amount} añadidos a tu billetera` });
	}

	if (action === 'withdraw') {
		const amount = parseFloat(body.amount) || 0;
		if (amount <= 0) return json({ error: 'Monto inválido' }, { status: 400 });
		const txn = db.transaction(async () => {
			const upd = await db.prepare("UPDATE wallets SET balance = balance - ?, updated_at = datetime('now') WHERE user_id = ? AND balance >= ?");
			const result = await upd.run(amount, userId, amount);
			if (result.changes === 0) throw new Error('Saldo insuficiente');
			const w = await db.prepare('SELECT id FROM wallets WHERE user_id = ?').get(userId);
			await db.prepare("INSERT INTO transactions (user_id, wallet_id, type, amount, description) VALUES (?, ?, 'withdraw', ?, 'Retiro de saldo')").run(userId, w?.id, -amount);
		});
		try { await txn(); return json({ success: true, message: `$${amount} retirados de tu billetera` }); }
		catch (e) { return json({ error: e.message }, { status: 400 }); }
	}
	return json({ error: 'Endpoint not found' }, { status: 404 });
}

