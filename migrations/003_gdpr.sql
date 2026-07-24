-- =============================================================================
-- 003_gdpr.sql — RGPD compliance (right to erasure + consent provenance)
-- =============================================================================
-- Adds soft-delete + consent timestamps to the users table. Mirrored in
-- schema_sqlite.sql (the canonical schema), so fresh installs already have
-- these columns and this migration only ALTERs existing databases.
-- =============================================================================

PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN deleted_at DATETIME;
ALTER TABLE users ADD COLUMN terms_accepted_at DATETIME;
ALTER TABLE users ADD COLUMN privacy_accepted_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
