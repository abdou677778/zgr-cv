import { requireAdmin } from "@/lib/admin-auth";
import { ensureSchema, recordEvent, runtimeEnv } from "@/db/runtime";
import { createOrderId, jsonResponse, sha256Hex } from "@/lib/order-model";

type ArchiveRow = Record<string, unknown>;

function value(row: ArchiveRow, ...keys: string[]) {
  for (const key of keys) {
    const candidate = row[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

function parseCsvLine(line: string, separator: string) {
  const values: string[] = [];
  let current = "";
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
      current = "";
    } else current += character;
  }
  values.push(current.trim());
  return values;
}

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) return [];
  const separator =
    (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = parseCsvLine(lines[0], separator).map((header) => header.trim());
  return lines
    .slice(1)
    .map((line) =>
      Object.fromEntries(
        parseCsvLine(line, separator).map((cell, index) => [headers[index], cell]),
      ),
    );
}

function normalizedDate(input: string, fallbackYear: number) {
  const candidate = input ? new Date(input) : new Date(`${fallbackYear}-01-01T12:00:00.000Z`);
  return Number.isNaN(candidate.getTime())
    ? new Date(`${fallbackYear}-01-01T12:00:00.000Z`).toISOString()
    : candidate.toISOString();
}

function normalizedServices(row: ArchiveRow) {
  const direct = row.services;
  if (Array.isArray(direct)) return direct.map(String).filter(Boolean).slice(0, 12);
  const text = value(row, "services", "service", "documents", "prestations");
  const values = text
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values : ["AUTRE"];
}

export async function POST(request: Request) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  await ensureSchema();

  const form = await request.formData();
  const file = form.get("file");
  const year = Number(form.get("year"));
  if (!(file instanceof File)) return jsonResponse({ error: "Fichier JSON ou CSV requis." }, 422);
  if (!Number.isInteger(year) || year < 2000 || year > new Date().getUTCFullYear()) {
    return jsonResponse({ error: "Année d’archive invalide." }, 422);
  }
  if (file.size > 5 * 1024 * 1024) return jsonResponse({ error: "Fichier limité à 5 Mo." }, 413);

  let rows: ArchiveRow[];
  try {
    const text = await file.text();
    if (file.name.toLowerCase().endsWith(".csv")) rows = parseCsv(text);
    else {
      const parsed = JSON.parse(text) as unknown;
      rows = Array.isArray(parsed)
        ? (parsed as ArchiveRow[])
        : Array.isArray((parsed as { orders?: unknown[] })?.orders)
          ? (parsed as { orders: ArchiveRow[] }).orders
          : [];
    }
  } catch {
    return jsonResponse({ error: "Le fichier d’archive est illisible." }, 422);
  }
  if (!rows.length) return jsonResponse({ error: "Aucune ancienne commande détectée." }, 422);
  if (rows.length > 1000) return jsonResponse({ error: "Import limité à 1 000 commandes." }, 422);

  const created: string[] = [];
  for (const row of rows) {
    const clientName = value(row, "clientName", "client_name", "nom", "name");
    if (!clientName) continue;
    const createdAt = normalizedDate(value(row, "createdAt", "created_at", "date"), year);
    const id = createOrderId(new Date(createdAt));
    const tokenHash = await sha256Hex(crypto.randomUUID());
    await runtimeEnv()
      .DB.prepare(
        `INSERT INTO orders (
          id, upload_token_hash, client_name, email, phone, facebook_url, language,
          notes, services_json, status, created_at, updated_at, completed_at,
          drive_status, admin_username, writer_username
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ARCHIVED', ?, ?, ?, 'PENDING', ?, ?)`,
      )
      .bind(
        id,
        tokenHash,
        clientName.slice(0, 120),
        value(row, "email", "e_mail").slice(0, 180),
        value(row, "phone", "telephone", "tel").slice(0, 40),
        value(row, "facebookUrl", "facebook_url", "facebook").slice(0, 500),
        value(row, "language", "langue") || "fr",
        value(row, "notes", "remarques").slice(0, 6000),
        JSON.stringify(normalizedServices(row)),
        createdAt,
        createdAt,
        createdAt,
        value(row, "adminUsername", "admin_username", "admin").slice(0, 64),
        value(row, "writerUsername", "writer_username", "redacteur", "rédacteur").slice(0, 64),
      )
      .run();
    await recordEvent(id, "ORDER_ARCHIVE_IMPORTED", { year, sourceFile: file.name });
    created.push(id);
  }
  return jsonResponse(
    { imported: created.length, skipped: rows.length - created.length, ids: created },
    201,
  );
}
