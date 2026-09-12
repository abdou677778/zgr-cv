CREATE TABLE IF NOT EXISTS operational_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('web_vital', 'javascript_error', 'api_failure', 'sync_failure')),
  name TEXT NOT NULL,
  value REAL,
  rating TEXT NOT NULL CHECK (rating IN ('good', 'needs-improvement', 'poor', 'error')),
  status INTEGER,
  route TEXT,
  build_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS operational_events_created_at_idx
  ON operational_events(created_at DESC);

CREATE INDEX IF NOT EXISTS operational_events_kind_name_idx
  ON operational_events(kind, name, created_at DESC);
