import { ensureSchema, recordEvent, runtimeEnv } from '@/db/runtime';
import { requireAdmin } from '@/lib/admin-auth';
import {
  jsonResponse,
  MAX_ARCHIVE_FILES,
  MAX_FILE_BYTES,
  MAX_ORDER_BYTES,
  MAX_ORDER_FILES,
  safeFileName,
  sha256Hex,
} from '@/lib/order-model';
import { getOrder } from '@/lib/order-repository';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const archiveCategories = new Set([
  'CAPTURE_FACEBOOK',
  'INFOS_CLIENT',
  'LIVRABLE_HISTORIQUE',
  'AUTRES_ARCHIVES',
]);

function normalizedSourceDate(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const date = new Date(value);
  const earliest = Date.UTC(1980, 0, 1);
  const latest = Date.now() + 24 * 60 * 60 * 1000;
  if (
    Number.isNaN(date.getTime()) ||
    date.getTime() < earliest ||
    date.getTime() > latest
  ) {
    return null;
  }
  return date.toISOString();
}

function normalizedRelativePath(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return '';
  const segments = value
    .replaceAll('\\', '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (
    !segments.length ||
    segments.some((segment) => segment === '.' || segment === '..')
  ) {
    return segments.length ? null : '';
  }
  const normalized = segments.join('/');
  return normalized.length <= 600 ? normalized : null;
}

export async function POST(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  await ensureSchema();

  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) {
    return jsonResponse({ error: 'Commande introuvable.' }, 404);
  }

  const formData = await request.formData();
  const candidate = formData.get('file');
  if (!(candidate instanceof File)) {
    return jsonResponse({ error: 'Aucun fichier valide reçu.' }, 400);
  }
  const categoryValue = formData.get('category');
  const requestedCategory =
    typeof categoryValue === 'string' && categoryValue.trim()
      ? categoryValue.trim()
      : 'AJOUT_MANUEL';
  const category =
    order.status === 'ARCHIVED' && archiveCategories.has(requestedCategory)
      ? requestedCategory
      : 'AJOUT_MANUEL';
  const sourceModifiedAt = normalizedSourceDate(
    formData.get('sourceModifiedAt'),
  );
  const sourceRelativePath = normalizedRelativePath(
    formData.get('sourceRelativePath'),
  );
  if (sourceModifiedAt === null || sourceRelativePath === null) {
    return jsonResponse(
      { error: "La date ou le chemin d'origine du fichier est invalide." },
      422,
    );
  }
  if (candidate.size <= 0 || candidate.size > MAX_FILE_BYTES) {
    return jsonResponse(
      { error: 'Le fichier doit être compris entre 1 octet et 100 Mo.' },
      413,
    );
  }

  const totals = await runtimeEnv()
    .DB.prepare(
      'SELECT COUNT(*) AS file_count, COALESCE(SUM(size_bytes), 0) AS total_bytes FROM order_files WHERE order_id = ?',
    )
    .bind(id)
    .first<{ file_count: number; total_bytes: number }>();
  const fileLimit =
    order.status === 'ARCHIVED' ? MAX_ARCHIVE_FILES : MAX_ORDER_FILES;
  if ((totals?.file_count ?? 0) >= fileLimit) {
    return jsonResponse(
      {
        error: `La limite de ${fileLimit} fichiers par commande est atteinte.`,
      },
      413,
    );
  }
  if ((totals?.total_bytes ?? 0) + candidate.size > MAX_ORDER_BYTES) {
    return jsonResponse(
      { error: 'La taille totale de la commande dépasse 500 Mo.' },
      413,
    );
  }

  const bytes = await candidate.arrayBuffer();
  const sha256 = await sha256Hex(bytes);
  const duplicate = await runtimeEnv()
    .DB.prepare('SELECT id FROM order_files WHERE order_id = ? AND sha256 = ?')
    .bind(id, sha256)
    .first();
  if (duplicate) {
    return jsonResponse(
      { error: 'Ce fichier a déjà été ajouté à la commande.' },
      409,
    );
  }

  const fileId = crypto.randomUUID();
  const originalName = candidate.name || 'document';
  const mimeType = candidate.type || 'application/octet-stream';
  const now = new Date().toISOString();
  const storageKey = `orders/${id}/01_DOCUMENTS_SOURCES/${category}/${fileId}__${safeFileName(originalName)}`;

  await runtimeEnv().FILES.put(storageKey, bytes, {
    httpMetadata: { contentType: mimeType },
    customMetadata: {
      orderId: id,
      category,
      originalName,
      sha256,
      createdAt: now,
      ...(sourceModifiedAt ? { sourceModifiedAt } : {}),
      ...(sourceRelativePath ? { sourceRelativePath } : {}),
      source: 'admin-manual',
    },
  });

  try {
    await runtimeEnv()
      .DB.prepare(
        `INSERT INTO order_files (
          id, order_id, category, original_name, storage_key, mime_type,
          size_bytes, sha256, source_modified_at, source_relative_path, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        fileId,
        id,
        category,
        originalName,
        storageKey,
        mimeType,
        candidate.size,
        sha256,
        sourceModifiedAt ?? null,
        sourceRelativePath,
        now,
      )
      .run();
  } catch (error) {
    await runtimeEnv().FILES.delete(storageKey);
    throw error;
  }

  await runtimeEnv()
    .DB.prepare(
      "UPDATE orders SET updated_at = ?, drive_status = 'PENDING' WHERE id = ?",
    )
    .bind(now, id)
    .run();
  await recordEvent(id, 'MANUAL_FILE_UPLOADED', {
    fileId,
    originalName,
    sizeBytes: candidate.size,
    category,
    sourceModifiedAt: sourceModifiedAt ?? null,
    sourceRelativePath,
  });

  return jsonResponse(
    {
      file: {
        id: fileId,
        orderId: id,
        category,
        originalName,
        mimeType,
        sizeBytes: candidate.size,
        sha256,
        sourceModifiedAt,
        sourceRelativePath,
        createdAt: now,
      },
    },
    201,
  );
}
