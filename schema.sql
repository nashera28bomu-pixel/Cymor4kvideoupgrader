-- ═══════════════════════════════════════════════════════
-- RUMION NOVEL HUB — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── USERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader','author','admin')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── GENRES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS genres (
  id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name  TEXT UNIQUE NOT NULL,
  slug  TEXT UNIQUE NOT NULL
);

-- Seed default genres
INSERT INTO genres (name, slug) VALUES
  ('Romance',    'romance'),
  ('Mystery',    'mystery'),
  ('Fantasy',    'fantasy'),
  ('Drama',      'drama'),
  ('Historical', 'historical'),
  ('Adventure',  'adventure'),
  ('Thriller',   'thriller'),
  ('Classics',   'classics'),
  ('Horror',     'horror'),
  ('Comedy',     'comedy')
ON CONFLICT DO NOTHING;

-- ── NOVELS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS novels (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             TEXT NOT NULL,
  description       TEXT,
  cover_image       TEXT,
  author_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  source            TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','api')),
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected')),
  featured          BOOLEAN DEFAULT FALSE,
  gutenberg_id      INTEGER,
  gutenberg_author  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── NOVEL_GENRES (junction) ────────────────────────────
CREATE TABLE IF NOT EXISTS novel_genres (
  novel_id  UUID REFERENCES novels(id)  ON DELETE CASCADE,
  genre_id  UUID REFERENCES genres(id)  ON DELETE CASCADE,
  PRIMARY KEY (novel_id, genre_id)
);

-- ── CHAPTERS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chapters (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id       UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  content        TEXT NOT NULL DEFAULT '',
  chapter_number INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── APPROVALS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approvals (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id   UUID REFERENCES novels(id) ON DELETE CASCADE,
  admin_id   UUID REFERENCES users(id)  ON DELETE SET NULL,
  status     TEXT NOT NULL CHECK (status IN ('approved','rejected')),
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── BOOKMARKS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookmarks (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  novel_id              UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  last_read_chapter_id  UUID REFERENCES chapters(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, novel_id)
);

-- ── READING_PROGRESS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS reading_progress (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  novel_id        UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id      UUID REFERENCES chapters(id) ON DELETE SET NULL,
  scroll_position INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, novel_id)
);

-- ── INDEXES ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_novels_status   ON novels(status);
CREATE INDEX IF NOT EXISTS idx_novels_featured ON novels(featured);
CREATE INDEX IF NOT EXISTS idx_novels_author   ON novels(author_id);
CREATE INDEX IF NOT EXISTS idx_chapters_novel  ON chapters(novel_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user  ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user   ON reading_progress(user_id);

-- ── ROW LEVEL SECURITY (RLS) ──────────────────────────
-- Enable RLS on all tables
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE novels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters         ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres           ENABLE ROW LEVEL SECURITY;
ALTER TABLE novel_genres     ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;

-- Allow service role (backend) full access — all queries go via backend
-- These policies allow the service_role key used by the backend to bypass RLS
CREATE POLICY "service_role_all" ON users            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON novels           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON chapters         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON genres           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON novel_genres     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON approvals        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON bookmarks        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON reading_progress FOR ALL TO service_role USING (true) WITH CHECK (true);
