import { requireAdmin } from '@/lib/admin-auth';
import { syncOrderToDrive } from '@/lib/google-drive';
import { jsonResponse } from '@/lib/order-model';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  const { id } = await context.params;
  const url = new URL(request.url);
  const offsetValue = Number(url.searchParams.get('offset') ?? '0');
  const batchSizeValue = url.searchParams.has('batchSize')
    ? Number(url.searchParams.get('batchSize'))
    : undefined;
  if (
    !Number.isInteger(offsetValue) ||
    offsetValue < 0 ||
    (batchSizeValue !== undefined &&
      (!Number.isInteger(batchSizeValue) ||
        batchSizeValue < 1 ||
        batchSizeValue > 25))
  ) {
    return jsonResponse({ error: 'Curseur de synchronisation invalide.' }, 422);
  }
  try {
    const result = await syncOrderToDrive(id, {
      offset: offsetValue,
      batchSize: batchSizeValue,
    });
    if (!result.configured) {
      return jsonResponse(
        {
          error:
            'La connexion Google Drive du portail n’est pas encore configurée.',
        },
        503,
      );
    }
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Synchronisation Drive impossible.',
      },
      502,
    );
  }
}
