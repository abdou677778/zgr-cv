import { z } from 'zod';

import { ensureSchema, recordEvent, runtimeEnv } from '@/db/runtime';
import {
  createOrderId,
  createOrderSchema,
  createSecretToken,
  jsonResponse,
  sha256Hex,
} from '@/lib/order-model';
import { getOrder } from '@/lib/order-repository';

async function resumeLinkedOrder(
  orderId: string,
  invitationToken: string,
  input: z.infer<typeof createOrderSchema>,
) {
  const order = await getOrder(orderId);
  if (!order) return null;

  const now = new Date().toISOString();
  await runtimeEnv()
    .DB.prepare(
      `UPDATE orders
       SET client_name = ?, email = ?, phone = ?, language = ?, notes = ?,
           services_json = ?, drive_status = 'PENDING', updated_at = ?
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
      orderId,
    )
    .run();
  await recordEvent(orderId, 'ORDER_RESUMED_FROM_INVITATION', {
    reason: 'idempotent-create-retry',
  });
  return jsonResponse({
    id: orderId,
    // The invitation itself remains a valid scoped access token until expiry.
    uploadToken: invitationToken,
    status: order.status,
    resumed: true,
  });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Le formulaire envoyé est invalide.' }, 400);
  }

  const parsed = createOrderSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse(
      {
        error: 'Vérifiez les informations obligatoires.',
        details: z.treeifyError(parsed.error),
      },
      422,
    );
  }

  await ensureSchema();
  const id = createOrderId();
  const uploadToken = createSecretToken();
  const now = new Date().toISOString();
  const input = parsed.data;

  const tokenHash = await sha256Hex(input.invitationToken);
  const invitation = await runtimeEnv()
    .DB.prepare(
      `SELECT order_id
       FROM invitations
       WHERE token_hash = ? AND expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, now)
    .first<{ order_id: string | null }>();
  if (!invitation) {
    return jsonResponse(
      { error: 'Ce lien d’invitation est invalide ou expiré.' },
      403,
    );
  }
  if (invitation.order_id) {
    const resumed = await resumeLinkedOrder(
      invitation.order_id,
      input.invitationToken,
      input,
    );
    if (resumed) return resumed;
    return jsonResponse({ error: 'La commande associée est introuvable.' }, 404);
  }

  const results = await runtimeEnv().DB.batch([
    runtimeEnv()
      .DB.prepare(
        `INSERT INTO orders (
        id, upload_token_hash, client_name, email, phone, language, notes,
        services_json, status, created_at, updated_at, drive_status
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, 'PENDING'
      FROM invitations
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
      )
      .bind(
        id,
        await sha256Hex(uploadToken),
        input.clientName,
        input.email,
        input.phone,
        input.language,
        input.notes,
        JSON.stringify(input.services),
        now,
        now,
        tokenHash,
        now,
      ),
    runtimeEnv()
      .DB.prepare(
        'UPDATE invitations SET order_id = ?, used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
      )
      .bind(id, now, tokenHash, now),
  ]);
  if (!results[0].meta.changes) {
    // A concurrent request may have claimed the invitation between the lookup
    // and the batch. Resume that same order instead of rejecting the client.
    const claimed = await runtimeEnv()
      .DB.prepare(
        `SELECT order_id
         FROM invitations
         WHERE token_hash = ? AND expires_at > ? AND order_id IS NOT NULL
         LIMIT 1`,
      )
      .bind(tokenHash, now)
      .first<{ order_id: string }>();
    if (claimed?.order_id) {
      const resumed = await resumeLinkedOrder(
        claimed.order_id,
        input.invitationToken,
        input,
      );
      if (resumed) return resumed;
    }
    return jsonResponse(
      { error: 'Ce lien d’invitation est invalide ou expiré.' },
      403,
    );
  }

  await recordEvent(id, 'ORDER_CREATED', { services: input.services });

  return jsonResponse({ id, uploadToken, status: 'DRAFT' }, 201);
}
