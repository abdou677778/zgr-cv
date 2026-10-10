import { z } from 'zod';

import { ensureSchema, recordEvent, runtimeEnv } from '@/db/runtime';
import { requireAdmin } from '@/lib/admin-auth';
import { getOrder } from '@/lib/order-repository';
import { serviceIds } from '@/lib/order-constants';
import {
  createOrderId,
  jsonResponse,
  sha256Hex,
} from '@/lib/order-model';

const ARCHIVE_FIRST_YEAR = 2022;
const ARCHIVE_LAST_YEAR = 2025;

const archiveOrderSchema = z.object({
  clientName: z.string().trim().min(2).max(120),
  email: z.union([z.literal(''), z.email().trim().max(180)]).default(''),
  phone: z.string().trim().max(40).default(''),
  facebookUrl: z.string().trim().max(500).default(''),
  language: z.enum(['fr', 'en', 'ar']).default('fr'),
  notes: z.string().trim().max(6000).default(''),
  services: z.array(z.enum(serviceIds)).min(1).max(serviceIds.length),
  archiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function secureFacebookUrl(value: string) {
  if (!value) return '';
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
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

export async function POST(request: Request) {
  const denial = requireAdmin(request);
  if (denial) return denial;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Les informations du dossier sont invalides.' }, 400);
  }
  const parsed = archiveOrderSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'Vérifiez le nom, les contacts, la date et les services.' },
      422,
    );
  }

  const archiveDate = new Date(`${parsed.data.archiveDate}T12:00:00.000Z`);
  const year = archiveDate.getUTCFullYear();
  if (
    Number.isNaN(archiveDate.getTime()) ||
    archiveDate.toISOString().slice(0, 10) !== parsed.data.archiveDate ||
    year < ARCHIVE_FIRST_YEAR ||
    year > ARCHIVE_LAST_YEAR
  ) {
    return jsonResponse(
      { error: `La date doit appartenir à la période ${ARCHIVE_FIRST_YEAR}–${ARCHIVE_LAST_YEAR}.` },
      422,
    );
  }

  const facebookUrl = secureFacebookUrl(parsed.data.facebookUrl);
  if (facebookUrl === null) {
    return jsonResponse(
      { error: 'Saisissez un lien Facebook sécurisé appartenant à facebook.com.' },
      422,
    );
  }

  await ensureSchema();
  const id = createOrderId(archiveDate);
  const createdAt = archiveDate.toISOString();
  const now = new Date().toISOString();
  const actor = (request.headers.get('X-ZGR-Actor') || '').trim().slice(0, 64);
  const sourceKey = `archive:manual:${id}`;
  await runtimeEnv()
    .DB.prepare(
      `INSERT INTO orders (
        id, upload_token_hash, client_name, email, phone, facebook_url, language,
        notes, services_json, status, created_at, updated_at, completed_at,
        drive_status, admin_username, writer_username, archived_at,
        archived_from_status, archive_source_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ARCHIVED', ?, ?, ?, 'PENDING', ?, '', ?, 'DELIVERED', ?)`,
    )
    .bind(
      id,
      await sha256Hex(crypto.randomUUID()),
      parsed.data.clientName,
      parsed.data.email,
      parsed.data.phone,
      facebookUrl,
      parsed.data.language,
      parsed.data.notes,
      JSON.stringify(parsed.data.services),
      createdAt,
      now,
      createdAt,
      actor,
      now,
      sourceKey,
    )
    .run();
  await recordEvent(id, 'ORDER_ARCHIVE_CREATED', {
    archiveDate: parsed.data.archiveDate,
    source: 'manual',
    createdBy: actor,
  });

  return jsonResponse({ order: await getOrder(id) }, 201);
}
