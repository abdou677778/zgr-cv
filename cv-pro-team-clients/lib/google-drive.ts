import { recordEvent, runtimeEnv } from '@/db/runtime';
import { safeFileName } from '@/lib/order-model';
import {
  getJsonVersions,
  getOrder,
  getOrderFiles,
  type StoredDeliverable,
  type StoredOrder,
} from '@/lib/order-repository';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

type DriveEntry = { id: string; name: string; mimeType?: string };
type DriveDirectoryCache = Map<string, Map<string, DriveEntry>>;

let tokenCache: { token: string; expiresAt: number } | undefined;

export function driveConfigured() {
  const env = runtimeEnv();
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.GOOGLE_REFRESH_TOKEN &&
    env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
  );
}

async function accessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000)
    return tokenCache.token;
  const env = runtimeEnv();
  if (!driveConfigured())
    throw new Error('La connexion Google Drive n’est pas configurée.');
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    client_secret: env.GOOGLE_CLIENT_SECRET!,
    refresh_token: env.GOOGLE_REFRESH_TOKEN!,
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok)
    throw new Error(`Connexion Google refusée (${response.status}).`);
  const payload = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };
  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
  return tokenCache.token;
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await accessToken()}`);
  const response = await fetch(
    path.startsWith('http') ? path : `${DRIVE_API}${path}`,
    {
      ...init,
      headers,
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Google Drive ${response.status}: ${detail.slice(0, 280)}`);
  }
  return response;
}

function driveQueryValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

async function directoryEntries(
  cache: DriveDirectoryCache,
  parentId: string,
) {
  const cached = cache.get(parentId);
  if (cached) return cached;
  const search = new URLSearchParams({
    q: `'${driveQueryValue(parentId)}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType)',
    pageSize: '1000',
    spaces: 'drive',
  });
  const response = await driveFetch(`/files?${search.toString()}`);
  const payload = (await response.json()) as {
    files?: DriveEntry[];
  };
  const entries = new Map(
    (payload.files ?? []).map((entry) => [entry.name, entry] as const),
  );
  cache.set(parentId, entries);
  return entries;
}

async function ensureFolder(
  cache: DriveDirectoryCache,
  parentId: string,
  name: string,
) {
  const entries = await directoryEntries(cache, parentId);
  const existing = entries.get(name);
  if (existing?.mimeType === FOLDER_MIME_TYPE) return existing.id;
  const response = await driveFetch('/files?fields=id,name,mimeType', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME_TYPE,
      parents: [parentId],
    }),
  });
  const created = (await response.json()) as DriveEntry;
  entries.set(name, { ...created, name, mimeType: FOLDER_MIME_TYPE });
  return created.id;
}

function bodyStream(body: BodyInit) {
  if (body instanceof ReadableStream) return body;
  return new Response(body).body!;
}

function multipartUploadBody(
  metadata: object,
  contentType: string,
  size: number,
  body: BodyInit,
) {
  const boundary = `zgr_${crypto.randomUUID().replaceAll('-', '')}`;
  const encoder = new TextEncoder();
  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
  const source = bodyStream(body);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(prefix);
      const reader = source.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.enqueue(suffix);
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
  return {
    boundary,
    stream,
    contentLength: prefix.byteLength + size + suffix.byteLength,
  };
}

async function uploadToFolder(input: {
  cache: DriveDirectoryCache;
  parentId: string;
  name: string;
  contentType: string;
  size: number;
  body: BodyInit;
  sourceKey: string;
  overwrite?: boolean;
}) {
  const entries = await directoryEntries(input.cache, input.parentId);
  const existing = entries.get(input.name);
  if (existing && !input.overwrite) return;
  const uploadPath = existing
    ? `${DRIVE_UPLOAD_API}/files/${existing.id}?uploadType=multipart&fields=id,name,mimeType`
    : `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType`;
  const multipart = multipartUploadBody(
    {
      name: input.name,
      ...(existing ? {} : { parents: [input.parentId] }),
      appProperties: { zgrSourceKey: input.sourceKey.slice(0, 96) },
    },
    input.contentType,
    input.size,
    input.body,
  );
  const response = await driveFetch(uploadPath, {
    method: existing ? 'PATCH' : 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${multipart.boundary}`,
      'Content-Length': String(multipart.contentLength),
    },
    body: multipart.stream,
  });
  const uploaded = (await response.json()) as DriveEntry;
  entries.set(input.name, { ...uploaded, name: input.name });
}

