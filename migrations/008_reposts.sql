-- =============================================================================
-- Migration 008: User Reposts & Post Shares Tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS post_shares (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_shares_user ON post_shares(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_shares_post ON post_shares(post_id);

-- Triggers for atomic share_count sync
CREATE TRIGGER IF NOT EXISTS trg_share_inc AFTER INSERT ON post_shares
BEGIN
    UPDATE posts SET share_count = share_count + 1 WHERE id = NEW.post_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_share_dec AFTER DELETE ON post_shares
BEGIN
    UPDATE posts SET share_count = MAX(share_count - 1, 0) WHERE id = OLD.post_id;
END;
