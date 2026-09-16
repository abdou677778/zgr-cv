import { recordEvent, runtimeEnv } from '@/db/runtime';
import { jsonResponse } from '@/lib/order-model';
import { validateOrderAccess } from '@/lib/order-repository';

interface RouteContext {
  params: Promise<{ id: string; fileId: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id, fileId } = await context.params;
  if (!(await validateOrderAccess(id, request.headers.get('x-upload-token')))) {
    return jsonResponse({ error: 'Lien de dossier invalide ou expiré.' }, 401);
  }

  const file = await runtimeEnv()
    .DB.prepare(
      'SELECT original_name, storage_key FROM order_files WHERE id = ? AND order_id = ?',
    )
    .bind(fileId, id)
    .first<{ original_name: string; storage_key: string }>();
  if (!file) return jsonResponse({ error: 'Fichier introuvable.' }, 404);

  await runtimeEnv().FILES.delete(file.storage_key);
  await runtimeEnv()
    .DB.prepare('DELETE FROM order_files WHERE id = ? AND order_id = ?')
    .bind(fileId, id)
    .run();
  const now = new Date().toISOString();
  await runtimeEnv()
    .DB.prepare(
      `UPDATE orders
       SET status = CASE WHEN status = 'DRAFT' THEN status ELSE 'RECEIVED' END,
           drive_status = 'PENDING', updated_at = ?
       WHERE id = ?`,
    )
    .bind(now, id)
    .run();
  await recordEvent(id, 'FILE_DELETED_BY_CLIENT', {
    fileId,
    originalName: file.original_name,
  });
  return jsonResponse({ deleted: true });
}
