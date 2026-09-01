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

  const { id, fileId } = await context.params;
  const file = await runtimeEnv()
    .DB.prepare(
      'SELECT original_name, storage_key, mime_type FROM order_files WHERE id = ? AND order_id = ?',
    )
    .bind(fileId, id)
    .first<{ original_name: string; storage_key: string; mime_type: string }>();
  if (!file) return jsonResponse({ error: 'Fichier introuvable.' }, 404);

  const object = await runtimeEnv().FILES.get(file.storage_key);
  if (!object)
    return jsonResponse({ error: 'Le fichier stocké est introuvable.' }, 404);
  return new Response(object.body, {
    headers: {
      'Content-Type': file.mime_type || 'application/octet-stream',
      'Content-Length': String(object.size),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
