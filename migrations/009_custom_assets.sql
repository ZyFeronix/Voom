-- Migration 009: Custom assets for Team V-Social and staff (Emotes, Stickers, Emojis, GIFs)
CREATE TABLE IF NOT EXISTS custom_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    shortcode VARCHAR(64) NOT NULL,
    asset_type VARCHAR(20) NOT NULL, -- 'emoji', 'emote', 'sticker', 'gif'
    url VARCHAR(512) NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(64) NOT NULL,
    is_animated BOOLEAN DEFAULT 0,
    is_approved BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_assets_user_id ON custom_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_assets_type ON custom_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_custom_assets_shortcode ON custom_assets(shortcode);
