import { initDb, getDb } from './frontend/src/lib/server/db.js';

async function run() {
  await initDb();
  const db = getDb();
  
  try {
    await db.prepare('INSERT INTO reel_comments (reel_id, user_id, body, parent_id) VALUES (?, ?, ?, ?)').run(1, 1, 'test', 999);
    console.log('Inserted successfully with 999');
  } catch (e) {
    console.error('Failed with 999:', e.message);
  }

  process.exit(0);
}
run();
