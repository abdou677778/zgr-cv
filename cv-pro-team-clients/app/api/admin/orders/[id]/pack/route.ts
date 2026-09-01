import { strToU8, zipSync } from 'fflate';

import masterPrompt from '@/assets/PROMPT_MAITRE_CV_JSON_7_LANGUES.txt?raw';
import { requireAdmin } from '@/lib/admin-auth';
import { recordEvent, runtimeEnv } from '@/db/runtime';
import { fileCategoryLabels, jsonResponse } from '@/lib/order-model';
import { getOrder, getOrderFiles } from '@/lib/order-repository';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MAX_PACK_BYTES = 150 * 1024 * 1024;

export async function GET(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;

  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) return jsonResponse({ error: 'Commande introuvable.' }, 404);
  const files = await getOrderFiles(id);
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
  if (totalBytes > MAX_PACK_BYTES) {
    return jsonResponse(
      {
        error:
          'Ce dossier dépasse 150 Mo. Le Pack IA volumineux sera activé avec le transfert Google Drive.',
      },
      413,
    );
  }

  const root = `${id}_${order.clientName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}`;
  const entries: Record<string, Uint8Array> = {};
  entries[`${root}/00_LIRE_EN_PREMIER.txt`] = strToU8(
    [
      `Commande : ${order.id}`,
      `Client : ${order.clientName}`,
      '',
      '1. Joignez le contenu du dossier DOCUMENTS_SOURCES à ChatGPT ou Gemini.',
      '2. Copiez intégralement le fichier 03_PROMPT_MAITRE_CV.txt.',
      '3. Récupérez le fichier CV_GLOBAL_7_LANGUES.json produit.',
      '4. Importez ce JSON dans la commande correspondante dans ZGR CV.',
    ].join('\n'),
  );
  entries[`${root}/01_BRIEF_CLIENT.txt`] = strToU8(
    [
      `CLIENT : ${order.clientName}`,
      `EMAIL : ${order.email}`,
      `TÉLÉPHONE : ${order.phone || 'Non renseigné'}`,
      `LANGUE : ${order.language}`,
      `SERVICES : ${order.services.join(', ')}`,
      '',
      'REMARQUES',
      order.notes || 'Aucune remarque.',
    ].join('\n'),
  );
  entries[`${root}/02_COMMANDE.json`] = strToU8(
    JSON.stringify(
      {
        schemaVersion: 1,
        id: order.id,
        clientName: order.clientName,
        language: order.language,
        services: order.services,
        notes: order.notes,
        createdAt: order.createdAt,
        promptVersion: '1.1',
      },
      null,
      2,
    ),
  );
  entries[`${root}/03_PROMPT_MAITRE_CV.txt`] = strToU8(masterPrompt);

  for (const file of files) {
    const object = await runtimeEnv().FILES.get(file.storageKey);
    if (!object) continue;
    const categoryLabel =
      fileCategoryLabels[file.category as keyof typeof fileCategoryLabels] ??
      file.category;
    const folder = categoryLabel.replace(/[^\p{L}\p{N}]+/gu, '_').toUpperCase();
    entries[`${root}/DOCUMENTS_SOURCES/${folder}/${file.originalName}`] =
      new Uint8Array(await object.arrayBuffer());
  }

  const archive = zipSync(entries, { level: 6 });
  await recordEvent(id, 'AI_PACK_DOWNLOADED', {
    fileCount: files.length,
    packBytes: archive.byteLength,
    promptVersion: '1.1',
  });
  return new Response(archive, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(archive.byteLength),
      'Content-Disposition': `attachment; filename="${id}_PACK_IA.zip"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
