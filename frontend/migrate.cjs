const Database = require('better-sqlite3');
const db = new Database('../database.sqlite');
db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS unique_multimedia_views_idx ON activity_logs (user_id, entity_id, entity_type) WHERE action_type = 'view'`).run();
console.log('Index created successfully');
