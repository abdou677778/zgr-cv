import { requireAdmin } from '@/lib/admin-auth';
import { ensureSchema, recordEvent, runtimeEnv } from '@/db/runtime';
import { jsonResponse, safeFileName, sha256Hex } from '@/lib/order-model';
import { getOrder } from '@/lib/order-repository';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MAX_DELIVERABLE_BYTES = 25_000_000;

export async function POST(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  await ensureSchema();

  const { id: orderId } = await context.params;
  if (!(await getOrder(orderId)))
    return jsonResponse({ error: 'Commande introuvable.' }, 404);

  const formData = await request.formData();
  const candidate = formData.get('file');
  const serviceValue = formData.get('service');
  const service =
    typeof serviceValue === 'string' && serviceValue.trim()
      ? safeFileName(serviceValue).slice(0, 60)
      : 'AUTRE';
  if (!(candidate instanceof File))
    return jsonResponse({ error: 'Sélectionnez un livrable.' }, 400);
  if (candidate.size <= 0 || candidate.size > MAX_DELIVERABLE_BYTES)
    return jsonResponse({ error: 'Chaque livrable doit être inférieur à 25 Mo.' }, 413);

  const id = crypto.randomUUID();
  const originalName = safeFileName(candidate.name);
  const storageKey = `orders/${orderId}/03_PRODUCTION/LIVRABLES/${id}__${originalName}`;
  const bytes = await candidate.arrayBuffer();
  const sha256 = await sha256Hex(bytes);
  const mimeType = candidate.type || 'application/octet-stream';
  const createdAt = new Date().toISOString();

  await runtimeEnv().FILES.put(storageKey, bytes, {
    httpMetadata: { contentType: mimeType },
    customMetadata: { orderId, deliverableId: id, service, sha256 },
  });
  try {
    await runtimeEnv().DB.batch([
      runtimeEnv().DB.prepare(
        `INSERT INTO deliverables (
          id, order_id, service, original_name, storage_key, mime_type,
          size_bytes, sha256, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        id,
        orderId,
        service,
        originalName,
        storageKey,
        mimeType,
        candidate.size,
        sha256,
        createdAt,
      ),
      runtimeEnv()
        .DB.prepare("UPDATE orders SET status = 'IN_PRODUCTION', updated_at = ? WHERE id = ?")
        .bind(createdAt, orderId),
    ]);
  } catch (error) {
    await runtimeEnv().FILES.delete(storageKey);
    throw error;
  }
  await recordEvent(orderId, 'DELIVERABLE_ADDED', {
    deliverableId: id,
    originalName,
    service,
    sizeBytes: candidate.size,
  });
  return jsonResponse(
    {
      deliverable: {
        id,
        orderId,
        service,
        originalName,
        mimeType,
        sizeBytes: candidate.size,
        sha256,
        createdAt,
      },
    },
    201,
  );
}
