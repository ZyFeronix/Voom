-- =============================================================================
-- VSocial - Migración Principal: Esquema Completo de Base de Datos
-- SQLite/LibSQL | Optimizaciones de alta concurrencia y seguridad
-- =============================================================================

BEGIN;

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- para búsqueda fuzzy

-- =============================================================================
-- DOMINIO 1: NÚCLEO DE USUARIOS
-- =============================================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(32) NOT NULL UNIQUE,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(64),
    avatar_url VARCHAR(512),
    cover_url VARCHAR(512),
    bio TEXT,
    location VARCHAR(100),
    website VARCHAR(255),
    education VARCHAR(150),
    workplace VARCHAR(150),
    phone VARCHAR(20),
    birth_date DATE,
    gender VARCHAR(20),
    relationship_status VARCHAR(50),
    is_virtual BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    follower_count INT NOT NULL DEFAULT 0,
    following_count INT NOT NULL DEFAULT 0,
    post_count INT NOT NULL DEFAULT 0,
    wallet_credits NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    privacy_level VARCHAR(15) DEFAULT 'public',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users USING gin(username gin_trgm_ops);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE TABLE user_roles (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role)
);

CREATE TABLE user_settings (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(10) DEFAULT 'auto',
    language VARCHAR(10) DEFAULT 'es',
    notification_email BOOLEAN DEFAULT TRUE,
    notification_push BOOLEAN DEFAULT TRUE,
    notification_dms BOOLEAN DEFAULT TRUE,
    show_online_status BOOLEAN DEFAULT TRUE,
    allow_dms_from VARCHAR(15) DEFAULT 'friends',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_blocks (
    blocker_id INT REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE user_interests (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    category_id INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, category_id)
);

CREATE TABLE interest_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    icon VARCHAR(64),
    color VARCHAR(7),
    description TEXT
);

CREATE TABLE follows (
    follower_id INT REFERENCES users(id) ON DELETE CASCADE,
    following_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX idx_follows_following ON follows(following_id);

CREATE TABLE friendships (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    friend_id INT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, friend_id)
);

CREATE INDEX idx_friendships_status ON friendships(status);

-- =============================================================================
-- DOMINIO 2: PUBLICACIONES Y CONTENIDO
-- =============================================================================

