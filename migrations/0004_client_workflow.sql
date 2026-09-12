ALTER TABLE client_profiles ADD COLUMN workflow_status TEXT NOT NULL DEFAULT 'draft'
  CHECK (workflow_status IN ('draft', 'review', 'approved'));
ALTER TABLE client_profiles ADD COLUMN workflow_updated_at TEXT;
ALTER TABLE client_profiles ADD COLUMN workflow_updated_by_username TEXT;
ALTER TABLE client_profiles ADD COLUMN workflow_updated_by_display_name TEXT;
ALTER TABLE client_profiles ADD COLUMN workflow_updated_by_role TEXT;

CREATE INDEX IF NOT EXISTS client_profiles_workflow_status_idx
  ON client_profiles(workflow_status, updated_at DESC);
