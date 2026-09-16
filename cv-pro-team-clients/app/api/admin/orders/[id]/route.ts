import { z } from 'zod';

import { requireAdmin } from '@/lib/admin-auth';
import { recordEvent, runtimeEnv } from '@/db/runtime';
import { trashDriveFolder } from '@/lib/google-drive';
import { jsonResponse, orderDetailsSchema } from '@/lib/order-model';
import {
  getJsonVersions,
  getDeliverables,
  getDeliveries,
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
  const [files, jsonVersions, deliverables, deliveries, events] = await Promise.all([
    getOrderFiles(id),
    getJsonVersions(id),
    getDeliverables(id),
    getDeliveries(id),
    getOrderEvents(id),
  ]);

  return jsonResponse({
    order,
    files: files.map(({ storageKey: _storageKey, ...file }) => file),
    jsonVersions: jsonVersions.map(
      ({ storageKey: _storageKey, ...version }) => version,
    ),
    deliverables: deliverables.map(
      ({ storageKey: _storageKey, ...deliverable }) => deliverable,
    ),
    deliveries,
    events,
  });
}

function normalizedFacebookUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return '';
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      !(
        host === 'facebook.com' ||
        host.endsWith('.facebook.com') ||
        host === 'fb.com' ||
        host.endsWith('.fb.com')
      )
    ) {
      return null;
    }
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;

  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) return jsonResponse({ error: 'Commande introuvable.' }, 404);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Les informations envoyées sont invalides.' }, 400);
  }
  const parsed = orderDetailsSchema
    .partial()
    .extend({ facebookUrl: z.string().trim().max(500).optional() })
    .safeParse(payload);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return jsonResponse({ error: 'Aucune modification valide reçue.' }, 422);
  }
  const facebookUrl =
    parsed.data.facebookUrl === undefined
      ? order.facebookUrl
      : normalizedFacebookUrl(parsed.data.facebookUrl);
  if (facebookUrl === null) {
    return jsonResponse(
      { error: 'Saisissez un lien Facebook valide et sécurisé (https).' },
      422,
    );
  }

  const updated = {
    clientName: parsed.data.clientName ?? order.clientName,
    email: parsed.data.email ?? order.email,
    phone: parsed.data.phone ?? order.phone,
    language: parsed.data.language ?? order.language,
    notes: parsed.data.notes ?? order.notes,
    services: parsed.data.services ?? order.services,
    facebookUrl,
  };
  const now = new Date().toISOString();
  await runtimeEnv()
    .DB.prepare(
      `UPDATE orders
       SET client_name = ?, email = ?, phone = ?, language = ?, notes = ?,
           services_json = ?, facebook_url = ?, drive_status = 'PENDING', updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      updated.clientName,
      updated.email,
      updated.phone,
      updated.language,
      updated.notes,
      JSON.stringify(updated.services),
      updated.facebookUrl,
      now,
      id,
    )
    .run();
  await recordEvent(id, 'CLIENT_DETAILS_UPDATED', {
    fields: Object.keys(parsed.data),
  });

  return jsonResponse({ order: await getOrder(id), updatedAt: now });
}

async function deleteOrderObjects(orderId: string) {
  const bucket = runtimeEnv().FILES;
  const prefix = `orders/${orderId}/`;
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const listed = await bucket.list({ prefix, ...(cursor ? { cursor } : {}) });
    const keys = listed.objects.map((object) => object.key);
    if (keys.length) {
      await bucket.delete(keys);
      deleted += keys.length;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return deleted;
}

export async function DELETE(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;

  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) return jsonResponse({ error: 'Commande introuvable.' }, 404);

  // Trash the external folder first. If Google refuses, the database and R2
  // remain intact and the administrator can retry safely.
  if (order.driveFolderId) {
    try {
      await trashDriveFolder(order.driveFolderId);
    } catch (error) {
      return jsonResponse(
        {
          error: `Suppression annulée : le dossier Google Drive n’a pas pu être placé dans la corbeille. ${
            error instanceof Error ? error.message : ''
          }`.trim(),
        },
        502,
      );
    }
  }

  await runtimeEnv().DB.batch([
    runtimeEnv()
      .DB.prepare('DELETE FROM invitations WHERE order_id = ?')
      .bind(id),
    runtimeEnv().DB.prepare('DELETE FROM orders WHERE id = ?').bind(id),
  ]);
  let deletedObjects = 0;
  let storageCleanupPending = false;
  try {
    deletedObjects = await deleteOrderObjects(id);
  } catch {
    // The business record is already deleted. Do not report a false failure to
    // the administrator; orphaned private objects can be cleaned up separately.
    storageCleanupPending = true;
  }
  return jsonResponse({ deleted: true, deletedObjects, storageCleanupPending });
}
