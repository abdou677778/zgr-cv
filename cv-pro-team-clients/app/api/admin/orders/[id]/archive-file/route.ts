import { ensureSchema, recordEvent, runtimeEnv } from "@/db/runtime";
import { requireAdmin } from "@/lib/admin-auth";
import {
  jsonResponse,
  MAX_ARCHIVE_FILES,
  MAX_FILE_BYTES,
  MAX_ORDER_BYTES,
  safeFileName,
} from "@/lib/order-model";
import { getOrder } from "@/lib/order-repository";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const archiveCategories = new Set([
  "CAPTURE_FACEBOOK",
  "INFOS_CLIENT",
  "LIVRABLE_HISTORIQUE",
  "AUTRES_ARCHIVES",
]);

function decodedHeader(request: Request, name: string, maxLength: number) {
  const encoded = request.headers.get(name)?.trim();
  if (!encoded) return "";
  try {
    const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(`${normalized}${padding}`), (value) => value.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes).trim();
    return decoded.length <= maxLength ? decoded : null;
  } catch {
    return null;
  }
}

function normalizedSourceDate(value: string | null) {
  if (!value?.trim()) return undefined;
  const date = new Date(value);
  if (
    Number.isNaN(date.getTime()) ||
    date.getTime() < Date.UTC(1980, 0, 1) ||
    date.getTime() > Date.now() + 24 * 60 * 60 * 1000
  ) {
    return null;
  }
  return date.toISOString();
}

function normalizedRelativePath(value: string | null) {
  if (value === null) return null;
  const segments = value
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }
  return segments.join("/");
}

export async function POST(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  await ensureSchema();

  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) return jsonResponse({ error: "Commande introuvable." }, 404);
  if (order.status !== "ARCHIVED") {
    return jsonResponse(
      { error: "Le transfert brut est réservé aux archives administrateur." },
      409,
    );
  }

  const originalName = decodedHeader(request, "x-zgr-file-name-b64", 260);
  const sourceRelativePath = normalizedRelativePath(
    decodedHeader(request, "x-zgr-source-path-b64", 600),
  );
  const sourceModifiedAt = normalizedSourceDate(request.headers.get("x-zgr-source-modified-at"));
  const sha256 = request.headers.get("x-zgr-sha256")?.trim().toLowerCase() ?? "";
  const requestedCategory = request.headers.get("x-zgr-category")?.trim() ?? "";
  const category = archiveCategories.has(requestedCategory) ? requestedCategory : "AUTRES_ARCHIVES";
  const size = Number(request.headers.get("content-length"));

  if (
    !originalName ||
    sourceRelativePath === null ||
    sourceModifiedAt === null ||
    !/^[a-f0-9]{64}$/.test(sha256) ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > MAX_FILE_BYTES ||
    !request.body
  ) {
    return jsonResponse({ error: "Métadonnées ou contenu du fichier d’archive invalides." }, 422);
  }

  const totals = await runtimeEnv()
    .DB.prepare(
      "SELECT COUNT(*) AS file_count, COALESCE(SUM(size_bytes), 0) AS total_bytes FROM order_files WHERE order_id = ?",
    )
    .bind(id)
    .first<{ file_count: number; total_bytes: number }>();
  if ((totals?.file_count ?? 0) >= MAX_ARCHIVE_FILES) {
    return jsonResponse(
      {
        error: `La limite de ${MAX_ARCHIVE_FILES} fichiers par archive est atteinte.`,
      },
      413,
    );
  }
  if ((totals?.total_bytes ?? 0) + size > MAX_ORDER_BYTES) {
    return jsonResponse({ error: "La taille totale de l’archive dépasse 500 Mo." }, 413);
  }

  const duplicate = await runtimeEnv()
    .DB.prepare("SELECT id FROM order_files WHERE order_id = ? AND sha256 = ?")
    .bind(id, sha256)
    .first();
  if (duplicate) {
    return jsonResponse({ error: "Ce fichier a déjà été ajouté à la commande." }, 409);
  }

  const fileId = crypto.randomUUID();
  const mimeType = request.headers.get("content-type") || "application/octet-stream";
  const now = new Date().toISOString();
  const storageKey = `orders/${id}/01_DOCUMENTS_SOURCES/${category}/${fileId}__${safeFileName(originalName)}`;
  await runtimeEnv().FILES.put(storageKey, request.body, {
    httpMetadata: { contentType: mimeType },
    customMetadata: {
      orderId: id,
      category,
      originalName,
      sha256,
      createdAt: now,
      ...(sourceModifiedAt ? { sourceModifiedAt } : {}),
      sourceRelativePath,
      source: "admin-archive-stream",
    },
  });

  try {
    await runtimeEnv()
      .DB.prepare(
        `INSERT INTO order_files (
          id, order_id, category, original_name, storage_key, mime_type,
          size_bytes, sha256, source_modified_at, source_relative_path, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        fileId,
        id,
        category,
        originalName,
        storageKey,
        mimeType,
        size,
        sha256,
        sourceModifiedAt ?? null,
        sourceRelativePath,
        now,
      )
      .run();
  } catch (error) {
    await runtimeEnv().FILES.delete(storageKey);
    throw error;
  }

  await runtimeEnv()
    .DB.prepare("UPDATE orders SET updated_at = ?, drive_status = 'PENDING' WHERE id = ?")
    .bind(now, id)
    .run();
  await recordEvent(id, "ARCHIVE_FILE_STREAMED", {
    fileId,
    originalName,
    sizeBytes: size,
    category,
    sourceModifiedAt: sourceModifiedAt ?? null,
    sourceRelativePath,
  });

  return jsonResponse({ fileId, sizeBytes: size, streamed: true }, 201);
}
