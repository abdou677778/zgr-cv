import { requireAdmin } from '@/lib/admin-auth';
import { jsonResponse } from '@/lib/order-model';
import {
  getJsonVersions,
  getOrder,
  getOrderEvents,
  getOrderFiles,
} from '@/lib/order-repository';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;

  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) return jsonResponse({ error: 'Commande introuvable.' }, 404);
  const [files, jsonVersions, events] = await Promise.all([
    getOrderFiles(id),
    getJsonVersions(id),
    getOrderEvents(id),
  ]);

  return jsonResponse({
    order,
    files: files.map(({ storageKey: _storageKey, ...file }) => file),
    jsonVersions: jsonVersions.map(
      ({ storageKey: _storageKey, ...version }) => version,
    ),
    events,
  });
}
