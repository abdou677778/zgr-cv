import { z } from 'zod';

import { ensureSchema, recordEvent, runtimeEnv } from '@/db/runtime';
import {
  createOrderId,
  createOrderSchema,
  createSecretToken,
  jsonResponse,
  sha256Hex,
} from '@/lib/order-model';

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
    return jsonResponse(
      { error: 'Ce lien d’invitation est invalide, expiré ou déjà utilisé.' },
      403,
    );
  }

  await recordEvent(id, 'ORDER_CREATED', { services: input.services });

  return jsonResponse({ id, uploadToken, status: 'DRAFT' }, 201);
}
