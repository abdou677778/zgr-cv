import { requireAdmin } from '@/lib/admin-auth';
import { ensureSchema, runtimeEnv } from '@/db/runtime';
import {
  createInvitationToken,
  jsonResponse,
  sha256Hex,
} from '@/lib/order-model';

export async function POST(request: Request) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  await ensureSchema();

  // Product rule: every client link has one predictable five-day lifetime.
  // Ignore a legacy validDays payload so callers cannot weaken this policy.
  await request.json().catch(() => null);
  const days = 5;
  const token = createInvitationToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const id = crypto.randomUUID();
  await runtimeEnv()
    .DB.prepare(
      'INSERT INTO invitations (id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
    )
    .bind(
      id,
      await sha256Hex(token),
      expiresAt.toISOString(),
      now.toISOString(),
    )
    .run();

  const publicBase = String(
    runtimeEnv().PUBLIC_INVITE_BASE_URL || 'https://zgr-cv.pages.dev/c',
  ).replace(/\/$/, '');
  const inviteUrl = `${publicBase}/${encodeURIComponent(token)}`;
  return jsonResponse(
    { id, inviteUrl, expiresAt: expiresAt.toISOString(), validDays: days },
    201,
  );
}
