import { ensureSchema, runtimeEnv } from '@/db/runtime';
import { sha256Hex } from '@/lib/order-model';

export interface StoredOrder {
  id: string;
  clientName: string;
  email: string;
  phone: string;
  language: string;
  notes: string;
  services: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  currentJsonVersion?: number;
  driveFolderId?: string;
  driveStatus: string;
}

export interface StoredOrderFile {
  id: string;
  orderId: string;
  category: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

export interface StoredJsonVersion {
  id: string;
  orderId: string;
  versionNumber: number;
  storageKey: string;
  originalName: string;
  sha256: string;
  promptVersion: string;
  validation: unknown;
  createdAt: string;
}

export interface StoredDeliverable {
  id: string;
  orderId: string;
  service: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

export interface StoredDelivery {
  id: string;
  orderId: string;
  versionNumber: number;
  driveFolderId: string;
  shareUrl: string;
  fileIds: string[];
  createdAt: string;
}

type D1Row = Record<string, unknown>;

function textValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function mapOrder(row: D1Row): StoredOrder {
  return {
    id: String(row.id),
    clientName: String(row.client_name),
    email: String(row.email),
    phone: textValue(row.phone),
    language: textValue(row.language, 'fr'),
    notes: textValue(row.notes),
    services: JSON.parse(textValue(row.services_json, '[]')),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: textValue(row.completed_at) || undefined,
    currentJsonVersion:
      row.current_json_version === null ||
      row.current_json_version === undefined
        ? undefined
        : Number(row.current_json_version),
    driveFolderId: textValue(row.drive_folder_id) || undefined,
    driveStatus: textValue(row.drive_status, 'PENDING'),
  };
}

function mapFile(row: D1Row): StoredOrderFile {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    category: String(row.category),
    originalName: String(row.original_name),
    storageKey: String(row.storage_key),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    sha256: String(row.sha256),
    createdAt: String(row.created_at),
  };
}

function mapJsonVersion(row: D1Row): StoredJsonVersion {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    versionNumber: Number(row.version_number),
    storageKey: String(row.storage_key),
    originalName: String(row.original_name),
    sha256: String(row.sha256),
    promptVersion: String(row.prompt_version),
    validation: JSON.parse(textValue(row.validation_json, '{}')),
    createdAt: String(row.created_at),
  };
}

function mapDeliverable(row: D1Row): StoredDeliverable {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    service: textValue(row.service, 'AUTRE'),
    originalName: String(row.original_name),
    storageKey: String(row.storage_key),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    sha256: String(row.sha256),
    createdAt: String(row.created_at),
  };
}

function mapDelivery(row: D1Row): StoredDelivery {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    versionNumber: Number(row.version_number),
    driveFolderId: String(row.drive_folder_id),
    shareUrl: String(row.share_url),
    fileIds: JSON.parse(textValue(row.file_ids_json, '[]')),
    createdAt: String(row.created_at),
  };
}

export async function getOrder(id: string) {
  await ensureSchema();
  const row = await runtimeEnv()
    .DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(id)
    .first();
  return row ? mapOrder(row as D1Row) : null;
}

export async function getOrderFiles(orderId: string) {
  await ensureSchema();
  const result = await runtimeEnv()
    .DB.prepare(
      'SELECT * FROM order_files WHERE order_id = ? ORDER BY created_at ASC',
    )
    .bind(orderId)
    .all();
  return (result.results as D1Row[]).map(mapFile);
}

export async function getJsonVersions(orderId: string) {
  await ensureSchema();
  const result = await runtimeEnv()
    .DB.prepare(
      'SELECT * FROM json_versions WHERE order_id = ? ORDER BY version_number DESC',
    )
    .bind(orderId)
    .all();
  return (result.results as D1Row[]).map(mapJsonVersion);
}

export async function getOrderEvents(orderId: string) {
  await ensureSchema();
  const result = await runtimeEnv()
    .DB.prepare(
      'SELECT id, type, details_json, created_at FROM order_events WHERE order_id = ? ORDER BY created_at DESC',
    )
    .bind(orderId)
    .all();
  return (result.results as D1Row[]).map((row) => ({
    id: Number(row.id),
    type: String(row.type),
    details: JSON.parse(textValue(row.details_json, '{}')),
    createdAt: String(row.created_at),
  }));
}

export async function getDeliverables(orderId: string) {
  await ensureSchema();
  const result = await runtimeEnv()
    .DB.prepare('SELECT * FROM deliverables WHERE order_id = ? ORDER BY created_at DESC')
    .bind(orderId)
    .all();
  return (result.results as D1Row[]).map(mapDeliverable);
}

export async function getDeliveries(orderId: string) {
  await ensureSchema();
  const result = await runtimeEnv()
    .DB.prepare('SELECT * FROM deliveries WHERE order_id = ? ORDER BY version_number DESC')
    .bind(orderId)
    .all();
  return (result.results as D1Row[]).map(mapDelivery);
}

export async function validateUploadToken(
  orderId: string,
  token: string | null,
) {
  if (!token) return false;
  await ensureSchema();
  const row = await runtimeEnv()
    .DB.prepare('SELECT upload_token_hash FROM orders WHERE id = ?')
    .bind(orderId)
    .first<{ upload_token_hash: string }>();
  return Boolean(row && row.upload_token_hash === (await sha256Hex(token)));
}

export async function listOrders(limit = 200) {
  await ensureSchema();
  const result = await runtimeEnv()
    .DB.prepare(
      `SELECT o.*,
        COUNT(DISTINCT f.id) AS file_count,
        COALESCE(SUM(f.size_bytes), 0) AS total_bytes,
        COUNT(DISTINCT j.id) AS json_version_count
      FROM orders o
      LEFT JOIN order_files f ON f.order_id = o.id
      LEFT JOIN json_versions j ON j.order_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ?`,
    )
    .bind(limit)
    .all();
  return (result.results as D1Row[]).map((row) => ({
    ...mapOrder(row),
    fileCount: Number(row.file_count ?? 0),
    totalBytes: Number(row.total_bytes ?? 0),
    jsonVersionCount: Number(row.json_version_count ?? 0),
  }));
}
