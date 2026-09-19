-- =========================================================
-- ORCA: 000001_init_schema.down.sql
-- Rollback initial schema
-- =========================================================

DROP TABLE IF EXISTS entity_links CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS note_blocks CASCADE;
DROP TABLE IF EXISTS note_boards CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS spaces CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;