async function uploadText(
  cache: DriveDirectoryCache,
  parentId: string,
  name: string,
  content: string,
  contentType: string,
  sourceKey: string,
  overwrite = false,
) {
  const bytes = new TextEncoder().encode(content);
  await uploadToFolder({
    cache,
    parentId,
    name,
    contentType,
    size: bytes.byteLength,
    body: bytes,
    sourceKey,
    overwrite,
  });
}

function clientFolderName(order: StoredOrder) {
  const date = order.createdAt.slice(0, 10);
  const client = safeFileName(order.clientName).toUpperCase();
  return `${date}_${order.id}_${client}`;
}

export async function syncOrderToDrive(orderId: string) {
  if (!driveConfigured()) return { configured: false as const };
  const order = await getOrder(orderId);
  if (!order) throw new Error('Commande introuvable.');
  const env = runtimeEnv();
  const rootId = env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;
  const startedAt = new Date().toISOString();

  const lock = await env.DB.prepare(
    "UPDATE orders SET drive_status = 'SYNCING', updated_at = ? WHERE id = ? AND drive_status <> 'SYNCING'",
  )
    .bind(startedAt, orderId)
    .run();
  if (!Number(lock.meta.changes))
    throw new Error('Une synchronisation Google Drive est déjà en cours.');
  try {
    const cache: DriveDirectoryCache = new Map();
    const files = await getOrderFiles(orderId);
    const versions = await getJsonVersions(orderId);
    const date = new Date(order.createdAt);
    const year = String(date.getUTCFullYear());
    const month = `${String(date.getUTCMonth() + 1).padStart(2, '0')}_${date
      .toLocaleString('fr-FR', { month: 'long', timeZone: 'UTC' })
      .toUpperCase()}`;
    const yearFolder = await ensureFolder(cache, rootId, year);
    const monthFolder = await ensureFolder(cache, yearFolder, month);
    const clientFolder = await ensureFolder(
      cache,
      monthFolder,
      clientFolderName(order),
    );
    const commandFolder = await ensureFolder(
      cache,
      clientFolder,
      '00_COMMANDE',
    );
    const sourceFolder = await ensureFolder(
      cache,
      clientFolder,
      '01_DOCUMENTS_SOURCES',
    );
    const aiFolder = await ensureFolder(
      cache,
      clientFolder,
      '02_TRAITEMENT_IA',
    );
    const jsonFolder = await ensureFolder(cache, aiFolder, 'JSON_ZGR');
    await ensureFolder(cache, aiFolder, 'PACKS_IA');
    await ensureFolder(cache, aiFolder, 'RAPPORTS_VALIDATION');
    await ensureFolder(cache, clientFolder, '03_PRODUCTION');
    const deliverablesFolder = await ensureFolder(
      cache,
      clientFolder,
      '04_LIVRABLES',
    );
    await ensureFolder(cache, clientFolder, '05_ARCHIVES');
    for (const service of order.services)
      await ensureFolder(cache, deliverablesFolder, service);

    const sourceCategoryFolders: Record<string, string> = {};
    const usedCategories = new Set(files.map((file) => file.category));
    for (const category of usedCategories) {
      sourceCategoryFolders[category] = await ensureFolder(
        cache,
        sourceFolder,
        category,
      );
    }

    const manifest = {
      schemaVersion: 1,
      order: { ...order, driveFolderId: clientFolder },
      files: files.map(({ storageKey: _storageKey, ...file }) => file),
    };
    const brief = [
      `COMMANDE : ${order.id}`,
      `CLIENT : ${order.clientName}`,
      `EMAIL : ${order.email}`,
      `TÉLÉPHONE : ${order.phone || 'Non renseigné'}`,
      `LANGUE : ${order.language}`,
      `SERVICES : ${order.services.join(', ')}`,
      '',
      'REMARQUES DU CLIENT',
      order.notes || 'Aucune remarque.',
    ].join('\n');
    await uploadText(
      cache,
      commandFolder,
      'commande.json',
      JSON.stringify(manifest, null, 2),
      'application/json; charset=utf-8',
      `${orderId}/commande.json`,
      true,
    );
    await uploadText(
      cache,
      commandFolder,
      'brief-client.txt',
      brief,
      'text/plain; charset=utf-8',
      `${orderId}/brief-client.txt`,
      true,
    );

    for (const file of files) {
      const object = await env.FILES.get(file.storageKey);
      if (!object) continue;
      await uploadToFolder({
        cache,
        parentId: sourceCategoryFolders[file.category] ?? sourceFolder,
        name: file.originalName,
        contentType: file.mimeType || 'application/octet-stream',
        size: object.size,
        body: object.body,
        sourceKey: file.storageKey,
      });
    }

    for (const version of versions) {
      const object = await env.FILES.get(version.storageKey);
      if (!object) continue;
      await uploadToFolder({
        cache,
        parentId: jsonFolder,
        name: `CV_GLOBAL_7_LANGUES__v${String(version.versionNumber).padStart(3, '0')}.json`,
        contentType: 'application/json; charset=utf-8',
        size: object.size,
        body: object.body,
        sourceKey: version.storageKey,
      });
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE orders SET drive_folder_id = ?, drive_status = 'SYNCED', updated_at = ? WHERE id = ?",
    )
      .bind(clientFolder, now, orderId)
      .run();
    await recordEvent(orderId, 'DRIVE_SYNCED', {
      driveFolderId: clientFolder,
      fileCount: files.length,
      jsonVersionCount: versions.length,
    });
    return { configured: true as const, driveFolderId: clientFolder };
  } catch (error) {
    await env.DB.prepare(
      "UPDATE orders SET drive_status = 'ERROR' WHERE id = ?",
    )
      .bind(orderId)
      .run();
    await recordEvent(orderId, 'DRIVE_SYNC_FAILED', {
      message: error instanceof Error ? error.message : 'Erreur Google Drive',
    });
    throw error;
  }
}

