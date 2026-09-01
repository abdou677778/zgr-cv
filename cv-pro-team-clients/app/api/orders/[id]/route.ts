import { jsonResponse } from '@/lib/order-model';
import {
  getOrder,
  getOrderFiles,
  validateUploadToken,
} from '@/lib/order-repository';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!(await validateUploadToken(id, request.headers.get('x-upload-token')))) {
    return jsonResponse({ error: 'Lien de dossier invalide ou expiré.' }, 401);
  }

  const order = await getOrder(id);
  if (!order) return jsonResponse({ error: 'Commande introuvable.' }, 404);
  const files = await getOrderFiles(id);

  return jsonResponse({
    order,
    files: files.map(({ storageKey: _storageKey, ...file }) => file),
  });
}
