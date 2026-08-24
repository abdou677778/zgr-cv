export type AiProviderId = "gemini" | "openrouter";

export type AiModelOption = {
  id: string;
  name: string;
  free: boolean;
  provider?: string;
};

export type AiUsage = {
  date: string;
  requests: number;
  tokens: number;
  remotePercent?: number;
  remoteLabel?: string;
  lastStatus?: "ok" | "error" | "quota";
  lastError?: string;
};

export type AiConnection = {
  id: string;
  label: string;
  provider: AiProviderId;
  apiKey: string;
  model: string;
  enabled: boolean;
  priority: number;
  dailyRequestLimit: number;
  providerOrder: string;
  allowProviderFallbacks: boolean;
  models: AiModelOption[];
  usage: AiUsage;
};

export type AiSettings = {
  version: 1;
  autoRotate: boolean;
  freeModelsOnly: boolean;
  rememberKeys: boolean;
  connections: AiConnection[];
};

export type AiRunResult<T> = {
  data: T;
  connectionId: string;
  connectionLabel: string;
  model: string;
  tokens: number;
  nextSettings: AiSettings;
};

const today = () => new Date().toISOString().slice(0, 10);

export const newAiConnection = (provider: AiProviderId = "gemini"): AiConnection => ({
  id: crypto.randomUUID(),
  label: provider === "gemini" ? "Gemini — clé principale" : "OpenRouter — clé principale",
  provider,
  apiKey: "",
  model: provider === "gemini" ? "gemini-2.5-flash" : "google/gemini-2.5-flash-lite",
  enabled: true,
  priority: 1,
  dailyRequestLimit: provider === "gemini" ? 20 : 50,
  providerOrder: "",
  allowProviderFallbacks: true,
  models: [],
  usage: { date: today(), requests: 0, tokens: 0 },
});

export type AiKeyImportResult = {
  connections: AiConnection[];
  duplicates: number;
  ignored: number;
};

/**
 * Extrait uniquement les formats de clés reconnus. Le texte brut n'est jamais
 * journalisé ni conservé par cette fonction.
 */
export function importAiKeys(text: string, existingConnections: AiConnection[]): AiKeyImportResult {
  const normalized = text.replace(/\\_/g, "_");
  const candidates: Array<{ provider: AiProviderId; apiKey: string }> = [];
  const patterns: Array<{ provider: AiProviderId; regex: RegExp }> = [
    { provider: "gemini", regex: /\bAQ\.[A-Za-z0-9_-]{20,}\b/g },
    { provider: "gemini", regex: /\bAIza[A-Za-z0-9_-]{20,}\b/g },
    { provider: "openrouter", regex: /\bsk-or-v1-[A-Za-z0-9_-]{20,}\b/g },
  ];

  for (const { provider, regex } of patterns) {
    for (const match of normalized.matchAll(regex)) {
      candidates.push({ provider, apiKey: match[0] });
    }
  }

  const knownKeys = new Set(existingConnections.map((connection) => connection.apiKey));
  const importedKeys = new Set<string>();
  const providerCounts: Record<AiProviderId, number> = {
    gemini: existingConnections.filter((connection) => connection.provider === "gemini").length,
    openrouter: existingConnections.filter((connection) => connection.provider === "openrouter")
      .length,
  };
  let duplicates = 0;

  const connections = candidates.flatMap(({ provider, apiKey }) => {
    if (knownKeys.has(apiKey) || importedKeys.has(apiKey)) {
      duplicates += 1;
      return [];
    }
    importedKeys.add(apiKey);
    providerCounts[provider] += 1;
    const connection = newAiConnection(provider);
    connection.apiKey = apiKey;
    connection.label = `${provider === "gemini" ? "Gemini" : "OpenRouter"} — clé ${providerCounts[provider]}`;
    connection.priority = existingConnections.length + importedKeys.size;
    return [connection];
  });

  return {
    connections,
    duplicates,
    ignored: normalized
      .split(/\s+/)
      .filter((token) => token && /^(AQ\.|AIza|sk-)/.test(token))
      .filter((token) => !candidates.some((candidate) => candidate.apiKey === token)).length,
  };
}

export const defaultAiSettings = (): AiSettings => ({
  version: 1,
  autoRotate: true,
  freeModelsOnly: true,
  rememberKeys: true,
  connections: [],
});

export function normalizeAiSettings(value: unknown): AiSettings {
  const fallback = defaultAiSettings();
  if (!value || typeof value !== "object") return fallback;
  const source = value as Partial<AiSettings>;
  const connections = Array.isArray(source.connections)
    ? source.connections.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const connection = item as Partial<AiConnection>;
        const provider: AiProviderId =
          connection.provider === "openrouter" ? "openrouter" : "gemini";
        const base = newAiConnection(provider);
        return [
          {
            ...base,
            ...connection,
            id: typeof connection.id === "string" && connection.id ? connection.id : base.id,
            provider,
            apiKey: typeof connection.apiKey === "string" ? connection.apiKey : "",
            models: Array.isArray(connection.models) ? connection.models : [],
            usage: {
              ...base.usage,
              ...(connection.usage && typeof connection.usage === "object" ? connection.usage : {}),
            },
          },
        ];
      })
    : [];
  return {
    version: 1,
    autoRotate: source.autoRotate !== false,
    freeModelsOnly: source.freeModelsOnly !== false,
    rememberKeys: source.rememberKeys !== false,
    connections,
  };
}
