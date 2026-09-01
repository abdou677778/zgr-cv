import { requireAdmin } from '@/lib/admin-auth';
import { ensureSchema, runtimeEnv } from '@/db/runtime';
import { createSecretToken, jsonResponse, sha256Hex } from '@/lib/order-model';

export async function POST(request: Request) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  await ensureSchema();

  let days = 7;
  try {
    const payload = (await request.json()) as { validDays?: number };
    if (Number.isFinite(payload.validDays))
      days = Math.min(30, Math.max(1, payload.validDays!));
  } catch {
    // The default seven-day invitation remains appropriate.
  }
  const token = createSecretToken();
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

  const url = new URL(request.url);
  const inviteUrl = `${url.origin}/?invite=${encodeURIComponent(token)}`;
  return jsonResponse(
    { id, inviteUrl, expiresAt: expiresAt.toISOString(), validDays: days },
    201,
  );
}
