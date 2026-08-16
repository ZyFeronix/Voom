-- =============================================================================
-- 006_messages_enhancements.down.sql — Revierte mejoras de mensajería
-- =============================================================================
-- SQLite no soporta DROP COLUMN en versiones antiguas; se reconstruyen las
-- tablas afectadas sin las columnas añadidas por la migración 006.
-- =============================================================================

PRAGMA foreign_keys = OFF;

-- messages_new: quitar edited_at
CREATE TABLE messages_new__tmp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    body TEXT,
    voice_url VARCHAR(512),
    voice_duration INTEGER,
    media_url VARCHAR(512),
    media_type VARCHAR(15),
    reply_to_id INTEGER REFERENCES messages_new(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO messages_new__tmp (id, conversation_id, sender_id, body, voice_url, voice_duration, media_url, media_type, reply_to_id, is_deleted, created_at)
    SELECT id, conversation_id, sender_id, body, voice_url, voice_duration, media_url, media_type, reply_to_id, is_deleted, created_at FROM messages_new;
DROP TABLE messages_new;
ALTER TABLE messages_new__tmp RENAME TO messages_new;
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages_new(conversation_id, created_at DESC);

-- conversation_participants: quitar is_pinned, is_muted
CREATE TABLE conversation_participants__tmp (
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_admin BOOLEAN DEFAULT 0,
    PRIMARY KEY (conversation_id, user_id)
);
INSERT INTO conversation_participants__tmp (conversation_id, user_id, joined_at, is_admin)
    SELECT conversation_id, user_id, joined_at, is_admin FROM conversation_participants;
DROP TABLE conversation_participants;
ALTER TABLE conversation_participants__tmp RENAME TO conversation_participants;
CREATE INDEX IF NOT EXISTS idx_participants_user ON conversation_participants(user_id);

PRAGMA foreign_keys = ON;
