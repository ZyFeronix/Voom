const Database = require('better-sqlite3');
const db = new Database('./database.sqlite');

try {
  db.prepare('ALTER TABLE reel_comments ADD COLUMN reply_to_id INTEGER').run();
  console.log("Column reply_to_id added.");
} catch (e) {
  if (e.message.includes('duplicate column name')) {
    console.log("Column reply_to_id already exists.");
  } else {
    console.error(e);
  }
}

// Ensure the schema allows null for parent_id if needed, but since it already works we don't touch it.
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='reel_comments'").get();
console.log("Current schema:", schema.sql);
