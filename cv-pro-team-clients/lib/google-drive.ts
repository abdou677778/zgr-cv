import { recordEvent, runtimeEnv } from '@/db/runtime';
import { fileCategoryLabels, safeFileName } from '@/lib/order-model';
import {
  getJsonVersions,
  getOrder,
  getOrderFiles,
  type StoredOrder,
} from '@/lib/order-repository';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

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

async function findFile(parentId: string, name: string, mimeType?: string) {
  const conditions = [
    `'${driveQueryValue(parentId)}' in parents`,
    `name = '${driveQueryValue(name)}'`,
    'trashed = false',
  ];
  if (mimeType) conditions.push(`mimeType = '${driveQueryValue(mimeType)}'`);
  const search = new URLSearchParams({
    q: conditions.join(' and '),
    fields: 'files(id,name,mimeType)',
    pageSize: '1',
    spaces: 'drive',
  });
  const response = await driveFetch(`/files?${search.toString()}`);
  const payload = (await response.json()) as {
    files?: Array<{ id: string; name: string }>;
  };
  return payload.files?.[0];
}

async function ensureFolder(parentId: string, name: string) {
  const existing = await findFile(parentId, name, FOLDER_MIME_TYPE);
  if (existing) return existing.id;
  const response = await driveFetch('/files?fields=id,name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME_TYPE,
      parents: [parentId],
    }),
  });
  return ((await response.json()) as { id: string }).id;
}

async function uploadToFolder(input: {
  parentId: string;
  name: string;
  contentType: string;
  size: number;
  body: BodyInit;
  sourceKey: string;
  overwrite?: boolean;
}) {
  const existing = await findFile(input.parentId, input.name);
  if (existing && !input.overwrite) return;
  const uploadPath = existing
    ? `${DRIVE_UPLOAD_API}/files/${existing.id}?uploadType=resumable&fields=id,name`
    : `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,name`;
  const initial = await driveFetch(uploadPath, {
    method: existing ? 'PATCH' : 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Upload-Content-Type': input.contentType,
      'X-Upload-Content-Length': String(input.size),
    },
    body: JSON.stringify({
      name: input.name,
      ...(existing ? {} : { parents: [input.parentId] }),
      appProperties: { zgrSourceKey: input.sourceKey.slice(0, 120) },
    }),
  });
  const sessionUrl = initial.headers.get('Location');
  if (!sessionUrl)
    throw new Error('Google Drive n’a pas créé de session de transfert.');
  await driveFetch(sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': input.contentType,
      'Content-Length': String(input.size),
    },
    body: input.body,
  });
}

async function uploadText(
  parentId: string,
  name: string,
  content: string,
  contentType: string,
  sourceKey: string,
  overwrite = false,
) {
  const bytes = new TextEncoder().encode(content);
  await uploadToFolder({
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

  await env.DB.prepare(
    "UPDATE orders SET drive_status = 'SYNCING' WHERE id = ?",
  )
    .bind(orderId)
    .run();
  try {
    const date = new Date(order.createdAt);
    const year = String(date.getUTCFullYear());
    const month = `${String(date.getUTCMonth() + 1).padStart(2, '0')}_${date
      .toLocaleString('fr-FR', { month: 'long', timeZone: 'UTC' })
      .toUpperCase()}`;
    const yearFolder = await ensureFolder(rootId, year);
    const monthFolder = await ensureFolder(yearFolder, month);
    const clientFolder = await ensureFolder(
      monthFolder,
      clientFolderName(order),
    );
    const commandFolder = await ensureFolder(clientFolder, '00_COMMANDE');
    const sourceFolder = await ensureFolder(
      clientFolder,
      '01_DOCUMENTS_SOURCES',
    );
    const aiFolder = await ensureFolder(clientFolder, '02_TRAITEMENT_IA');
    const jsonFolder = await ensureFolder(aiFolder, 'JSON_ZGR');
    await ensureFolder(aiFolder, 'PACKS_IA');
    await ensureFolder(aiFolder, 'RAPPORTS_VALIDATION');
    await ensureFolder(clientFolder, '03_PRODUCTION');
    const deliverablesFolder = await ensureFolder(clientFolder, '04_LIVRABLES');
    await ensureFolder(clientFolder, '05_ARCHIVES');
    for (const service of order.services)
      await ensureFolder(deliverablesFolder, service);

    const sourceCategoryFolders: Record<string, string> = {};
    for (const category of Object.keys(fileCategoryLabels)) {
      sourceCategoryFolders[category] = await ensureFolder(
        sourceFolder,
        category,
      );
    }

    const files = await getOrderFiles(orderId);
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
      commandFolder,
      'commande.json',
      JSON.stringify(manifest, null, 2),
      'application/json; charset=utf-8',
      `${orderId}/commande.json`,
      true,
    );
    await uploadText(
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
        parentId: sourceCategoryFolders[file.category] ?? sourceFolder,
        name: file.originalName,
        contentType: file.mimeType || 'application/octet-stream',
        size: object.size,
        body: object.body,
        sourceKey: file.storageKey,
      });
    }

    const versions = await getJsonVersions(orderId);
    for (const version of versions) {
      const object = await env.FILES.get(version.storageKey);
      if (!object) continue;
      await uploadToFolder({
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
