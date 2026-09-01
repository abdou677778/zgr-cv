import { env } from 'cloudflare:workers';

const statements = [
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY NOT NULL,
    upload_token_hash TEXT NOT NULL,
    client_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'fr',
    notes TEXT NOT NULL DEFAULT '',
    services_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    current_json_version INTEGER,
    drive_folder_id TEXT,
    drive_status TEXT NOT NULL DEFAULT 'PENDING'
  )`,
  `CREATE TABLE IF NOT EXISTS order_files (
    id TEXT PRIMARY KEY NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    original_name TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS json_versions (
    id TEXT PRIMARY KEY NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    storage_key TEXT NOT NULL,
    original_name TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    validation_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS order_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY NOT NULL,
    token_hash TEXT NOT NULL,
    order_id TEXT,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at)',
  'CREATE INDEX IF NOT EXISTS idx_orders_email_created_at ON orders(email, created_at)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_order_files_storage_key ON order_files(storage_key)',
  'CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON order_files(order_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_json_versions_order_version ON json_versions(order_id, version_number)',
  'CREATE INDEX IF NOT EXISTS idx_json_versions_order_id ON json_versions(order_id)',
  'CREATE INDEX IF NOT EXISTS idx_order_events_order_created ON order_events(order_id, created_at)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash)',
  'CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_invitations_order_id ON invitations(order_id)',
];

let schemaPromise: Promise<void> | undefined;

export function runtimeEnv() {
  return env as Cloudflare.Env & {
    ADMIN_API_TOKEN?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REFRESH_TOKEN?: string;
    GOOGLE_DRIVE_ROOT_FOLDER_ID?: string;
  };
}

export function ensureSchema() {
  const currentEnv = runtimeEnv();
  if (!currentEnv.DB) throw new Error('La base D1 DB est indisponible.');
  schemaPromise ??= currentEnv.DB.batch(
    statements.map((statement) => currentEnv.DB.prepare(statement)),
  ).then(() => undefined);
  return schemaPromise;
}

export async function recordEvent(
  orderId: string,
  type: string,
  details: Record<string, unknown> = {},
) {
  await ensureSchema();
  const now = new Date().toISOString();
  await runtimeEnv()
    .DB.prepare(
      'INSERT INTO order_events (order_id, type, details_json, created_at) VALUES (?, ?, ?, ?)',
    )
    .bind(orderId, type, JSON.stringify(details), now)
    .run();
}
