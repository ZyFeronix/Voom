-- Reversión de 015_media_perf.sql (requiere SQLite 3.35+ para DROP COLUMN)
ALTER TABLE listing_media DROP COLUMN thumb_url;
ALTER TABLE reels DROP COLUMN video_width;
ALTER TABLE reels DROP COLUMN video_height;
