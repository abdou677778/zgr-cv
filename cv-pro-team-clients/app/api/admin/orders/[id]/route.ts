import { requireAdmin } from '@/lib/admin-auth';
import { recordEvent, runtimeEnv } from '@/db/runtime';
import { jsonResponse } from '@/lib/order-model';
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
  const facebookUrl = normalizedFacebookUrl(
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>).facebookUrl
      : undefined,
  );
  if (facebookUrl === null) {
    return jsonResponse(
      { error: 'Saisissez un lien Facebook valide et sécurisé (https).' },
      422,
    );
  }

  const now = new Date().toISOString();
  await runtimeEnv()
    .DB.prepare('UPDATE orders SET facebook_url = ?, updated_at = ? WHERE id = ?')
    .bind(facebookUrl, now, id)
    .run();
  await recordEvent(id, 'CLIENT_DETAILS_UPDATED', {
    fields: ['facebookUrl'],
  });

  return jsonResponse({ facebookUrl, updatedAt: now });
}
