-- =============================================================================
-- Migration 012: Admin Operations — Verifications & Moderation Strikes
-- Enables creator/VTuber verification application tracking and structured
-- disciplinary strike records with timeout and ban management.
-- =============================================================================

-- 1. Solicitudes de Verificación de Creadores, VTubers, Streamers y Organizaciones
CREATE TABLE IF NOT EXISTS verification_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folio VARCHAR(64) UNIQUE NOT NULL,
    category VARCHAR(32) NOT NULL, -- 'creator', 'streamer', 'organization', 'public_figure', 'government'
    legal_name VARCHAR(128),
    applicant_handle VARCHAR(64) NOT NULL,
    contact_email VARCHAR(128) NOT NULL,
    specialty VARCHAR(64),
    portfolio_links TEXT, -- JSON array of strings
    social_links TEXT,    -- JSON object { twitch, youtube, artstation, twitter, pixiv... }
    id_document_url VARCHAR(512),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'reviewing', 'approved', 'rejected'
    admin_notes TEXT,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_verif_status ON verification_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verif_user ON verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verif_folio ON verification_requests(folio);

-- 2. Historial de Sanciones Disciplinarias (Strikes)
CREATE TABLE IF NOT EXISTS user_strikes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    strike_level INTEGER NOT NULL DEFAULT 1, -- 1: Advertencia, 2: Silencio 24h, 3: Suspensión 7d, 4: Ban Permanente
    action_taken VARCHAR(32) NOT NULL,      -- 'warning', 'timeout', 'temp_ban', 'perm_ban'
    reason TEXT NOT NULL,
    report_id INTEGER REFERENCES reports(id) ON DELETE SET NULL,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_strikes_user ON user_strikes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strikes_expires ON user_strikes(expires_at);

-- 3. Columnas de control en users
ALTER TABLE users ADD COLUMN muted_until DATETIME;
ALTER TABLE users ADD COLUMN strike_count INTEGER DEFAULT 0;