export async function publishDeliveryToDrive(input: {
  orderId: string;
  versionNumber: number;
  deliverables: StoredDeliverable[];
}) {
  if (!driveConfigured())
    throw new Error('La connexion Google Drive n’est pas configurée.');
  if (!input.deliverables.length)
    throw new Error('Sélectionnez au moins un livrable.');

  let order = await getOrder(input.orderId);
  if (!order) throw new Error('Commande introuvable.');
  if (!order.driveFolderId) {
    const synced = await syncOrderToDrive(input.orderId);
    if (!synced.configured) throw new Error('Google Drive est indisponible.');
    order = await getOrder(input.orderId);
  }
  if (!order?.driveFolderId)
    throw new Error('Le dossier Drive interne de la commande est introuvable.');

  const cache: DriveDirectoryCache = new Map();
  const deliverablesRoot = await ensureFolder(
    cache,
    order.driveFolderId,
    '04_LIVRABLES',
  );
  const label = `LIVRAISON_CLIENT__v${String(input.versionNumber).padStart(3, '0')}__${new Date()
    .toISOString()
    .slice(0, 10)}`;
  const deliveryFolderId = await ensureFolder(cache, deliverablesRoot, label);
  const usedNames = new Map<string, number>();

  for (const deliverable of input.deliverables) {
    const object = await runtimeEnv().FILES.get(deliverable.storageKey);
    if (!object)
      throw new Error(`Livrable R2 introuvable : ${deliverable.originalName}`);
    const baseName = safeFileName(deliverable.originalName);
    const occurrence = usedNames.get(baseName) ?? 0;
    usedNames.set(baseName, occurrence + 1);
    const name = occurrence
      ? baseName.replace(/(\.[^.]+)?$/, `_${occurrence + 1}$1`)
      : baseName;
    await uploadToFolder({
      cache,
      parentId: deliveryFolderId,
      name,
      contentType: deliverable.mimeType || 'application/octet-stream',
      size: object.size,
      body: object.body,
      sourceKey: deliverable.storageKey,
      overwrite: true,
    });
  }

  await driveFetch(`/files/${deliveryFolderId}/permissions?supportsAllDrives=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      type: 'anyone',
      role: 'reader',
      allowFileDiscovery: false,
    }),
  });

  return {
    driveFolderId: deliveryFolderId,
    shareUrl: `https://drive.google.com/drive/folders/${deliveryFolderId}?usp=sharing`,
  };
}
