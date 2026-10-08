export const AI_PROVIDERS = ["groq", "workers_ai", "gemini", "mistral", "openrouter"] as const;

export type AiProviderId = (typeof AI_PROVIDERS)[number];

export type AiModelOption = {
  id: string;
  name: string;
  free: boolean;
  provider?: string;
};

export type AiProviderQuota = {
  accuracy: "exact" | "official" | "dashboard";
  source: string;
  sourceUrl: string;
  observedAt: string;
  label: string;
  model?: string;
  limitRequests?: number;
  remainingRequests?: number;
  resetRequests?: string;
  limitTokens?: number;
  remainingTokens?: number;
  resetTokens?: string;
  limitCredits?: number;
  remainingCredits?: number;
  currency?: string;
  limitUnits?: number;
  remainingUnits?: number;
  unit?: string;
};

export type AiUsage = {
  date: string;
  requests: number;
  tokens: number;
  remotePercent?: number;
  remoteLabel?: string;
  providerQuota?: AiProviderQuota;
  lastStatus?: "ok" | "error" | "quota";
  lastError?: string;
};

export type AiConnection = {
  id: string;
  label: string;
  provider: AiProviderId;
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

const PROVIDER_DEFAULTS: Record<
  AiProviderId,
  { label: string; model: string; dailyRequestLimit: number }
> = {
  gemini: {
    label: "Gemini — clé principale",
    model: "gemini-3.8-flash",
    dailyRequestLimit: 20,
  },
  mistral: {
    label: "Mistral — clé principale",
    model: "mistral-small-latest",
    dailyRequestLimit: 50,
  },
  groq: {
    label: "Groq — clé principale",
    model: "qwen/qwen3.8-27b",
    dailyRequestLimit: 100,
  },
  workers_ai: {
    label: "Cloudflare Workers AI",
    model: "@cf/google/gemma-4-26b-a4b-it",
    dailyRequestLimit: 50,
  },
  openrouter: {
    label: "OpenRouter — clé principale",
    model: "openrouter/free",
    dailyRequestLimit: 50,
  },
};

export const newAiConnection = (provider: AiProviderId = "gemini"): AiConnection => ({
  id: crypto.randomUUID(),
  label: PROVIDER_DEFAULTS[provider].label,
  provider,
  model: PROVIDER_DEFAULTS[provider].model,
  enabled: true,
  priority: 1,
  dailyRequestLimit: PROVIDER_DEFAULTS[provider].dailyRequestLimit,
  providerOrder: "",
  allowProviderFallbacks: true,
  models: [],
  usage: { date: today(), requests: 0, tokens: 0 },
});

export const defaultAiSettings = (): AiSettings => {
  const connections = AI_PROVIDERS.map((provider, index) => ({
    ...newAiConnection(provider),
    priority: index + 1,
  }));
  return {
    version: 1,
    autoRotate: true,
    freeModelsOnly: true,
    connections,
  };
};

export function normalizeAiSettings(value: unknown): AiSettings {
  const fallback = defaultAiSettings();
  if (!value || typeof value !== "object") return fallback;
  const source = value as Partial<AiSettings>;
  const connections = Array.isArray(source.connections)
    ? source.connections.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const connection = item as Partial<AiConnection>;
        const provider: AiProviderId = AI_PROVIDERS.includes(connection.provider as AiProviderId)
          ? (connection.provider as AiProviderId)
          : "gemini";
        const base = newAiConnection(provider);
        return [
          {
            ...base,
            ...connection,
            id: typeof connection.id === "string" && connection.id ? connection.id : base.id,
            provider,
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
    connections: connections.length ? connections : fallback.connections,
  };
}
