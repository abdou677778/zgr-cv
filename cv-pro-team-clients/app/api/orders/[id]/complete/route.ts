import { recordEvent, runtimeEnv } from '@/db/runtime';
import { driveConfigured, syncOrderToDrive } from '@/lib/google-drive';
import { jsonResponse } from '@/lib/order-model';
import {
  getOrder,
  getOrderFiles,
  validateUploadToken,
} from '@/lib/order-repository';

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
  if (order.status === 'RECEIVED')
    return jsonResponse({ id, status: order.status });
  if (order.status !== 'DRAFT') {
    return jsonResponse(
      { error: 'Cette commande ne peut plus être envoyée.' },
      409,
    );
  }

  const files = await getOrderFiles(id);
  if (files.length === 0) {
    return jsonResponse(
      { error: 'Ajoutez au moins un document avant l’envoi.' },
      422,
    );
  }

  const completedAt = new Date().toISOString();
  const manifest = {
    schemaVersion: 1,
    order: { ...order, status: 'RECEIVED', completedAt },
    files: files.map(({ storageKey: _storageKey, ...file }) => file),
  };
  const brief = [
    `COMMANDE : ${order.id}`,
    `CLIENT : ${order.clientName}`,
    `EMAIL : ${order.email}`,
    `TÉLÉPHONE : ${order.phone || 'Non renseigné'}`,
    `LANGUE : ${order.language}`,
    `SERVICES : ${order.services.join(', ')}`,
    '',
    'REMARQUES DU CLIENT',
    order.notes || 'Aucune remarque.',
  ].join('\n');

  await Promise.all([
    runtimeEnv().FILES.put(
      `orders/${id}/00_COMMANDE/commande.json`,
      JSON.stringify(manifest, null, 2),
      { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
    ),
    runtimeEnv().FILES.put(`orders/${id}/00_COMMANDE/brief-client.txt`, brief, {
      httpMetadata: { contentType: 'text/plain; charset=utf-8' },
    }),
  ]);

  await runtimeEnv()
    .DB.prepare(
      "UPDATE orders SET status = 'RECEIVED', completed_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(completedAt, completedAt, id)
    .run();
  await recordEvent(id, 'ORDER_COMPLETED', { fileCount: files.length });

  let driveStatus = 'PENDING';
  if (driveConfigured()) {
    try {
      await syncOrderToDrive(id);
      driveStatus = 'SYNCED';
    } catch {
      driveStatus = 'ERROR';
    }
  }

  return jsonResponse({ id, status: 'RECEIVED', completedAt, driveStatus });
}
