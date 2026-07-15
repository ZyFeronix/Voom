import { initDb, closeDb } from './src/lib/server/db.js';

async function test() {
  const db = await initDb();
  console.log("DB initialized.");

  try {
    await db.prepare(`SELECT p.*, u.username, u.avatar_url FROM posts p JOIN users u ON p.user_id = u.id WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 5`).all();
    console.log("posts query OK");
  } catch(e) {
    console.error("posts error:", e.message);
  }

  try {
    await db.prepare(`SELECT r.*, u.username, u.avatar_url, r.media_url as media FROM reels r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT 5`).all();
    console.log("reels query OK");
  } catch(e) {
    console.error("reels error:", e.message);
  }

  try {
    await db.prepare(`SELECT p.*, u.username, u.avatar_url FROM posts p JOIN users u ON p.user_id = u.id WHERE p.deleted_at IS NOT NULL ORDER BY p.deleted_at DESC LIMIT 5`).all();
    console.log("trash query OK");
  } catch(e) {
    console.error("trash error:", e.message);
  }

  closeDb();
}
test();
