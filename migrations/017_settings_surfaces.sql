-- 017_settings_surfaces.sql
-- «Frutiger Aero Engine»: superficies y estética Aero por usuario (pestaña
-- «Aplicación» de /settings/design). Columnas aditivas; los defaults son
-- transparentes con el look actual (cristal 100% = sólido estándar).
--
-- card_opacity: 40–100 (%); < 100 activa el efecto cristal translúcido
--   (color-mix sobre --bg-surface, patrón ya probado en ProfileThemeShell).
-- border_radius: sharp | modern | rounded | bubble — redefine los tokens
--   --radius-* existentes (--radius-full se conserva: círculos/píldoras).
-- wallpaper_mode: cover | tile | fit (tile = mosaico para burbujas/gotas/
--   pixel art/patrones repetidos).
-- aero_gloss: 1 = brillo especular curvo de cristal + bisel de luz interior
--   (firma visual Frutiger Aero / Windows 7 / Mac OS X Aqua).
-- active_preset: id del preset estético activo ('' = ninguno; solo
--   [a-z0-9_-], máx. 30 — tracking informativo, no whitelist de catálogo).

ALTER TABLE user_settings ADD COLUMN card_opacity INTEGER DEFAULT 100;
ALTER TABLE user_settings ADD COLUMN border_radius VARCHAR(10) DEFAULT 'rounded';
ALTER TABLE user_settings ADD COLUMN wallpaper_mode VARCHAR(10) DEFAULT 'cover';
ALTER TABLE user_settings ADD COLUMN aero_gloss BOOLEAN DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN active_preset VARCHAR(30) DEFAULT '';
