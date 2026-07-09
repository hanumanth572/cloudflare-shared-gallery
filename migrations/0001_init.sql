-- Migration 0001: initial schema for Shared Gallery (PRD section 5)

-- images: one row per uploaded original
CREATE TABLE images (
  id              TEXT PRIMARY KEY,
  r2_key          TEXT NOT NULL UNIQUE,      -- key of the original object in R2
  original_name   TEXT NOT NULL,
  content_type    TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL,
  width           INTEGER,
  height          INTEGER,
  caption         TEXT,                      -- doubles as alt text
  uploaded_by     TEXT,                      -- self-declared display name, not an account
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

-- collections: virtual folders
CREATE TABLE collections (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  cover_image_id  TEXT REFERENCES images(id) ON DELETE SET NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT,                      -- self-declared display name
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

-- image_collections: many to many. An image can live in zero, one, or many collections.
CREATE TABLE image_collections (
  image_id        TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  collection_id   TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  added_by        TEXT,                      -- self-declared display name of who tagged it
  added_at        INTEGER NOT NULL,
  PRIMARY KEY (image_id, collection_id)
);

-- login_attempts: lightweight D1-backed throttle for the shared-password login
CREATE TABLE login_attempts (
  ip              TEXT NOT NULL,
  attempted_at    INTEGER NOT NULL
);

CREATE INDEX idx_ic_collection ON image_collections(collection_id);
CREATE INDEX idx_ic_image      ON image_collections(image_id);
CREATE INDEX idx_images_created ON images(created_at DESC);
CREATE INDEX idx_login_ip_time ON login_attempts(ip, attempted_at);
