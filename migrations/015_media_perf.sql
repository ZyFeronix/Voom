-- 015_media_perf.sql
-- Optimizaciones de rendimiento de medios (auditoría Unlighthouse):
--
-- 1. listing_media.thumb_url: thumbnail JPEG (máx. 540px) generado en upload.
--    Los grids de /marketplace servían el archivo original sin redimensionar
--    (LCP medido: 13.1s).
-- 2. reels.video_width / video_height: dimensiones reales del video capturadas
--    al publicar. Permiten al cliente fijar el aspect-ratio ANTES del primer
--    render y eliminar el reflujo de los overlays cuando llega
--    `loadedmetadata` (CLS medido: 0.307).

ALTER TABLE listing_media ADD COLUMN thumb_url VARCHAR(512);
ALTER TABLE reels ADD COLUMN video_width INTEGER;
ALTER TABLE reels ADD COLUMN video_height INTEGER;
