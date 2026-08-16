-- =============================================================================
-- Migration 010: Anonymous Posts Support
-- Adds is_anonymous column to posts table and index for filtering
-- =============================================================================

ALTER TABLE posts ADD COLUMN is_anonymous BOOLEAN DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_posts_anonymous ON posts(is_anonymous, created_at DESC);
