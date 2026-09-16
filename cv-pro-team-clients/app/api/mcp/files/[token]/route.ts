import { runtimeEnv } from '@/db/runtime';
import { verifyFileAccessToken } from '@/lib/mcp-security';
import { getOrderFiles } from '@/lib/order-repository';

interface RouteContext {
  params: Promise<{ token: string }>;
}

function contentDisposition(name: string) {
  const fallback = name.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'document';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const access = await verifyFileAccessToken(token);
  if (!access) return new Response('Lien invalide ou expiré.', { status: 401 });

  const files = await getOrderFiles(access.orderId);
  const file = files.find((candidate) => candidate.id === access.fileId);
  if (!file) return new Response('Document introuvable.', { status: 404 });
  const object = await runtimeEnv().FILES.get(file.storageKey);
  if (!object) return new Response('Fichier introuvable.', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', file.mimeType || 'application/octet-stream');
  headers.set('Content-Length', String(file.sizeBytes));
  headers.set('Content-Disposition', contentDisposition(file.originalName));
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(object.body, { headers });
}
