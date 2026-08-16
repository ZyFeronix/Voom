-- =============================================================================
-- Migration 008 Down: Revert post_shares & Triggers
-- =============================================================================

DROP TRIGGER IF EXISTS trg_share_dec;
DROP TRIGGER IF EXISTS trg_share_inc;
DROP TABLE IF EXISTS post_shares;
