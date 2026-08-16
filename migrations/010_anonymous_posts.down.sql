-- =============================================================================
-- Migration 010 Down: Revert Anonymous Posts Support
-- =============================================================================

DROP INDEX IF EXISTS idx_posts_anonymous;
ALTER TABLE posts DROP COLUMN is_anonymous;
