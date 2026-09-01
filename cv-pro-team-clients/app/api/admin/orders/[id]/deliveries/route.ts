import { requireAdmin } from '@/lib/admin-auth';
import { ensureSchema, recordEvent, runtimeEnv } from '@/db/runtime';
import { publishDeliveryToDrive } from '@/lib/google-drive';
import { jsonResponse } from '@/lib/order-model';
import { getDeliverables, getOrder } from '@/lib/order-repository';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  await ensureSchema();
  const { id: orderId } = await context.params;
  if (!(await getOrder(orderId)))
    return jsonResponse({ error: 'Commande introuvable.' }, 404);

  const payload = (await request.json().catch(() => ({}))) as { fileIds?: unknown };
  const fileIds = Array.isArray(payload.fileIds)
    ? [...new Set(payload.fileIds.filter((value): value is string => typeof value === 'string'))]
    : [];
  if (!fileIds.length)
    return jsonResponse({ error: 'Sélectionnez au moins un livrable.' }, 400);
  if (fileIds.length > 30)
    return jsonResponse({ error: 'Une livraison peut contenir au maximum 30 fichiers.' }, 400);

  const available = await getDeliverables(orderId);
  const selected = fileIds
    .map((fileId) => available.find((item) => item.id === fileId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (selected.length !== fileIds.length)
    return jsonResponse({ error: 'Un ou plusieurs livrables sont invalides.' }, 400);

  const previous = await runtimeEnv()
    .DB.prepare(
      'SELECT COALESCE(MAX(version_number), 0) AS version FROM deliveries WHERE order_id = ?',
    )
    .bind(orderId)
    .first<{ version: number }>();
  const versionNumber = Number(previous?.version ?? 0) + 1;
  const published = await publishDeliveryToDrive({
    orderId,
    versionNumber,
    deliverables: selected,
  });
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await runtimeEnv().DB.batch([
    runtimeEnv()
      .DB.prepare(
        `INSERT INTO deliveries (
          id, order_id, version_number, drive_folder_id, share_url,
          file_ids_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        orderId,
        versionNumber,
        published.driveFolderId,
        published.shareUrl,
        JSON.stringify(fileIds),
        createdAt,
      ),
    runtimeEnv()
      .DB.prepare("UPDATE orders SET status = 'DELIVERED', updated_at = ? WHERE id = ?")
      .bind(createdAt, orderId),
  ]);
  await recordEvent(orderId, 'DELIVERY_PUBLISHED', {
    deliveryId: id,
    versionNumber,
    fileCount: selected.length,
    driveFolderId: published.driveFolderId,
  });
  return jsonResponse(
    {
      delivery: {
        id,
        orderId,
        versionNumber,
        driveFolderId: published.driveFolderId,
        shareUrl: published.shareUrl,
        fileIds,
        createdAt,
      },
    },
    201,
  );
}
