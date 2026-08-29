-- 016_settings_appearance.sql
-- Apariencia global de la aplicación por usuario (editor /settings/design,
-- pestaña "Aplicación"). Columnas aditivas: '' / 'default' / 1.0 / 'cozy'
-- significan "heredar del tema activo" (los valores vacíos no pisan nada).
--
-- accent_color: hex sólido #RGB/#RRGGBB (VARCHAR(7) alineado con el validador;
--   deliberadamente SIN alpha para no generar transparencias raras en botones).
-- app_font: default|outfit|inter|mono|custom ('custom' reutiliza la fuente
--   subida al perfil en profile_customizations.custom_font_url).
-- font_scale: escala tipográfica global (0.85–1.25; clamp también en backend).
-- density: compact|cozy|roomy.
-- app_wallpaper_url: http(s) o ruta relativa /uploads/... (vacío = sin fondo).
-- wallpaper_dim: oscurecimiento del wallpaper en % (0–70) para legibilidad.

ALTER TABLE user_settings ADD COLUMN accent_color VARCHAR(7) DEFAULT '';
ALTER TABLE user_settings ADD COLUMN app_font VARCHAR(20) DEFAULT 'default';
ALTER TABLE user_settings ADD COLUMN font_scale REAL DEFAULT 1.0;
ALTER TABLE user_settings ADD COLUMN density VARCHAR(10) DEFAULT 'cozy';
ALTER TABLE user_settings ADD COLUMN app_wallpaper_url VARCHAR(500) DEFAULT '';
ALTER TABLE user_settings ADD COLUMN wallpaper_dim INTEGER DEFAULT 30;
