-- ============================================================
-- Social Pic — Supabase Schema
-- Pega TODO este contenido en el SQL Editor de Supabase
-- y presiona "Run" (▶)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  date          DATE NOT NULL,
  admin_pin     TEXT NOT NULL,
  extra_pins    TEXT[] DEFAULT '{}',
  description   TEXT,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  cover_url     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PHOTOS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS photos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  thumbnail_url TEXT,
  uploader_name TEXT DEFAULT 'Anónimo',
  caption       TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  likes_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS photos_event_id_idx ON photos(event_id);
CREATE INDEX IF NOT EXISTS photos_status_idx ON photos(status);
CREATE INDEX IF NOT EXISTS photos_created_at_idx ON photos(created_at DESC);

-- ============================================================
-- LIKES TABLE (evita duplicados por sesión)
-- ============================================================
CREATE TABLE IF NOT EXISTS likes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photo_id   UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(photo_id, session_id)
);

CREATE INDEX IF NOT EXISTS likes_photo_id_idx ON likes(photo_id);

-- ============================================================
-- TRIGGER: actualiza likes_count automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE photos SET likes_count = likes_count + 1 WHERE id = NEW.photo_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE photos SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.photo_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS likes_count_trigger ON likes;
CREATE TRIGGER likes_count_trigger
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_likes_count();

-- ============================================================
-- ROW LEVEL SECURITY
-- Política abierta para MVP (autenticación via PIN en app)
-- ============================================================

-- Events: cualquiera puede leer y crear (el PIN protege desde la app)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read events" ON events FOR SELECT USING (true);
CREATE POLICY "Anyone can create events" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update events" ON events FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete events" ON events FOR DELETE USING (true);

-- Photos: cualquiera puede leer, subir y actualizar (moderación desde app con PIN)
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read photos" ON photos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert photos" ON photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update photos" ON photos FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete photos" ON photos FOR DELETE USING (true);

-- Likes: acceso público completo
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read likes" ON likes FOR SELECT USING (true);
CREATE POLICY "Anyone can add likes" ON likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can remove likes" ON likes FOR DELETE USING (true);
