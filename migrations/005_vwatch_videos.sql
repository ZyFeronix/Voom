-- Migration: 005_vwatch_videos.sql
-- Sub-sección de vídeos V-Watch (Estilo YouTube)

CREATE TABLE IF NOT EXISTS video_details (
  id TEXT PRIMARY KEY,
  post_id TEXT UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  duration INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT NOT NULL,
  views_count INTEGER DEFAULT 0,
  category TEXT DEFAULT 'general',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_video_views ON video_details(views_count DESC);
CREATE INDEX IF NOT EXISTS idx_video_category ON video_details(category);
CREATE INDEX IF NOT EXISTS idx_video_created ON video_details(created_at DESC);
