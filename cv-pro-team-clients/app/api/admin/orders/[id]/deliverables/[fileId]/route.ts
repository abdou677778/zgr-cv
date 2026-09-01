import { requireAdmin } from '@/lib/admin-auth';
import { ensureSchema, runtimeEnv } from '@/db/runtime';
import { jsonResponse } from '@/lib/order-model';

interface RouteContext {
  params: Promise<{ id: string; fileId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  await ensureSchema();
  const { id: orderId, fileId } = await context.params;
  const row = await runtimeEnv()
    .DB.prepare(
      'SELECT original_name, storage_key, mime_type FROM deliverables WHERE id = ? AND order_id = ?',
    )
    .bind(fileId, orderId)
    .first<{ original_name: string; storage_key: string; mime_type: string }>();
  if (!row) return jsonResponse({ error: 'Livrable introuvable.' }, 404);
  const object = await runtimeEnv().FILES.get(row.storage_key);
  if (!object) return jsonResponse({ error: 'Fichier R2 introuvable.' }, 404);
  return new Response(object.body, {
    headers: {
      'Content-Type': row.mime_type || 'application/octet-stream',
      'Content-Length': String(object.size),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
