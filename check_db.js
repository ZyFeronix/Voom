const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./database.sqlite');
const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
console.log("Tables:", tables.map(t => t.name));
const columns = db.prepare(`PRAGMA table_info(reel_comments)`).all();
console.log("Columns of reel_comments:", columns);
