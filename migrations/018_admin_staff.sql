-- =============================================================================
-- Migration 018: Staff Panels — Audit Trail & Internal Announcements
-- Adds a dedicated audit log for every staff mutation (who/what/when/ip) and
-- an internal announcement board readable by all staff, writable by admins.
-- =============================================================================

-- 1. Auditoría de acciones del staff (panel de administración)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,          -- 'user.ban', 'report.resolve', 'settings.update', ...
    entity_type VARCHAR(32),              -- 'user', 'post', 'reel', 'report', 'verification', 'strike', 'settings', 'announcement'
    entity_id VARCHAR(64),
    details TEXT,                         -- JSON con metadatos (cambios old→new, motivo, etc.)
    ip VARCHAR(64),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON admin_audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_logs(created_at DESC);

-- 2. Tablón de anuncios internos del staff (equipo lee, admin publica)
CREATE TABLE IF NOT EXISTS staff_announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON staff_announcements(pinned DESC, created_at DESC);
