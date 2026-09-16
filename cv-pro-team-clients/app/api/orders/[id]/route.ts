import { z } from 'zod';

import { recordEvent, runtimeEnv } from '@/db/runtime';
import { jsonResponse, orderDetailsSchema } from '@/lib/order-model';
import {
  getOrder,
  getOrderFiles,
  validateOrderAccess,
} from '@/lib/order-repository';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!(await validateOrderAccess(id, request.headers.get('x-upload-token')))) {
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

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!(await validateOrderAccess(id, request.headers.get('x-upload-token')))) {
    return jsonResponse({ error: 'Lien de dossier invalide ou expiré.' }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Les informations envoyées sont invalides.' }, 400);
  }
  const parsed = orderDetailsSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse(
      {
        error: 'Vérifiez les informations obligatoires.',
        details: z.treeifyError(parsed.error),
      },
      422,
    );
  }

  const order = await getOrder(id);
  if (!order) return jsonResponse({ error: 'Commande introuvable.' }, 404);
  const input = parsed.data;
  const now = new Date().toISOString();
  await runtimeEnv()
    .DB.prepare(
      `UPDATE orders
       SET client_name = ?, email = ?, phone = ?, language = ?, notes = ?,
           services_json = ?, status = CASE WHEN status = 'DRAFT' THEN status ELSE 'RECEIVED' END,
           drive_status = 'PENDING', updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.clientName,
      input.email,
      input.phone,
      input.language,
      input.notes,
      JSON.stringify(input.services),
      now,
      id,
    )
    .run();
  await recordEvent(id, 'ORDER_UPDATED_BY_CLIENT', {
    fields: ['clientName', 'email', 'phone', 'language', 'notes', 'services'],
  });
  return jsonResponse({ order: await getOrder(id) });
}
