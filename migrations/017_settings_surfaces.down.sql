-- Reversión de 017_settings_surfaces.sql (requiere SQLite 3.35+ para DROP COLUMN)
ALTER TABLE user_settings DROP COLUMN card_opacity;
ALTER TABLE user_settings DROP COLUMN border_radius;
ALTER TABLE user_settings DROP COLUMN wallpaper_mode;
ALTER TABLE user_settings DROP COLUMN aero_gloss;
ALTER TABLE user_settings DROP COLUMN active_preset;
