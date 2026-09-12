import { requireAdmin } from '@/lib/admin-auth';
import { ensureSchema, recordEvent, runtimeEnv } from '@/db/runtime';
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

export async function DELETE(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  await ensureSchema();

  const { id, fileId } = await context.params;
  const file = await runtimeEnv()
    .DB.prepare(
      'SELECT original_name, storage_key, category FROM order_files WHERE id = ? AND order_id = ?',
    )
    .bind(fileId, id)
    .first<{ original_name: string; storage_key: string; category: string }>();
  if (!file) return jsonResponse({ error: 'Fichier introuvable.' }, 404);
  if (file.category !== 'AJOUT_MANUEL') {
    return jsonResponse(
      { error: 'Seuls les fichiers ajoutés manuellement peuvent être supprimés ici.' },
      409,
    );
  }

  await runtimeEnv().FILES.delete(file.storage_key);
  await runtimeEnv()
    .DB.prepare('DELETE FROM order_files WHERE id = ? AND order_id = ?')
    .bind(fileId, id)
    .run();
  const now = new Date().toISOString();
  await runtimeEnv()
    .DB.prepare("UPDATE orders SET updated_at = ?, drive_status = 'PENDING' WHERE id = ?")
    .bind(now, id)
    .run();
  await recordEvent(id, 'MANUAL_FILE_DELETED', {
    fileId,
    originalName: file.original_name,
  });

  return jsonResponse({ deleted: true });
}
