import { ensureSchema, recordEvent, runtimeEnv } from '@/db/runtime';
import { driveConfigured, syncOrderToDrive } from '@/lib/google-drive';
import { safeFileName, sha256Hex } from '@/lib/order-model';
import { getOrder } from '@/lib/order-repository';

const EXPECTED_LANGUAGES = ['fr', 'en', 'es', 'de', 'it', 'zh', 'ar'];

export class JsonVersionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'JsonVersionError';
  }
}

export function validateCandidateJson(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      valid: false,
      errors: ['La racine doit être un objet JSON.'],
      warnings: [] as string[],
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
      warnings: [] as string[],
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

export async function saveJsonVersion(options: {
  orderId: string;
  parsed: unknown;
  originalName?: string;
  promptVersion?: string;
  source?: 'admin' | 'mcp';
}) {
  await ensureSchema();
  const order = await getOrder(options.orderId);
  if (!order) throw new JsonVersionError('Commande introuvable.', 404);

  const validation = validateCandidateJson(options.parsed);
  if (!validation.valid) {
    throw new JsonVersionError(
      'Le JSON n’est pas compatible avec ZGR CV.',
      422,
      validation,
    );
  }

  const source = JSON.stringify(options.parsed, null, 2);
  if (new TextEncoder().encode(source).byteLength > 5_000_000) {
    throw new JsonVersionError('Le JSON doit être inférieur à 5 Mo.', 413);
  }

  const previous = await runtimeEnv()
    .DB.prepare(
      'SELECT COALESCE(MAX(version_number), 0) AS version FROM json_versions WHERE order_id = ?',
    )
    .bind(options.orderId)
    .first<{ version: number }>();
  const versionNumber = Number(previous?.version ?? 0) + 1;
  const versionLabel = String(versionNumber).padStart(3, '0');
  const storageKey = `orders/${options.orderId}/02_TRAITEMENT_IA/JSON_ZGR/CV_GLOBAL_7_LANGUES__v${versionLabel}.json`;
  const sha256 = await sha256Hex(new TextEncoder().encode(source).buffer);
  const createdAt = new Date().toISOString();
  const promptVersion = (options.promptVersion || '1.1').slice(0, 30);

  await runtimeEnv().FILES.put(storageKey, source, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: {
      orderId: options.orderId,
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
        options.orderId,
        versionNumber,
        storageKey,
        safeFileName(options.originalName || 'CV_GLOBAL_7_LANGUES.json'),
        sha256,
        promptVersion,
        JSON.stringify(validation),
        createdAt,
      ),
    runtimeEnv()
      .DB.prepare(
        "UPDATE orders SET current_json_version = ?, status = 'JSON_IMPORTED', updated_at = ? WHERE id = ?",
      )
      .bind(versionNumber, createdAt, options.orderId),
  ]);
  await recordEvent(options.orderId, 'JSON_IMPORTED', {
    source: options.source || 'admin',
    versionNumber,
    sha256,
    promptVersion,
    presentLanguages: validation.presentLanguages,
  });

  let driveStatus = order.driveStatus;
  if (driveConfigured()) {
    try {
      await syncOrderToDrive(options.orderId);
      driveStatus = 'SYNCED';
    } catch {
      driveStatus = 'ERROR';
    }
  }

  return {
    id: versionId,
    orderId: options.orderId,
    versionNumber,
    sha256,
    validation,
    createdAt,
    driveStatus,
  };
}
