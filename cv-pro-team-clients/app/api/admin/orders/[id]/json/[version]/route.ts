import { requireAdmin } from '@/lib/admin-auth';
import { ensureSchema, runtimeEnv } from '@/db/runtime';
import { jsonResponse } from '@/lib/order-model';

interface RouteContext {
  params: Promise<{ id: string; version: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  await ensureSchema();

  const { id, version } = await context.params;
  const versionNumber = Number(version);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return jsonResponse({ error: 'Version JSON invalide.' }, 400);
  }
  const row = await runtimeEnv()
    .DB.prepare(
      'SELECT storage_key FROM json_versions WHERE order_id = ? AND version_number = ?',
    )
    .bind(id, versionNumber)
    .first<{ storage_key: string }>();
  if (!row) return jsonResponse({ error: 'Version JSON introuvable.' }, 404);
  const object = await runtimeEnv().FILES.get(row.storage_key);
  if (!object) return jsonResponse({ error: 'Fichier JSON introuvable.' }, 404);

  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${id}_CV_GLOBAL_7_LANGUES_v${String(
        versionNumber,
      ).padStart(3, '0')}.json"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
