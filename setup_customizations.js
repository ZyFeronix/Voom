const db = require('better-sqlite3')('d:/Vsocial/database.sqlite');

db.exec(`
CREATE TABLE IF NOT EXISTS profile_customizations (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    primary_color VARCHAR(20),
    bg_color VARCHAR(20),
    bg_image_url VARCHAR(512),
    glass_blur REAL DEFAULT 15.0,
    glass_opacity REAL DEFAULT 0.8,
    font_family VARCHAR(100),
    custom_font_url VARCHAR(512),
    custom_css TEXT,
    blocks_layout TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

console.log('Table profile_customizations created successfully.');
