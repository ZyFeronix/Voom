-- 014_settings_theme_default.down.sql — restaura el default anterior
CREATE TABLE user_settings_old_def (
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

INSERT INTO user_settings_old_def SELECT * FROM user_settings;
DROP TABLE user_settings;
ALTER TABLE user_settings_old_def RENAME TO user_settings;
