-- =============================================================================
-- VSocial — Pure libSQL (SQLite-compatible) Canonical Schema
-- =============================================================================
-- This file is the SINGLE source of truth for the database layout.
-- `frontend/src/lib/server/db.js::runSchema()` executes it on every boot;
-- it is fully idempotent (every statement uses CREATE TABLE IF NOT EXISTS
-- or INSERT OR IGNORE), so it is safe to run against an existing database.
--
-- The migrations/ directory is kept only as a historical diff log. New
-- structural changes must be folded into THIS file directly. The install
-- wizard (routes/api/install/+server.js) also loads this file verbatim
-- into a fresh database, so it MUST stay self-contained and loadable.
--
-- PRAGMAs are set programmatically by db.js on every connection init.
-- =============================================================================

-- =============================================================================
-- DOMAIN 1: USERS & AUTH
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    category VARCHAR(64),
    role VARCHAR(20) DEFAULT 'user',
    is_virtual BOOLEAN NOT NULL DEFAULT 0,
    is_verified BOOLEAN NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    is_banned BOOLEAN NOT NULL DEFAULT 0,
    follower_count INTEGER NOT NULL DEFAULT 0,
    following_count INTEGER NOT NULL DEFAULT 0,
    post_count INTEGER NOT NULL DEFAULT 0,
    wallet_credits NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    wallet_balance REAL NOT NULL DEFAULT 0.00,
    privacy_level VARCHAR(15) DEFAULT 'public',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    email_verified BOOLEAN DEFAULT 0,
    profile_completion INTEGER DEFAULT 0,
    xp_points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    checkin_streak INTEGER DEFAULT 0,
    last_checkin_at DATETIME,
    deleted_at DATETIME,
    terms_accepted_at DATETIME,
    privacy_accepted_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS user_titles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    color VARCHAR(20) DEFAULT 'blue',
    granted_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_titles ON user_titles(user_id);

CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(10) DEFAULT 'auto',
    language VARCHAR(10) DEFAULT 'es',
    notification_email BOOLEAN DEFAULT 1,
    notification_push BOOLEAN DEFAULT 1,
    notification_dms BOOLEAN DEFAULT 1,
    show_online_status BOOLEAN DEFAULT 1,
    allow_dms_from VARCHAR(15) DEFAULT 'friends',
    w_interests INTEGER DEFAULT 50,
    w_interactions INTEGER DEFAULT 40,
    w_social INTEGER DEFAULT 30,
    w_popularity INTEGER DEFAULT 20,
    w_recency INTEGER DEFAULT 70,
    w_diversity INTEGER DEFAULT 15,
    feed_mode VARCHAR(20) DEFAULT 'intelligent',
    profile_visibility VARCHAR(15) DEFAULT 'public',
    allow_dms VARCHAR(15) DEFAULT 'everyone',
    notify_likes BOOLEAN DEFAULT 1,
    notify_comments BOOLEAN DEFAULT 1,
    notify_follows BOOLEAN DEFAULT 1,
    notify_dms BOOLEAN DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- =============================================================================
-- DOMAIN 2: POSTS & CONTENT
-- =============================================================================

CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    privacy VARCHAR(15) DEFAULT 'public',
    like_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    share_count INTEGER NOT NULL DEFAULT 0,
    is_pinned BOOLEAN DEFAULT 0,
    is_promoted BOOLEAN DEFAULT 0,
    promotion_score REAL DEFAULT 0.0,
    mood VARCHAR(30),
    privacy_level VARCHAR(15) DEFAULT 'public',
    scheduled_at DATETIME,
    status VARCHAR(15) DEFAULT 'published',
    deleted_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, created_at DESC);

