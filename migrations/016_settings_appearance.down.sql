-- Reversión de 016_settings_appearance.sql (requiere SQLite 3.35+ para DROP COLUMN)
ALTER TABLE user_settings DROP COLUMN accent_color;
ALTER TABLE user_settings DROP COLUMN app_font;
ALTER TABLE user_settings DROP COLUMN font_scale;
ALTER TABLE user_settings DROP COLUMN density;
ALTER TABLE user_settings DROP COLUMN app_wallpaper_url;
ALTER TABLE user_settings DROP COLUMN wallpaper_dim;
