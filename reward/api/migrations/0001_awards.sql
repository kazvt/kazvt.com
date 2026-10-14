CREATE TABLE IF NOT EXISTS awards (
  link_id TEXT PRIMARY KEY NOT NULL,
  asset_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  username_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  platform TEXT NOT NULL,
  event_id TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS awards_by_username_recent
  ON awards (username_key, issued_at DESC);
