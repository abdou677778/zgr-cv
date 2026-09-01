import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    uploadTokenHash: text('upload_token_hash').notNull(),
    clientName: text('client_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull().default(''),
    language: text('language').notNull().default('fr'),
    notes: text('notes').notNull().default(''),
    servicesJson: text('services_json').notNull(),
    status: text('status').notNull().default('DRAFT'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    completedAt: text('completed_at'),
    currentJsonVersion: integer('current_json_version'),
    driveFolderId: text('drive_folder_id'),
    driveStatus: text('drive_status').notNull().default('PENDING'),
  },
  (table) => [
    index('idx_orders_created_at').on(table.createdAt),
    index('idx_orders_status_created_at').on(table.status, table.createdAt),
    index('idx_orders_email_created_at').on(table.email, table.createdAt),
  ],
);

export const orderFiles = sqliteTable(
  'order_files',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    originalName: text('original_name').notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_order_files_storage_key').on(table.storageKey),
    index('idx_order_files_order_id').on(table.orderId),
  ],
);

export const jsonVersions = sqliteTable(
  'json_versions',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    storageKey: text('storage_key').notNull(),
    originalName: text('original_name').notNull(),
    sha256: text('sha256').notNull(),
    promptVersion: text('prompt_version').notNull(),
    validationJson: text('validation_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_json_versions_order_version').on(
      table.orderId,
      table.versionNumber,
    ),
    index('idx_json_versions_order_id').on(table.orderId),
  ],
);

export const orderEvents = sqliteTable(
  'order_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    detailsJson: text('details_json').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_order_events_order_created').on(table.orderId, table.createdAt),
  ],
);

export const invitations = sqliteTable(
  'invitations',
  {
    id: text('id').primaryKey(),
    tokenHash: text('token_hash').notNull(),
    orderId: text('order_id'),
    expiresAt: text('expires_at').notNull(),
    usedAt: text('used_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_invitations_token_hash').on(table.tokenHash),
    index('idx_invitations_expires_at').on(table.expiresAt),
    index('idx_invitations_order_id').on(table.orderId),
  ],
);

export const deliverables = sqliteTable(
  'deliverables',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    service: text('service').notNull().default('AUTRE'),
    originalName: text('original_name').notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_deliverables_storage_key').on(table.storageKey),
    index('idx_deliverables_order_created').on(table.orderId, table.createdAt),
  ],
);

export const deliveries = sqliteTable(
  'deliveries',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    driveFolderId: text('drive_folder_id').notNull(),
    shareUrl: text('share_url').notNull(),
    fileIdsJson: text('file_ids_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_deliveries_order_version').on(table.orderId, table.versionNumber),
    index('idx_deliveries_order_created').on(table.orderId, table.createdAt),
  ],
);
