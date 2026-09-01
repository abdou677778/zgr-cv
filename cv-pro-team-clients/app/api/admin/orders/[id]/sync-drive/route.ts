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
  try {
    const result = await syncOrderToDrive(id);
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
