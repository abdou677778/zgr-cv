CREATE TABLE IF NOT EXISTS client_profiles (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'fr',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  has_photo INTEGER NOT NULL DEFAULT 0 CHECK (has_photo IN (0, 1)),
  created_by_username TEXT,
  created_by_display_name TEXT,
  created_by_role TEXT,
  updated_by_username TEXT,
  updated_by_display_name TEXT,
  updated_by_role TEXT
);

CREATE INDEX IF NOT EXISTS client_profiles_updated_at_idx
  ON client_profiles(updated_at DESC);

CREATE INDEX IF NOT EXISTS client_profiles_name_idx
  ON client_profiles(name COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS client_profiles_email_idx
  ON client_profiles(email COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS client_profile_deletions (
  id TEXT PRIMARY KEY,
  deleted_at TEXT NOT NULL,
  deleted_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS client_profile_deletions_deleted_at_idx
  ON client_profile_deletions(deleted_at DESC);

CREATE TABLE IF NOT EXISTS system_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
