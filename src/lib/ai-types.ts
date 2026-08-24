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

export const newAiConnection = (provider: AiProviderId = "gemini"): AiConnection => ({
  id: crypto.randomUUID(),
  label: provider === "gemini" ? "Gemini — clé principale" : "OpenRouter — clé principale",
  provider,
  model: provider === "gemini" ? "gemini-2.5-flash" : "openrouter/free",
  enabled: true,
  priority: 1,
  dailyRequestLimit: provider === "gemini" ? 20 : 50,
  providerOrder: "",
  allowProviderFallbacks: true,
  models: [],
  usage: { date: today(), requests: 0, tokens: 0 },
});

export const defaultAiSettings = (): AiSettings => {
  const gemini = newAiConnection("gemini");
  const openRouter = newAiConnection("openrouter");
  openRouter.priority = 2;
  return {
    version: 1,
    autoRotate: true,
    freeModelsOnly: true,
    connections: [gemini, openRouter],
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
        const provider: AiProviderId =
          connection.provider === "openrouter" ? "openrouter" : "gemini";
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
