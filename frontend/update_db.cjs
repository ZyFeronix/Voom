const db = require('better-sqlite3')('../database.sqlite');
db.exec(`
CREATE TABLE IF NOT EXISTS comment_reactions (
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    reaction VARCHAR(20) DEFAULT 'like',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, user_id),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);
console.log('Done');
