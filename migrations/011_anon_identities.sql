-- =============================================================================
-- Migration 011: Anonymous Identities
-- Permanent, exclusive anonymous username per user — used as the public persona
-- for anonymous posts AND for comments on anonymous posts (Facebook-like but
-- improved: one identity, set once, never changes).
-- =============================================================================

CREATE TABLE IF NOT EXISTS anon_identities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    anon_username TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_anon_identities_username ON anon_identities(anon_username);
