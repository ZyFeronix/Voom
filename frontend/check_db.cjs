const db = require('better-sqlite3')('../database.sqlite');
const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='activity_logs'").all();
console.log("Indexes:");
console.log(indexes);

const views = db.prepare("SELECT user_id, entity_type, entity_id, COUNT(*) as count FROM activity_logs WHERE action_type='view' GROUP BY user_id, entity_type, entity_id HAVING count > 1").all();
console.log("Duplicate Views (Should be empty):");
console.log(views);
