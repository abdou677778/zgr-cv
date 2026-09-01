import { requireAdmin } from '@/lib/admin-auth';
import { ensureSchema, recordEvent, runtimeEnv } from '@/db/runtime';
import { driveConfigured, syncOrderToDrive } from '@/lib/google-drive';
import { jsonResponse, safeFileName, sha256Hex } from '@/lib/order-model';
import { getOrder } from '@/lib/order-repository';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const EXPECTED_LANGUAGES = ['fr', 'en', 'es', 'de', 'it', 'zh', 'ar'];

function validateCandidateJson(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      valid: false,
      errors: ['La racine doit être un objet JSON.'],
      warnings: [],
    };
  }
  const root = value as Record<string, unknown>;
  const documents =
    root.documents &&
    typeof root.documents === 'object' &&
    !Array.isArray(root.documents)
      ? (root.documents as Record<string, unknown>)
      : null;
  if (!documents) {
    return {
      valid: false,
      errors: ['La clé obligatoire « documents » est absente ou invalide.'],
      warnings: [],
    };
  }
  const presentLanguages = EXPECTED_LANGUAGES.filter(
    (language) =>
      documents[language] &&
      typeof documents[language] === 'object' &&
      !Array.isArray(documents[language]),
  );
  const missingLanguages = EXPECTED_LANGUAGES.filter(
    (language) => !presentLanguages.includes(language),
  );
  const warnings = [
    ...(root.version !== '1.0' ? ['La version recommandée est « 1.0 ».'] : []),
    ...(missingLanguages.length
      ? [`Langues manquantes : ${missingLanguages.join(', ')}.`]
      : []),
  ];
  return {
    valid: presentLanguages.length > 0,
    errors: presentLanguages.length
      ? []
      : ['Aucun document linguistique reconnu.'],
    warnings,
    presentLanguages,
    missingLanguages,
    defaultLanguage: root.default_language,
  };
}

export async function POST(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  await ensureSchema();

  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) return jsonResponse({ error: 'Commande introuvable.' }, 404);
  const formData = await request.formData();
  const candidate = formData.get('file');
  const promptVersionValue = formData.get('promptVersion');
  const promptVersion = (
    typeof promptVersionValue === 'string' ? promptVersionValue : '1.1'
  ).slice(0, 30);
  if (!(candidate instanceof File)) {
    return jsonResponse({ error: 'Sélectionnez un fichier JSON.' }, 400);
  }
  if (candidate.size <= 0 || candidate.size > 5_000_000) {
    return jsonResponse({ error: 'Le JSON doit être inférieur à 5 Mo.' }, 413);
  }

  const source = await candidate.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return jsonResponse(
      { error: 'Le fichier ne contient pas un JSON valide.' },
      422,
    );
  }
  const validation = validateCandidateJson(parsed);
  if (!validation.valid) {
    return jsonResponse(
      { error: 'Le JSON n’est pas compatible avec ZGR CV.', validation },
      422,
    );
  }

  const previous = await runtimeEnv()
    .DB.prepare(
      'SELECT COALESCE(MAX(version_number), 0) AS version FROM json_versions WHERE order_id = ?',
    )
    .bind(id)
    .first<{ version: number }>();
  const versionNumber = Number(previous?.version ?? 0) + 1;
  const versionLabel = String(versionNumber).padStart(3, '0');
  const storageKey = `orders/${id}/02_TRAITEMENT_IA/JSON_ZGR/CV_GLOBAL_7_LANGUES__v${versionLabel}.json`;
  const sha256 = await sha256Hex(new TextEncoder().encode(source).buffer);
  const createdAt = new Date().toISOString();
  await runtimeEnv().FILES.put(storageKey, JSON.stringify(parsed, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: {
      orderId: id,
      version: String(versionNumber),
      sha256,
      promptVersion,
    },
  });

  const versionId = crypto.randomUUID();
  await runtimeEnv().DB.batch([
    runtimeEnv()
      .DB.prepare(
        `INSERT INTO json_versions (
          id, order_id, version_number, storage_key, original_name, sha256,
          prompt_version, validation_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        versionId,
        id,
        versionNumber,
        storageKey,
        safeFileName(candidate.name),
        sha256,
        promptVersion,
        JSON.stringify(validation),
        createdAt,
      ),
    runtimeEnv()
      .DB.prepare(
        "UPDATE orders SET current_json_version = ?, status = 'JSON_IMPORTED', updated_at = ? WHERE id = ?",
      )
      .bind(versionNumber, createdAt, id),
  ]);
  await recordEvent(id, 'JSON_IMPORTED', {
    versionNumber,
    sha256,
    promptVersion,
    presentLanguages: validation.presentLanguages,
  });

  let driveStatus = order.driveStatus;
  if (driveConfigured()) {
    try {
      await syncOrderToDrive(id);
      driveStatus = 'SYNCED';
    } catch {
      driveStatus = 'ERROR';
    }
  }

  return jsonResponse(
    {
      id: versionId,
      orderId: id,
      versionNumber,
      sha256,
      validation,
      createdAt,
      driveStatus,
    },
    201,
  );
}
