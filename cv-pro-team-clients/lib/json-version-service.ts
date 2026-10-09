import { ensureSchema, recordEvent, runtimeEnv } from '@/db/runtime';
import { driveConfigured, syncOrderToDrive } from '@/lib/google-drive';
import { safeFileName, sha256Hex } from '@/lib/order-model';
import { getOrder } from '@/lib/order-repository';

const EXPECTED_LANGUAGES = ['fr', 'en', 'es', 'de', 'it', 'zh', 'ar'];
const MAX_RELOCATION_CHARACTERS = 33;
const DEFAULT_RELOCATION_STATUS: Record<string, string> = {
  fr: 'Mobile géographiquement',
  en: 'Open to relocate',
  es: 'Disponible para reubicarse',
  de: 'Umzugsbereit',
  it: 'Disponibile al trasferimento',
  zh: '接受工作调动',
  ar: 'مستعد للانتقال',
};

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
  const relocationErrors = presentLanguages.flatMap((language) => {
    const document = documents[language] as Record<string, unknown>;
    const relocation = document.statut_relocation;
    if (typeof relocation !== 'string' || !relocation.trim())
      return [`documents.${language}.statut_relocation est obligatoire.`];
    if (Array.from(relocation.trim()).length > MAX_RELOCATION_CHARACTERS)
      return [
        `documents.${language}.statut_relocation dépasse ${MAX_RELOCATION_CHARACTERS} caractères.`,
      ];
    return [];
  });
  return {
    valid: presentLanguages.length > 0 && relocationErrors.length === 0,
    errors: [
      ...(presentLanguages.length
        ? []
        : ['Aucun document linguistique reconnu.']),
      ...relocationErrors,
    ],
    warnings,
    presentLanguages,
    missingLanguages,
    defaultLanguage: root.default_language,
  };
}

export function normalizeCandidateJson(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const normalized = structuredClone(value) as Record<string, unknown>;
  if (
    !normalized.documents ||
    typeof normalized.documents !== 'object' ||
    Array.isArray(normalized.documents)
  )
    return normalized;
  const documents = normalized.documents as Record<string, unknown>;
  for (const language of EXPECTED_LANGUAGES) {
    const document = documents[language];
    if (!document || typeof document !== 'object' || Array.isArray(document))
      continue;
    const profile = document as Record<string, unknown>;
    if (
      typeof profile.statut_relocation !== 'string' ||
      !profile.statut_relocation.trim()
    )
      profile.statut_relocation = DEFAULT_RELOCATION_STATUS[language];
    else {
      const relocation = profile.statut_relocation.trim();
      profile.statut_relocation =
        Array.from(relocation).length <= MAX_RELOCATION_CHARACTERS
          ? relocation
          : DEFAULT_RELOCATION_STATUS[language];
    }
  }
  return normalized;
}

export async function saveJsonVersion(options: {
  orderId: string;
  parsed: unknown;
  originalName?: string;
  promptVersion?: string;
  source?: 'admin' | 'mcp';
  expectedBaseVersion?: number;
}) {
  await ensureSchema();
  const order = await getOrder(options.orderId);
  if (!order) throw new JsonVersionError('Commande introuvable.', 404);

  const normalized = normalizeCandidateJson(options.parsed);
  const validation = validateCandidateJson(normalized);
  if (!validation.valid) {
    throw new JsonVersionError(
      'Le JSON n’est pas compatible avec ZGR CV.',
      422,
      validation,
    );
  }

  const source = JSON.stringify(normalized, null, 2);
  if (new TextEncoder().encode(source).byteLength > 5_000_000) {
    throw new JsonVersionError('Le JSON doit être inférieur à 5 Mo.', 413);
  }

  const previous = await runtimeEnv()
    .DB.prepare(
      `SELECT version_number AS version, sha256, created_at
       FROM json_versions WHERE order_id = ? ORDER BY version_number DESC LIMIT 1`,
    )
    .bind(options.orderId)
    .first<{ version: number; sha256: string; created_at: string }>();
  const currentVersion = Number(previous?.version ?? 0);
  if (
    options.expectedBaseVersion !== undefined &&
    options.expectedBaseVersion !== currentVersion
  ) {
    throw new JsonVersionError(
      `Conflit de version : la version active est ${currentVersion}, pas ${options.expectedBaseVersion}. Rechargez le JSON actif avant de modifier.`,
      409,
      { currentVersion, expectedBaseVersion: options.expectedBaseVersion },
    );
  }
  const sha256 = await sha256Hex(new TextEncoder().encode(source).buffer);
  if (previous?.sha256 === sha256) {
    return {
      id: '',
      orderId: options.orderId,
      versionNumber: currentVersion,
      sha256,
      validation,
      createdAt: previous.created_at,
      driveStatus: order.driveStatus,
      unchanged: true,
    };
  }
  const versionNumber = currentVersion + 1;
  const versionLabel = String(versionNumber).padStart(3, '0');
  const storageKey = `orders/${options.orderId}/02_TRAITEMENT_IA/JSON_ZGR/CV_GLOBAL_7_LANGUES__v${versionLabel}.json`;
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
    unchanged: false,
  };
}
