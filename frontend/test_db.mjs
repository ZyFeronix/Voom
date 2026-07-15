import { initDb, getDb } from './src/lib/server/db.js';

async function check() {
  try {
    await initDb();
    const db = getDb();
    const rows = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profile_customizations'").all();
    console.log("Table exists:", rows.length > 0);
    if (rows.length > 0) {
      const data = await db.prepare("SELECT * FROM profile_customizations").all();
      console.log("Data:", data);
    }
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}
check();
