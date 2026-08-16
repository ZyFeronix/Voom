-- =============================================================================
-- 006_messages_enhancements.sql — Mejoras de mensajería
-- =============================================================================
-- Añade edición de mensajes (edited_at) y fijar/silenciar conversaciones por
-- participante (is_pinned, is_muted). Reflejado en schema_sqlite.sql (esquema
-- canónico), por lo que las instalaciones nuevas ya tienen estas columnas y
-- esta migración solo ALTERa bases de datos existentes.
-- =============================================================================

PRAGMA foreign_keys = ON;

ALTER TABLE messages_new ADD COLUMN edited_at DATETIME;
ALTER TABLE conversation_participants ADD COLUMN is_pinned BOOLEAN DEFAULT 0;
ALTER TABLE conversation_participants ADD COLUMN is_muted BOOLEAN DEFAULT 0;