CREATE TABLE posts (
    id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    privacy VARCHAR(15) DEFAULT 'public',
    like_count INT NOT NULL DEFAULT 0,
    comment_count INT NOT NULL DEFAULT 0,
    share_count INT NOT NULL DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_promoted BOOLEAN DEFAULT FALSE,
    promotion_score FLOAT DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_posts_user ON posts(user_id, created_at DESC);
CREATE INDEX idx_posts_public ON posts(privacy, created_at DESC) WHERE privacy = 'public';

CREATE TABLE post_media (
    id SERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    media_url VARCHAR(512) NOT NULL,
    media_type VARCHAR(15) DEFAULT 'image',
    width INT,
    height INT,
    position INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_likes (
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(20) DEFAULT 'like',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id)
);

CREATE INDEX idx_post_likes_user ON post_likes(user_id);

CREATE TABLE post_shares (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    like_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comments_post ON comments(post_id, created_at);

CREATE TABLE comment_likes (
    comment_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE hashtags (
    id SERIAL PRIMARY KEY,
    tag VARCHAR(100) NOT NULL UNIQUE,
    post_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_hashtags (
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    hashtag_id INT REFERENCES hashtags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, hashtag_id)
);

CREATE TABLE post_mentions (
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    mentioned_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, mentioned_user_id)
);

CREATE TABLE saved_posts (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id)
);

-- =============================================================================
-- DOMINIO 3: HISTORIAS (STORIES)
-- =============================================================================

CREATE TABLE stories (
    id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    media_url VARCHAR(512) NOT NULL,
    media_type VARCHAR(10) DEFAULT 'image',
    caption TEXT,
    duration_seconds INT DEFAULT 5,
    view_count INT DEFAULT 0,
    background_color VARCHAR(7),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stories_user ON stories(user_id, expires_at);
CREATE INDEX idx_stories_active ON stories(expires_at) WHERE expires_at > CURRENT_TIMESTAMP;

CREATE TABLE story_views (
    story_id BIGINT REFERENCES stories(id) ON DELETE CASCADE,
    viewer_id INT REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (story_id, viewer_id)
);

-- =============================================================================
-- DOMINIO 4: REELS
-- =============================================================================

CREATE TABLE reels (
    id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    video_url VARCHAR(512) NOT NULL,
    thumbnail_url VARCHAR(512),
    caption TEXT,
    duration_seconds INT,
    view_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    share_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reels_user ON reels(user_id, created_at DESC);
CREATE INDEX idx_reels_popular ON reels(like_count DESC, created_at DESC);

CREATE TABLE reel_likes (
    reel_id BIGINT REFERENCES reels(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reel_id, user_id)
);

CREATE TABLE reel_comments (
    id BIGSERIAL PRIMARY KEY,
    reel_id BIGINT REFERENCES reels(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES reel_comments(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reel_views (
    reel_id BIGINT REFERENCES reels(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reel_id, viewed_at, user_id)
) PARTITION BY RANGE (viewed_at);

-- =============================================================================
-- DOMINIO 5: MENSAJERÍA Y CHAT
-- =============================================================================

CREATE TABLE chat_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    description TEXT,
    avatar_url VARCHAR(512),
    creator_id INT REFERENCES users(id) ON DELETE SET NULL,
    is_encrypted BOOLEAN DEFAULT FALSE,
    max_members INT DEFAULT 256,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_group_members (
    group_id INT REFERENCES chat_groups(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(15) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_read_message_id BIGINT,
    is_muted BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id INT REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT REFERENCES users(id) ON DELETE CASCADE,
    group_id INT REFERENCES chat_groups(id) ON DELETE CASCADE,
    body TEXT,
    voice_url VARCHAR(512),
    voice_duration INT,
    media_url VARCHAR(512),
    media_type VARCHAR(15),
    reply_to_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_message_target CHECK (
        (receiver_id IS NOT NULL AND group_id IS NULL) OR
        (receiver_id IS NULL AND group_id IS NOT NULL)
    )
);

CREATE INDEX idx_messages_dm ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX idx_messages_group ON messages(group_id, created_at DESC);

CREATE TABLE message_reactions (
    message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id)
);

-- =============================================================================
-- DOMINIO 6: NOTIFICACIONES
-- =============================================================================

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_id INT REFERENCES users(id) ON DELETE CASCADE,
    actor_id INT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    entity_type VARCHAR(20),
    entity_id BIGINT,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);

-- =============================================================================
-- DOMINIO 7: MARKETPLACE
-- =============================================================================

CREATE TABLE marketplace_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    parent_id INT REFERENCES marketplace_categories(id),
    icon VARCHAR(64),
    slug VARCHAR(64) UNIQUE
);

CREATE TABLE marketplace_listings (
    id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    category_id INT REFERENCES marketplace_categories(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    condition VARCHAR(20) DEFAULT 'new',
    location VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    view_count INT DEFAULT 0,
    flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    fraud_score INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);

CREATE INDEX idx_listings_category ON marketplace_listings(category_id, status, created_at DESC);
CREATE INDEX idx_listings_user ON marketplace_listings(user_id);
CREATE INDEX idx_listings_flagged ON marketplace_listings(flagged) WHERE flagged = TRUE;

CREATE TABLE listing_media (
    id SERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    media_url VARCHAR(512) NOT NULL,
    position INT DEFAULT 0
);

CREATE TABLE listing_offers (
    id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    buyer_id INT REFERENCES users(id) ON DELETE CASCADE,
    offer_price NUMERIC(12, 2) NOT NULL,
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- DOMINIO 8: MODERACIÓN
-- =============================================================================

CREATE TABLE reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_id INT REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(30) NOT NULL,
    content_id BIGINT NOT NULL,
    reason VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE moderation_queue (
    id BIGSERIAL PRIMARY KEY,
    content_type VARCHAR(30) NOT NULL,
    content_id BIGINT NOT NULL,
    reason TEXT,
    priority INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending',
    assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE moderation_actions (
    id BIGSERIAL PRIMARY KEY,
    moderator_id INT REFERENCES users(id) ON DELETE CASCADE,
    target_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(30) NOT NULL,
    reason TEXT,
    duration_hours INT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE banned_users (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    banned_by INT REFERENCES users(id) ON DELETE SET NULL,
    banned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- DOMINIO 9: MONETIZACIÓN Y PUBLICIDAD
-- =============================================================================

CREATE TABLE credit_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    type VARCHAR(30) NOT NULL,
    description TEXT,
    reference_id VARCHAR(100),
    balance_after NUMERIC(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ad_campaigns (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(20) DEFAULT 'banner',
    target_url VARCHAR(512),
    media_url VARCHAR(512),
    budget_credits NUMERIC(12, 2) NOT NULL,
    spent_credits NUMERIC(12, 2) DEFAULT 0,
    impression_count INT DEFAULT 0,
    click_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ad_impressions (
    id BIGSERIAL PRIMARY KEY,
    campaign_id INT REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    ip_hash VARCHAR(64),
    clicked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE promotion_orders (
    id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(20) NOT NULL,
    content_id BIGINT NOT NULL,
    credits_spent NUMERIC(12, 2) NOT NULL,
    boost_multiplier FLOAT DEFAULT 1.5,
    status VARCHAR(20) DEFAULT 'active',
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- DOMINIO 10: FEEDS Y CACHÉ
-- =============================================================================

CREATE TABLE user_feeds (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    score FLOAT DEFAULT 0.0,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_feeds_user_score ON user_feeds(user_id, score DESC);

CREATE TABLE trending_hashtags (
    hashtag_id INT PRIMARY KEY REFERENCES hashtags(id) ON DELETE CASCADE,
    trend_score FLOAT DEFAULT 0.0,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- DOMINIO 11: EVENTOS Y TRANSMISIONES EN VIVO
-- =============================================================================

CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    host_id INT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    cover_url VARCHAR(512),
    location VARCHAR(200),
    is_online BOOLEAN DEFAULT FALSE,
    event_url VARCHAR(512),
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE,
    max_attendees INT,
    attendee_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'upcoming',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE event_attendees (
    event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'going',
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, user_id)
);

-- =============================================================================
-- DOMINIO 12: CONFIGURACIÓN DEL SISTEMA
-- =============================================================================

CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE install_log (
    id SERIAL PRIMARY KEY,
    step INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- DOMINIO 13: AVATARES VIRTUALES (CREATORS)
-- =============================================================================

CREATE TABLE virtual_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    character_name VARCHAR(64) NOT NULL,
    character_type VARCHAR(30),
    lore TEXT,
    traits JSONB DEFAULT '{}',
    follower_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE virtual_assets (
    id SERIAL PRIMARY KEY,
    profile_id INT REFERENCES virtual_profiles(id) ON DELETE CASCADE,
    asset_type VARCHAR(30) NOT NULL,
    asset_url VARCHAR(512) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- ROW-LEVEL SECURITY
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Política: usuarios pueden ver su propio registro
CREATE POLICY users_self_policy ON users
    FOR ALL USING (id = current_setting('app.current_user_id', true)::integer);

-- Política: mensajes accesibles solo a remitente y receptor
CREATE POLICY message_access_policy ON messages
    FOR ALL USING (
        sender_id = current_setting('app.current_user_id', true)::integer
        OR receiver_id = current_setting('app.current_user_id', true)::integer
    );

-- Política: notificaciones solo del destinatario
CREATE POLICY notifications_recipient_policy ON notifications
    FOR ALL USING (
        recipient_id = current_setting('app.current_user_id', true)::integer
    );

-- Política: transacciones solo del dueño
CREATE POLICY credit_transactions_owner_policy ON credit_transactions
    FOR ALL USING (
        user_id = current_setting('app.current_user_id', true)::integer
    );

-- Política: configuración solo del usuario
CREATE POLICY user_settings_self_policy ON user_settings
    FOR ALL USING (
        user_id = current_setting('app.current_user_id', true)::integer
    );

-- Política: amistades visibles a los involucrados
CREATE POLICY friendships_access_policy ON friendships
    FOR ALL USING (
        user_id = current_setting('app.current_user_id', true)::integer
        OR friend_id = current_setting('app.current_user_id', true)::integer
    );

-- =============================================================================
-- DATOS SEMILLA (SEED DATA)
-- =============================================================================

-- Categorías de interés para onboarding
INSERT INTO interest_categories (name, icon, color, description) VALUES
    ('Arte Digital', 'palette', '#FF6B9D', 'Ilustración, diseño gráfico y arte digital'),
    ('Música', 'music_note', '#C792EA', 'Producción musical, DJing y composición'),
    ('Gaming', 'sports_esports', '#00E5FF', 'Videojuegos, streaming y esports'),
    ('Fotografía', 'camera_alt', '#FF9800', 'Fotografía analógica y digital'),
    ('Moda & Estilo', 'style', '#F06292', 'Fashion, beauty y lifestyle'),
    ('Tecnología', 'code', '#42A5F5', 'Programación, hardware y tech'),
    ('Fitness', 'fitness_center', '#66BB6A', 'Ejercicio, nutrición y wellness'),
    ('Cocina', 'restaurant', '#FF7043', 'Gastronomía, recetas y chef virtual'),
    ('Viajes', 'flight', '#26C6DA', 'Turismo, aventuras y nómadas digitales'),
    ('Literatura', 'menu_book', '#AB47BC', 'Escritura, poesía y narrativa'),
    ('Cine & Series', 'movie', '#EC407A', 'Crítica cinematográfica y streaming'),
    ('Podcasting', 'mic', '#5C6BC0', 'Podcasts, radio y contenido de audio'),
    ('Ciencia', 'science', '#26A69A', 'Divulgación científica y curiosidades'),
    ('Animación', 'animation', '#FFCA28', 'Animación 2D, 3D y motion graphics');

-- Categorías de marketplace
INSERT INTO marketplace_categories (name, icon, slug) VALUES
    ('Arte Digital', 'palette', 'arte-digital'),
    ('Servicios Creativos', 'brush', 'servicios'),
    ('Electrónica', 'devices', 'electronica'),
    ('Moda Virtual', 'checkroom', 'moda'),
    ('Cursos & Tutoriales', 'school', 'educacion'),
    ('Música & Audio', 'audiotrack', 'musica'),
    ('Fotografía & Video', 'videocam', 'multimedia');

-- Configuración inicial del sistema
INSERT INTO system_settings (key, value, description) VALUES
    ('app_name', 'VSocial', 'Nombre de la aplicación'),
    ('app_tagline', 'La red social para creadores virtuales', 'Tagline de la app'),
    ('registration_open', 'true', 'Permite nuevos registros'),
    ('maintenance_mode', 'false', 'Modo mantenimiento'),
    ('max_upload_size_mb', '10', 'Tamaño máximo de archivo en MB'),
    ('installed', 'true', 'Instalación completada'),
    ('version', '1.0.0', 'Versión actual de la app');

COMMIT;
