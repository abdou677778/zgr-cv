import { requireAdmin } from '@/lib/admin-auth';
import { ensureSchema, runtimeEnv } from '@/db/runtime';
import { createOrderId, jsonResponse, sha256Hex } from '@/lib/order-model';

type ArchiveRow = Record<string, unknown>;
type ImportIssue = { row: number; reason: string };

const ALLOWED_PREVIOUS_STATUSES = new Set([
  'DRAFT',
  'RECEIVED',
  'JSON_IMPORTED',
  'IN_PRODUCTION',
  'TO_VALIDATE',
  'DELIVERED',
]);

function canonicalKey(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function value(row: ArchiveRow, ...keys: string[]) {
  const accepted = new Set(keys.map(canonicalKey));
  for (const [key, candidate] of Object.entries(row)) {
    if (
      accepted.has(canonicalKey(key)) &&
      (typeof candidate === 'string' || typeof candidate === 'number')
    ) {
      const text = String(candidate).trim();
      if (text) return text;
    }
  }
  return '';
}

function parseCsvLine(line: string, separator: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === separator && !quoted) {
      values.push(current.trim());
      current = '';
    } else current += character;
  }
  values.push(current.trim());
  return values;
}

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) return [];
  const separator =
    (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0)
      ? ';'
      : ',';
  const headers = parseCsvLine(lines[0], separator).map((header) =>
    header.trim(),
  );
  return lines
    .slice(1)
    .map((line) =>
      Object.fromEntries(
        parseCsvLine(line, separator).map((cell, index) => [
          headers[index],
          cell,
        ]),
      ),
    );
}

function parseArchiveDate(input: string, fallbackYear: number) {
  if (!input) {
    return {
      ok: true as const,
      iso: new Date(`${fallbackYear}-01-01T12:00:00.000Z`).toISOString(),
    };
  }
  const european = input.match(
    /^(\d{1,2})[\u002e\u002f\u002d](\d{1,2})[\u002e\u002f\u002d](\d{4})(?:\s+.*)?$/,
  );
  let candidate: Date;
  if (european) {
    candidate = new Date(
      Date.UTC(
        Number(european[3]),
        Number(european[2]) - 1,
        Number(european[1]),
        12,
      ),
    );
    if (
      candidate.getUTCFullYear() !== Number(european[3]) ||
      candidate.getUTCMonth() !== Number(european[2]) - 1 ||
      candidate.getUTCDate() !== Number(european[1])
    ) {
      return { ok: false as const, reason: `Date invalide : ${input}` };
    }
  } else {
    candidate = new Date(input);
  }
  if (Number.isNaN(candidate.getTime())) {
    return { ok: false as const, reason: `Date invalide : ${input}` };
  }
  if (candidate.getUTCFullYear() !== fallbackYear) {
    return {
      ok: false as const,
      reason: `La date ${input} n’appartient pas à l’année ${fallbackYear}`,
    };
  }
  return { ok: true as const, iso: candidate.toISOString() };
}

