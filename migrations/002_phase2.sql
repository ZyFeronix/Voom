-- =============================================================================
-- VSocial Phase 2 Migration
-- New domains: Auth tokens, OAuth, Privacy, Highlights, Groups, Push, Ads
-- =============================================================================

PRAGMA foreign_keys = ON;

-- =============================================================================
-- DOMAIN 1 EXTENSIONS: AUTH & SECURITY
-- =============================================================================

ALTER TABLE posts ADD COLUMN mood VARCHAR(30);
ALTER TABLE posts ADD COLUMN privacy_level VARCHAR(15) DEFAULT 'public';
ALTER TABLE posts ADD COLUMN scheduled_at DATETIME;
ALTER TABLE posts ADD COLUMN status VARCHAR(15) DEFAULT 'published';

CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, created_at DESC);

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

ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN profile_completion INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN xp_points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1;

-- =============================================================================
-- DOMAIN 2 EXTENSIONS: PRIVACY & MODERATION
-- =============================================================================

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
-- DOMAIN 3 EXTENSIONS: STORY HIGHLIGHTS
-- =============================================================================

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
-- DOMAIN 4: CHECK-INS & GEO
-- =============================================================================

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
-- DOMAIN 5 EXTENSIONS: MESSAGING ENHANCEMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS message_voice_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES messages_new(id) ON DELETE CASCADE,
    audio_url VARCHAR(512) NOT NULL,
    duration_seconds REAL NOT NULL,
    waveform_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE conversations ADD COLUMN is_archived BOOLEAN DEFAULT 0;

-- =============================================================================
-- DOMAIN 6: GROUPS & PAGES
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
-- DOMAIN 7: WEB PUSH NOTIFICATIONS
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
-- DOMAIN 8: SPONSORED POSTS / AD SERVER
-- =============================================================================

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

-- =============================================================================
-- DOMAIN 9: CMS PAGES
-- =============================================================================

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
-- DOMAIN 10: AUCTION / BIDDING
-- =============================================================================

ALTER TABLE listing_offers ADD COLUMN seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE listing_offers ADD COLUMN message TEXT;
ALTER TABLE listing_offers ADD COLUMN expires_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_offers_seller ON listing_offers(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_offers_listing ON listing_offers(listing_id, status);
