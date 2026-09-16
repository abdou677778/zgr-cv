import { ensureSchema, runtimeEnv } from '@/db/runtime';
import { jsonResponse, sha256Hex } from '@/lib/order-model';
import { getOrder, getOrderFiles } from '@/lib/order-repository';

export async function POST(request: Request) {
  let invitationToken = '';
  try {
    const payload = (await request.json()) as { invitationToken?: unknown };
    invitationToken =
      typeof payload.invitationToken === 'string' ? payload.invitationToken : '';
  } catch {
    return jsonResponse({ error: 'Le lien client est invalide.' }, 400);
  }
  if (invitationToken.length < 32 || invitationToken.length > 128) {
    return jsonResponse({ error: 'Le lien client est invalide.' }, 401);
  }

  await ensureSchema();
  const invitation = await runtimeEnv()
    .DB.prepare(
      `SELECT order_id, expires_at
       FROM invitations
       WHERE token_hash = ? AND expires_at > ?
       LIMIT 1`,
    )
    .bind(await sha256Hex(invitationToken), new Date().toISOString())
    .first<{ order_id: string | null; expires_at: string }>();
  if (!invitation) {
    return jsonResponse(
      { error: 'Ce lien client est invalide ou sa période de 5 jours est terminée.' },
      401,
    );
  }
  if (!invitation.order_id) {
    return jsonResponse({ state: 'NEW', expiresAt: invitation.expires_at });
  }

  const order = await getOrder(invitation.order_id);
  if (!order) {
    return jsonResponse({ error: 'La commande associée est introuvable.' }, 404);
  }
  const files = await getOrderFiles(order.id);
  return jsonResponse({
    state: 'EXISTING',
    expiresAt: invitation.expires_at,
    order,
    files: files.map(({ storageKey: _storageKey, ...file }) => file),
  });
}