function normalizedServices(row: ArchiveRow) {
  const direct = Object.entries(row).find(
    ([key]) => canonicalKey(key) === 'services',
  )?.[1];
  if (Array.isArray(direct)) {
    return direct
      .map(String)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  const text = value(row, 'services', 'service', 'documents', 'prestations');
  const values = text
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values.slice(0, 12) : ['AUTRE'];
}

function previousStatus(row: ArchiveRow) {
  const raw = value(
    row,
    'status',
    'statut',
    'previousStatus',
    'statut_original',
  )
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (ALLOWED_PREVIOUS_STATUSES.has(raw)) return raw;
  if (['DONE', 'COMPLETED', 'COMPLETE', 'LIVREE', 'LIVRE'].includes(raw))
    return 'DELIVERED';
  return 'DELIVERED';
}

function normalizedLanguage(row: ArchiveRow) {
  const raw = value(row, 'language', 'langue').toLowerCase();
  if (raw.startsWith('ar')) return 'ar';
  if (raw.startsWith('en')) return 'en';
  return 'fr';
}

export async function POST(request: Request) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  await ensureSchema();

  const form = await request.formData();
  const file = form.get('file');
  const year = Number(form.get('year'));
  if (!(file instanceof File))
    return jsonResponse({ error: 'Fichier JSON ou CSV requis.' }, 422);
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > new Date().getUTCFullYear()
  ) {
    return jsonResponse({ error: 'Année d’archive invalide.' }, 422);
  }
  if (file.size > 5 * 1024 * 1024)
    return jsonResponse({ error: 'Fichier limité à 5 Mo.' }, 413);

  let rows: ArchiveRow[];
  try {
    const text = await file.text();
    if (file.name.toLowerCase().endsWith('.csv')) rows = parseCsv(text);
    else {
      const parsed = JSON.parse(text) as unknown;
      const candidates = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { orders?: unknown[] })?.orders)
          ? (parsed as { orders: unknown[] }).orders
          : [];
      rows = candidates.filter(
        (candidate): candidate is ArchiveRow =>
          Boolean(candidate) &&
          typeof candidate === 'object' &&
          !Array.isArray(candidate),
      );
    }
  } catch {
    return jsonResponse({ error: 'Le fichier d’archive est illisible.' }, 422);
  }
  if (!rows.length)
    return jsonResponse({ error: 'Aucune ancienne commande détectée.' }, 422);
  if (rows.length > 1000)
    return jsonResponse({ error: 'Import limité à 1 000 commandes.' }, 422);

  const issues: ImportIssue[] = [];
  const prepared: Array<{
    id: string;
    sourceKey: string;
    statement: D1PreparedStatement;
  }> = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const clientName = value(
      row,
      'clientName',
      'client_name',
      'nom',
      'name',
      'client',
    );
    if (clientName.length < 2) {
      issues.push({
        row: rowNumber,
        reason: 'Nom du client absent ou trop court',
      });
      continue;
    }
    const date = parseArchiveDate(
      value(row, 'createdAt', 'created_at', 'date', 'date_commande'),
      year,
    );
    if (!date.ok) {
      issues.push({ row: rowNumber, reason: date.reason });
      continue;
    }
    const email = value(row, 'email', 'e_mail', 'courriel').slice(0, 180);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      issues.push({
        row: rowNumber,
        reason: `Adresse e-mail invalide : ${email}`,
      });
      continue;
    }
    const services = normalizedServices(row);
    const originalId = value(
      row,
      'id',
      'orderId',
      'order_id',
      'commande',
      'identifiant',
    );
    const phone = value(row, 'phone', 'telephone', 'tel', 'mobile').slice(
      0,
      40,
    );
    const fingerprint = originalId
      ? `id|${canonicalKey(originalId)}`
      : [
          canonicalKey(clientName),
          email.toLowerCase(),
          canonicalKey(phone),
          date.iso,
          services.map(canonicalKey).sort().join('|'),
        ].join('|');
    const sourceKey = `archive:${year}:${await sha256Hex(fingerprint)}`;
    const id = createOrderId(new Date(date.iso));
    const tokenHash = await sha256Hex(crypto.randomUUID());
    const archivedAt = new Date().toISOString();
    const restoredStatus = previousStatus(row);
    prepared.push({
      id,
      sourceKey,
      statement: runtimeEnv()
        .DB.prepare(
          `INSERT OR IGNORE INTO orders (
            id, upload_token_hash, client_name, email, phone, facebook_url, language,
            notes, services_json, status, created_at, updated_at, completed_at,
            drive_status, admin_username, writer_username, archived_at,
            archived_from_status, archive_source_key
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ARCHIVED', ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          tokenHash,
          clientName.slice(0, 120),
          email,
          phone,
          value(row, 'facebookUrl', 'facebook_url', 'facebook').slice(0, 500),
          normalizedLanguage(row),
          value(row, 'notes', 'remarques', 'commentaire').slice(0, 6000),
          JSON.stringify(services),
          date.iso,
          archivedAt,
          restoredStatus === 'DELIVERED' ? date.iso : null,
          value(row, 'adminUsername', 'admin_username', 'admin').slice(0, 64),
          value(
            row,
            'writerUsername',
            'writer_username',
            'redacteur',
            'rédacteur',
          ).slice(0, 64),
          archivedAt,
          restoredStatus,
          sourceKey,
        ),
    });
  }

  const created: string[] = [];
  let duplicates = 0;
  const chunkSize = 50;
  for (let offset = 0; offset < prepared.length; offset += chunkSize) {
    const chunk = prepared.slice(offset, offset + chunkSize);
    const results = await runtimeEnv().DB.batch(
      chunk.map((item) => item.statement),
    );
    const inserted = chunk.filter(
      (_, index) => Number(results[index]?.meta?.changes ?? 0) > 0,
    );
    duplicates += chunk.length - inserted.length;
    created.push(...inserted.map((item) => item.id));
    if (inserted.length) {
      await runtimeEnv().DB.batch(
        inserted.map((item) =>
          runtimeEnv()
            .DB.prepare(
              "INSERT INTO order_events (order_id, type, details_json, created_at) VALUES (?, 'ORDER_ARCHIVE_IMPORTED', ?, ?)",
            )
            .bind(
              item.id,
              JSON.stringify({
                year,
                sourceFile: file.name,
                sourceKey: item.sourceKey,
              }),
              new Date().toISOString(),
            ),
        ),
      );
    }
  }

  return jsonResponse(
    {
      imported: created.length,
      duplicates,
      skipped: issues.length,
      ids: created,
      issues: issues.slice(0, 50),
      issueCount: issues.length,
      year,
    },
    created.length ? 201 : 200,
  );
}
