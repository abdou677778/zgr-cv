import { recordEvent, runtimeEnv } from '@/db/runtime';
import {
  acceptedExtensions,
  acceptedMimeTypes,
  fileCategoryIds,
  fileExtension,
  jsonResponse,
  MAX_FILE_BYTES,
  MAX_ORDER_BYTES,
  MAX_ORDER_FILES,
  safeFileName,
  sha256Hex,
} from '@/lib/order-model';
import { getOrder, validateUploadToken } from '@/lib/order-repository';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!(await validateUploadToken(id, request.headers.get('x-upload-token')))) {
    return jsonResponse({ error: 'Lien de dossier invalide ou expiré.' }, 401);
  }

  const order = await getOrder(id);
  if (!order) return jsonResponse({ error: 'Commande introuvable.' }, 404);
  if (order.status !== 'DRAFT') {
    return jsonResponse({ error: 'Cette commande a déjà été envoyée.' }, 409);
  }

  const requestType = request.headers.get('content-type') || '';
  let originalName = '';
  let mimeType = requestType.split(';', 1)[0] || 'application/octet-stream';
  let category = request.headers.get('x-file-category') || 'AUTRES';
  let bytes: ArrayBuffer;

  if (requestType.startsWith('multipart/form-data')) {
    const formData = await request.formData();
    const candidate = formData.get('file');
    const categoryValue = formData.get('category');
    category = typeof categoryValue === 'string' ? categoryValue : 'AUTRES';
    if (!(candidate instanceof File)) {
      return jsonResponse({ error: 'Aucun fichier valide reçu.' }, 400);
    }
    originalName = candidate.name;
    mimeType = candidate.type || 'application/octet-stream';
    bytes = await candidate.arrayBuffer();
  } else {
    const encodedName = request.headers.get('x-file-name');
    if (!encodedName)
      return jsonResponse({ error: 'Le nom du fichier est absent.' }, 400);
    try {
      originalName = decodeURIComponent(encodedName);
    } catch {
      return jsonResponse({ error: 'Le nom du fichier est invalide.' }, 400);
    }
    const declaredSize = Number(request.headers.get('content-length') || 0);
    if (declaredSize > MAX_FILE_BYTES) {
      return jsonResponse(
        { error: 'Le fichier dépasse la limite de 100 Mo.' },
        413,
      );
    }
    bytes = await request.arrayBuffer();
  }

  const fileSize = bytes.byteLength;
  if (!fileCategoryIds.includes(category as (typeof fileCategoryIds)[number])) {
    return jsonResponse({ error: 'Catégorie de fichier inconnue.' }, 422);
  }
  if (fileSize <= 0 || fileSize > MAX_FILE_BYTES) {
    return jsonResponse(
      { error: 'Le fichier doit être compris entre 1 octet et 100 Mo.' },
      413,
    );
  }

  const extension = fileExtension(originalName);
  if (
    !acceptedExtensions.has(extension) ||
    (mimeType !== 'application/octet-stream' &&
      !acceptedMimeTypes.has(mimeType))
  ) {
    return jsonResponse(
      { error: 'Ce format de fichier n’est pas accepté.' },
      415,
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
  if ((totals?.total_bytes ?? 0) + fileSize > MAX_ORDER_BYTES) {
    return jsonResponse(
      { error: 'La taille totale de la commande dépasse 500 Mo.' },
      413,
    );
  }

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
  const storageKey = `orders/${id}/01_DOCUMENTS_SOURCES/${category}/${fileId}__${safeFileName(originalName)}`;
  const now = new Date().toISOString();
  await runtimeEnv().FILES.put(storageKey, bytes, {
    httpMetadata: { contentType: mimeType },
    customMetadata: {
      orderId: id,
      category,
      originalName,
      sha256,
      createdAt: now,
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
        fileSize,
        sha256,
        now,
      )
      .run();
  } catch (error) {
    await runtimeEnv().FILES.delete(storageKey);
    throw error;
  }

  await recordEvent(id, 'FILE_UPLOADED', {
    fileId,
    category,
    originalName,
    sizeBytes: fileSize,
  });

  return jsonResponse(
    {
      file: {
        id: fileId,
        category,
        originalName,
        mimeType,
        sizeBytes: fileSize,
        sha256,
        createdAt: now,
      },
    },
    201,
  );
}
