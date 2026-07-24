import { initDb, getDb, closeDb } from './src/lib/server/db.js';

async function main() {
	await initDb();
	const db = getDb();

	console.log('Fixing reel comment counts...');
	const reelsResult = await db.prepare('SELECT id, comment_count FROM reels').all();
	let fixedCount = 0;

	for (const reel of reelsResult) {
		const actualResult = await db
			.prepare('SELECT COUNT(*) as c FROM reel_comments WHERE reel_id = ?')
			.get(reel.id);
		const actualCount = actualResult.c;

		if (actualCount !== reel.comment_count) {
			console.log(
				`Reel ${reel.id}: DB says ${reel.comment_count}, actual is ${actualCount}. Fixing...`
			);
			await db.prepare('UPDATE reels SET comment_count = ? WHERE id = ?').run(actualCount, reel.id);
			fixedCount++;
		}
	}

	console.log(`Done! Fixed ${fixedCount} reels.`);
	closeDb();
}

main().catch(console.error);
