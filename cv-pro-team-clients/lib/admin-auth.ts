import { jsonResponse } from '@/lib/order-model';
import { runtimeEnv } from '@/db/runtime';

export function requireAdmin(request: Request) {
  const configured = runtimeEnv().ADMIN_API_TOKEN?.trim();
  if (!configured) {
    return jsonResponse(
      {
        error:
          'Le secret administrateur du portail n’est pas encore configuré.',
      },
      503,
    );
  }

  const provided =
    request.headers.get('x-admin-token')?.trim() ||
    request.headers
      .get('authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim();

  if (!provided || provided !== configured) {
    return jsonResponse({ error: 'Accès administrateur refusé.' }, 401);
  }

  return null;
}
