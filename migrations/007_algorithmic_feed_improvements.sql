-- =============================================================================
-- Migration 007: Algorithmic Feed Improvements (xAI-inspired deterministic engine)
-- =============================================================================

-- 1. POSTS: Scoring enhancements & engagement tracking
ALTER TABLE posts ADD COLUMN save_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN author_replies_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN first_engagement_at DATETIME DEFAULT NULL;

-- Triggers for atomic save_count sync
CREATE TRIGGER IF NOT EXISTS trg_save_inc AFTER INSERT ON saved_posts
BEGIN
    UPDATE posts SET save_count = save_count + 1 WHERE id = NEW.post_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_save_dec AFTER DELETE ON saved_posts
BEGIN
    UPDATE posts SET save_count = save_count - 1 WHERE id = OLD.post_id;
END;

-- Backfill save_count from existing saved_posts
UPDATE posts SET save_count = (
    SELECT COUNT(*) FROM saved_posts WHERE post_id = posts.id
) WHERE id IN (SELECT DISTINCT post_id FROM saved_posts);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_engagement_score 
ON posts(like_count, comment_count, share_count, save_count, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_velocity 
ON posts(created_at, first_engagement_at) 
WHERE first_engagement_at IS NOT NULL;

-- 2. USERS: Reputation score (TweepCred equivalent)
ALTER TABLE users ADD COLUMN reputation_score INTEGER NOT NULL DEFAULT 50;
CREATE INDEX IF NOT EXISTS idx_users_reputation ON users(reputation_score);

-- 3. REELS: Video quality metrics
ALTER TABLE reels ADD COLUMN views_50pct INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reels ADD COLUMN quality_views INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reels ADD COLUMN completion_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_reels_scoring 
ON reels(like_count, views_50pct, quality_views, created_at DESC);

CREATE TABLE IF NOT EXISTS reel_view_progress (
    reel_id    INTEGER NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_pct    INTEGER NOT NULL DEFAULT 0,
    is_quality BOOLEAN NOT NULL DEFAULT 0,
    viewed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reel_id, user_id)
) WITHOUT ROWID;

-- 4. CONTENT SIGNALS: Negative feedback ('not_interested', 'spam', 'offensive')
CREATE TABLE IF NOT EXISTS content_signals (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    signal_type VARCHAR(20) NOT NULL CHECK(signal_type IN ('not_interested', 'spam', 'offensive')),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id, signal_type)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_content_signals_user ON content_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_content_signals_post ON content_signals(post_id);

-- 5. FEED IMPRESSIONS: Anti-fatigue & discovery tracking
CREATE TABLE IF NOT EXISTS feed_impressions (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_feed_impressions_seen ON feed_impressions(user_id, seen_at);