CREATE TABLE IF NOT EXISTS post_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    media_url VARCHAR(512) NOT NULL,
    media_type VARCHAR(15) DEFAULT 'image',
    width INTEGER,
    height INTEGER,
    position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_likes (
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(20) DEFAULT 'like',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_reactions (
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    reaction VARCHAR(20) DEFAULT 'like',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    deleted_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS comment_reactions (
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    reaction VARCHAR(20) DEFAULT 'like',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, user_id),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saved_posts (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS hashtags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name VARCHAR(100) NOT NULL UNIQUE,
    post_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_hashtags (
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    tag_name VARCHAR(100),
    PRIMARY KEY(post_id, tag_name)
);

CREATE TABLE IF NOT EXISTS check_ins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    place_name VARCHAR(200),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_checkins_user ON check_ins(user_id, created_at DESC);

-- =============================================================================
-- DOMAIN 3: STORIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    media_url VARCHAR(512) NOT NULL,
    media_type VARCHAR(10) DEFAULT 'image',
    caption TEXT,
    duration_seconds INTEGER DEFAULT 5,
    view_count INTEGER DEFAULT 0,
    background_color VARCHAR(7),
    text_meta TEXT,
    expires_at DATETIME DEFAULT (datetime('now', '+1 day')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stories_active ON stories(expires_at);

CREATE TABLE IF NOT EXISTS story_highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(64) NOT NULL,
    cover_url VARCHAR(512),
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_highlights_user ON story_highlights(user_id, sort_order);

CREATE TABLE IF NOT EXISTS story_highlight_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    highlight_id INTEGER NOT NULL REFERENCES story_highlights(id) ON DELETE CASCADE,
    story_id INTEGER REFERENCES stories(id) ON DELETE SET NULL,
    media_url VARCHAR(512) NOT NULL,
    media_type VARCHAR(10) DEFAULT 'image',
    caption TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- DOMAIN 4: REELS
-- =============================================================================

CREATE TABLE IF NOT EXISTS reels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    video_url VARCHAR(512) NOT NULL,
    thumbnail_url VARCHAR(512),
    caption TEXT,
    duration_seconds INTEGER,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reels_user ON reels(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reel_likes (
    reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reel_id, user_id)
);

CREATE TABLE IF NOT EXISTS reel_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES reel_comments(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    deleted_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel ON reel_comments(reel_id, created_at);

-- =============================================================================
-- DOMAIN 5: MESSAGING & CHAT
-- =============================================================================

CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type VARCHAR(10) DEFAULT 'dm',
    group_name VARCHAR(64),
    group_avatar_url VARCHAR(512),
    creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    last_message_at DATETIME,
    is_archived BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_admin BOOLEAN DEFAULT 0,
    PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_participants_user ON conversation_participants(user_id);

CREATE TABLE IF NOT EXISTS messages_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    body TEXT,
    voice_url VARCHAR(512),
    voice_duration INTEGER,
    media_url VARCHAR(512),
    media_type VARCHAR(15),
    reply_to_id INTEGER REFERENCES messages_new(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages_new(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_reactions (
    message_id INTEGER REFERENCES messages_new(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(16) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS message_read_receipts (
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages_new(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id)
);

-- =============================================================================
-- DOMAIN 6: NOTIFICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    entity_type VARCHAR(20),
    entity_id INTEGER,
    message TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);

-- =============================================================================
-- DOMAIN 6b: MODERATION REPORTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL,
    entity_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(15) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id, created_at DESC);

-- =============================================================================
-- DOMAIN 7: MARKETPLACE
-- =============================================================================

CREATE TABLE IF NOT EXISTS marketplace_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(64) NOT NULL UNIQUE,
    parent_id INTEGER REFERENCES marketplace_categories(id),
    icon VARCHAR(64),
    slug VARCHAR(64) UNIQUE
);

CREATE TABLE IF NOT EXISTS marketplace_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES marketplace_categories(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    condition VARCHAR(20) DEFAULT 'new',
    location VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    view_count INTEGER DEFAULT 0,
    flagged BOOLEAN DEFAULT 0,
    flag_reason TEXT,
    fraud_score INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT (datetime('now', '+30 days'))
);

CREATE TABLE IF NOT EXISTS listing_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    media_url VARCHAR(512) NOT NULL,
    position INTEGER DEFAULT 0
);

-- =============================================================================
-- DOMAIN 8: WALLET & TRANSACTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance REAL DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    reference_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- DOMAIN 9: FREELANCE GIGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS gigs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    type TEXT NOT NULL DEFAULT 'commission',
    price_min REAL DEFAULT 0,
    price_max REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    tags TEXT DEFAULT '',
    status TEXT DEFAULT 'open',
    apply_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_gigs_user ON gigs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gigs_status ON gigs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS gig_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gig_id INTEGER NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gig_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_gig_applications_gig ON gig_applications(gig_id, status);
CREATE INDEX IF NOT EXISTS idx_gig_applications_user ON gig_applications(user_id);

-- =============================================================================
-- DOMAIN 10: WEB PUSH NOTIFICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_push_user ON web_push_subscriptions(user_id);

-- =============================================================================
-- DOMAIN 11: SYSTEM (SETTINGS, ADS, CMS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sponsored_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    advertiser_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    media_url VARCHAR(512),
    cta_url VARCHAR(512),
    target_age_min INTEGER DEFAULT 13,
    target_age_max INTEGER DEFAULT 99,
    target_gender VARCHAR(20) DEFAULT 'all',
    target_interests TEXT,
    budget REAL DEFAULT 0,
    spent REAL DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    starts_at DATETIME,
    ends_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sponsored_active ON sponsored_posts(status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS cms_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    body_html TEXT,
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_published BOOLEAN DEFAULT 0,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- DOMAIN 12: GROUPS & PAGES
-- =============================================================================

CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    avatar_url VARCHAR(512),
    cover_url VARCHAR(512),
    privacy VARCHAR(15) DEFAULT 'public',
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_count INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_groups_slug ON groups(slug);

CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

CREATE TABLE IF NOT EXISTS group_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    privacy VARCHAR(15) DEFAULT 'group',
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_group_posts ON group_posts(group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS group_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date DATETIME NOT NULL,
    location VARCHAR(200),
    is_virtual BOOLEAN DEFAULT 0,
    virtual_link VARCHAR(512),
    rsvp_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_group_events_date ON group_events(group_id, event_date);

CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    avatar_url VARCHAR(512),
    cover_url VARCHAR(512),
    category VARCHAR(50),
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    follower_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS page_followers (
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (page_id, user_id)
);

-- =============================================================================
-- DOMAIN 13: AUTH & SECURITY (OAUTH, EMAIL TOKENS, PRIVACY)
-- =============================================================================

CREATE TABLE IF NOT EXISTS oauth_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    provider_uid VARCHAR(191) NOT NULL,
    email VARCHAR(191),
    display_name VARCHAR(64),
    avatar_url VARCHAR(512),
    access_token TEXT,
    refresh_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_uid)
);
CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id);

CREATE TABLE IF NOT EXISTS email_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(128) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL DEFAULT 'verify',
    used BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_tokens ON email_tokens(token, used);

CREATE TABLE IF NOT EXISTS blocked_users (
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocked_by ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_user ON blocked_users(blocked_id);

CREATE TABLE IF NOT EXISTS snoozed_users (
    snoozer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snoozed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snoozed_until DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (snoozer_id, snoozed_id)
);

-- =============================================================================
-- DOMAIN 14: USER AESTHETICS (GLASSMORPHISM 2.0 & BLOCKS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS profile_customizations (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    primary_color VARCHAR(20),
    bg_color VARCHAR(20),
    bg_image_url VARCHAR(512),
    glass_blur REAL DEFAULT 15.0,
    glass_opacity REAL DEFAULT 0.8,
    font_family VARCHAR(100),
    custom_font_url VARCHAR(512),
    custom_css TEXT,
    blocks_layout TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- DOMAIN 15: INFRASTRUCTURE (CACHE, RTC, GAMIFICATION)
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_cache (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_system_cache_expires ON system_cache(expires_at);

CREATE TABLE IF NOT EXISTS rtc_signals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INTEGER NOT NULL,
    payload         TEXT    NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rtc_signals_recipient ON rtc_signals(recipient_id, id);

CREATE TABLE IF NOT EXISTS daily_xp_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_key VARCHAR(10) NOT NULL,
    source_key VARCHAR(50) NOT NULL,
    xp_amount INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date_key, source_key)
);

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT OR IGNORE INTO marketplace_categories (name, icon, slug) VALUES
    ('Arte Digital', 'palette', 'arte-digital'),
    ('Servicios Creativos', 'brush', 'servicios'),
    ('Electrónica', 'devices', 'electronica'),
    ('Moda Virtual', 'checkroom', 'moda'),
    ('Cursos & Tutoriales', 'school', 'educacion'),
    ('Música & Audio', 'audiotrack', 'musica'),
    ('Fotografía & Video', 'videocam', 'multimedia');

INSERT OR IGNORE INTO system_settings (key, value) VALUES
    ('site_name', 'VSocial'),
    ('allow_registration', '1'),
    ('max_upload_size_mb', '50'),
    ('reels_enabled', '1'),
    ('marketplace_enabled', '1'),
    ('maintenance_mode', '0'),
    ('groups_enabled', '1'),
    ('stories_enabled', '1'),
    ('oauth_google_enabled', '0'),
    ('oauth_apple_enabled', '0'),
    ('email_verification_required', '0'),
    ('demo_mode', '0'),
    ('vapid_public_key', ''),
    ('vapid_private_key', ''),
    ('smtp_host', ''),
    ('smtp_port', '587'),
    ('smtp_user', ''),
    ('smtp_pass', ''),
    ('smtp_from', 'noreply@vsocial.app'),
    ('tenor_api_key', '');

CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS unique_activity_idx ON activity_logs (user_id, action_type, entity_id, entity_type);
