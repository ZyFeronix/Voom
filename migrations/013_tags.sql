-- =============================================================================
-- Migration 013: Tags gestionados por administración
-- Tags curados y administrables desde /admin/tags. Son "funcionales": el feed
-- de /explore los usa como filtro real (los posts se emparejan por hashtag
-- #slug, vía post_hashtags).
-- =============================================================================

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(60) NOT NULL,
    slug VARCHAR(60) NOT NULL UNIQUE,   -- coincide con el hashtag #slug de los posts
    icon VARCHAR(40) DEFAULT 'sell',    -- nombre de icono Material Symbols/Outlined
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);

-- Seeds por defecto (los mismos que antes estaban hardcodeados en /explore,
-- ahora como datos reales administrables)
INSERT OR IGNORE INTO tags (name, slug, icon) VALUES
    ('Gaming', 'gaming', 'sports_esports'),
    ('Arte Digital', 'arte-digital', 'palette'),
    ('Música', 'musica', 'music_note'),
    ('VTubing', 'vtubing', 'auto_awesome'),
    ('Streaming', 'streaming', 'live_tv');
