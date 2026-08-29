-- =============================================================================
-- Migration 019: Códigos de invitación (beta cerrada)
-- Gate de registro: cuando el setting `require_invite_code` está activo, el
-- registro exige un código válido, activo, no expirado y con usos disponibles.
-- `invite_uses` deja trazabilidad de quién entró con cada código.
-- =============================================================================

CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(32) NOT NULL UNIQUE,         -- formato VOOM-XXXX-XXXX
    label VARCHAR(120),                       -- nota interna del admin ('Lote Discord #1', etc.)
    max_uses INTEGER,                         -- NULL = ilimitado
    uses_count INTEGER NOT NULL DEFAULT 0,
    expires_at DATETIME,                      -- NULL = sin expiración
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);

CREATE TABLE IF NOT EXISTS invite_uses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_id INTEGER NOT NULL REFERENCES invite_codes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_invite_uses_code ON invite_uses(code_id);

-- Flag maestro del gate (por defecto desactivado: registro libre)
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('require_invite_code', '0');
