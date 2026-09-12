ALTER TABLE client_profiles ADD COLUMN workflow_assignee_username TEXT;
ALTER TABLE client_profiles ADD COLUMN workflow_assignee_display_name TEXT;
ALTER TABLE client_profiles ADD COLUMN workflow_assignee_role TEXT;
ALTER TABLE client_profiles ADD COLUMN workflow_assigned_at TEXT;
ALTER TABLE client_profiles ADD COLUMN workflow_assigned_by_username TEXT;
ALTER TABLE client_profiles ADD COLUMN workflow_assigned_by_display_name TEXT;
ALTER TABLE client_profiles ADD COLUMN workflow_assigned_by_role TEXT;

CREATE INDEX IF NOT EXISTS client_profiles_workflow_assignee_idx
  ON client_profiles(workflow_status, workflow_assignee_username, updated_at DESC);
