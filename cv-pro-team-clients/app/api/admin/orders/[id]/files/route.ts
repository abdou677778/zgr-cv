import { ensureSchema, recordEvent, runtimeEnv } from '@/db/runtime';
import { requireAdmin } from '@/lib/admin-auth';
import {
  jsonResponse,
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

export async function POST(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  await ensureSchema();

  const { id } = await context.params;
  if (!(await getOrder(id))) {
    return jsonResponse({ error: 'Commande introuvable.' }, 404);
  }

  const formData = await request.formData();
  const candidate = formData.get('file');
  if (!(candidate instanceof File)) {
    return jsonResponse({ error: 'Aucun fichier valide reçu.' }, 400);
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
  if ((totals?.file_count ?? 0) >= MAX_ORDER_FILES) {
    return jsonResponse(
      { error: 'La limite de 50 fichiers par commande est atteinte.' },
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
  const category = 'AJOUT_MANUEL';
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
      source: 'admin-manual',
    },
  });

  try {
    await runtimeEnv()
      .DB.prepare(
        `INSERT INTO order_files (
          id, order_id, category, original_name, storage_key, mime_type,
          size_bytes, sha256, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        now,
      )
      .run();
  } catch (error) {
    await runtimeEnv().FILES.delete(storageKey);
    throw error;
  }

  await runtimeEnv()
    .DB.prepare("UPDATE orders SET updated_at = ?, drive_status = 'PENDING' WHERE id = ?")
    .bind(now, id)
    .run();
  await recordEvent(id, 'MANUAL_FILE_UPLOADED', {
    fileId,
    originalName,
    sizeBytes: candidate.size,
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
        createdAt: now,
      },
    },
    201,
  );
}
