import type { AiConnection, AiModelOption, AiRunResult, AiSettings, AiUsage } from "./ai-types";
import { authenticatedFetch } from "./auth-client";

type JsonRecord = Record<string, unknown>;

type AiRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_TOTAL_TIMEOUT_MS = 65_000;

export class AiHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
    public readonly quota: boolean,
  ) {
    super(message);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

const normalizedUsage = (usage: AiUsage): AiUsage =>
  usage.date === today() ? usage : { date: today(), requests: 0, tokens: 0 };

const errorMessage = (value: unknown, fallback: string) => {
  if (!value || typeof value !== "object") return fallback;
  const root = value as JsonRecord;
  const nested = root.error && typeof root.error === "object" ? (root.error as JsonRecord) : {};
  return typeof nested.message === "string"
    ? nested.message
    : typeof root.message === "string"
      ? root.message
      : fallback;
};

async function responseJson(response: Response): Promise<JsonRecord> {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as JsonRecord;
  } catch {
    return { message: raw.slice(0, 500) };
  }
}

async function requestJson(
  url: string,
  init: RequestInit,
  context: string,
  options: AiRequestOptions = {},
): Promise<{ response: Response; body: JsonRecord }> {
  const controller = new AbortController();
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
  let timedOut = false;
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = url.startsWith("/")
      ? await authenticatedFetch(url, { ...init, signal: controller.signal })
      : await fetch(url, { ...init, signal: controller.signal });
    const body = await responseJson(response);
    return { response, body };
  } catch (error) {
    if (controller.signal.aborted) {
      if (options.signal?.aborted) throw new Error("Génération annulée.");
      if (timedOut) {
        throw new AiHttpError(
          `${context} : aucune réponse après ${Math.round(timeoutMs / 1_000)} secondes`,
          408,
          true,
          false,
        );
      }
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function ensureOk(response: Response, body: JsonRecord, context: string) {
  if (response.ok) return;
  const quota = response.status === 429 || response.status === 402;
  const retryable = quota || response.status === 408 || response.status >= 500;
  throw new AiHttpError(
    errorMessage(body, `${context} (${response.status})`),
    response.status,
    retryable,
    quota,
  );
}

function cleanJsonText(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function parseJson<T>(value: string): T {
  try {
    return JSON.parse(cleanJsonText(value)) as T;
  } catch {
    throw new Error("Le modèle n’a pas renvoyé un JSON valide. Aucun changement n’a été appliqué.");
  }
}

async function listGeminiModels(_connection: AiConnection): Promise<AiModelOption[]> {
  const { response, body } = await requestJson(
    "/api/ai/models?provider=gemini",
    {},
    "Liste des modèles Gemini",
  );
  ensureOk(response, body, "Connexion Gemini refusée");
  const models = Array.isArray(body.models) ? body.models : [];
  return models.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const model = item as JsonRecord;
    if (typeof model.id !== "string") return [];
    return [
      {
        id: model.id,
        name: typeof model.name === "string" ? model.name : model.id,
        free: model.free === true,
      },
    ];
  });
}

async function listOpenRouterModels(_connection: AiConnection): Promise<AiModelOption[]> {
  const { response, body } = await requestJson(
    "/api/ai/models?provider=openrouter",
    {},
    "Liste des modèles OpenRouter",
  );
  ensureOk(response, body, "Connexion OpenRouter refusée");
  const models = Array.isArray(body.data) ? body.data : [];
  return models.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const model = item as JsonRecord;
    if (typeof model.id !== "string") return [];
    return [
      {
        id: model.id,
        name: typeof model.name === "string" ? model.name : model.id,
        free: model.free === true,
      },
    ];
  });
}

async function openRouterUsage(
  _connection: AiConnection,
): Promise<Pick<AiUsage, "remotePercent" | "remoteLabel">> {
  return { remoteLabel: "Clés OpenRouter protégées et gérées côté Cloudflare" };
}

export async function testAiConnection(
  connection: AiConnection,
): Promise<{ models: AiModelOption[]; model: string; usage: AiUsage }> {
  const models =
    connection.provider === "gemini"
      ? await listGeminiModels(connection)
      : await listOpenRouterModels(connection);
  if (!models.length)
    throw new Error("Connexion valide, mais aucun modèle de génération de texte n’est disponible.");
  const sortedModels = models.sort(
    (left, right) => Number(right.free) - Number(left.free) || left.name.localeCompare(right.name),
  );
  const model = sortedModels.some((item) => item.id === connection.model)
    ? connection.model
    : (sortedModels.find((item) => item.free)?.id ?? sortedModels[0].id);
  const probe = { ...connection, model };
  const probeSystem = "Réponds uniquement avec un objet JSON valide.";
  const probePrompt = 'Réponds exactement avec {"status":"ok"}.';
  if (connection.provider === "gemini")
    await generateGemini(probe, probeSystem, probePrompt, { timeoutMs: 20_000 });
  else await generateOpenRouter(probe, probeSystem, probePrompt, { timeoutMs: 20_000 });
  const remote = connection.provider === "openrouter" ? await openRouterUsage(connection) : {};
  return {
    models: sortedModels,
    model,
    usage: { ...normalizedUsage(connection.usage), ...remote, lastStatus: "ok", lastError: "" },
  };
}

async function generateGemini(
  connection: AiConnection,
  system: string,
  prompt: string,
  options: AiRequestOptions = {},
) {
  const model = connection.model.replace(/^models\//, "");
  const { response, body } = await requestJson(
    "/api/ai/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "gemini",
        model,
        system,
        prompt,
      }),
    },
    "Génération Gemini",
    options,
  );
  ensureOk(response, body, "Échec Gemini");
  const text = typeof body.text === "string" ? body.text : "";
  if (!text) throw new Error("Gemini n’a renvoyé aucun contenu exploitable.");
  return { text, tokens: Number(body.tokens) || 0 };
}

async function generateOpenRouter(
  connection: AiConnection,
  system: string,
  prompt: string,
  options: AiRequestOptions = {},
) {
  const order = connection.providerOrder
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const { response, body } = await requestJson(
    "/api/ai/generate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: "openrouter",
        model: connection.model,
        system,
        prompt,
        providerOrder: order.join(","),
        allowProviderFallbacks: connection.allowProviderFallbacks,
      }),
    },
    "Génération OpenRouter",
    options,
  );
  ensureOk(response, body, "Échec OpenRouter");
  const text = typeof body.text === "string" ? body.text : "";
  if (!text) throw new Error("OpenRouter n’a renvoyé aucun contenu exploitable.");
  return { text, tokens: Number(body.tokens) || 0 };
}

function updateConnection(
  settings: AiSettings,
  id: string,
  updater: (connection: AiConnection) => AiConnection,
): AiSettings {
  return {
    ...settings,
    connections: settings.connections.map((connection) =>
      connection.id === id ? updater(connection) : connection,
    ),
  };
}

export async function runAiJson<T>(
  initialSettings: AiSettings,
  system: string,
  prompt: string,
  options: { signal?: AbortSignal; maxTotalMs?: number } = {},
): Promise<AiRunResult<T>> {
  let settings = initialSettings;
  const deadline = Date.now() + (options.maxTotalMs ?? DEFAULT_TOTAL_TIMEOUT_MS);
  const candidates = settings.connections
    .filter((connection) => connection.enabled && connection.model.trim())
    .sort((left, right) => left.priority - right.priority);
  if (!candidates.length)
    throw new Error("Aucune connexion IA active et complète. Ouvrez Paramètres IA.");

  const failures: string[] = [];
  for (const [index, candidate] of candidates.entries()) {
    if (options.signal?.aborted) throw new Error("Génération annulée.");
    const remainingMs = deadline - Date.now();
    if (remainingMs < 1_000) {
      failures.push("délai global de génération dépassé");
      break;
    }
    const usage = normalizedUsage(candidate.usage);
    if (candidate.dailyRequestLimit > 0 && usage.requests >= candidate.dailyRequestLimit) {
      failures.push(`${candidate.label} : limite locale atteinte`);
      if (!settings.autoRotate) break;
      continue;
    }
    try {
      const result =
        candidate.provider === "gemini"
          ? await generateGemini(candidate, system, prompt, {
              signal: options.signal,
              timeoutMs: Math.min(DEFAULT_REQUEST_TIMEOUT_MS, remainingMs),
            })
          : await generateOpenRouter(candidate, system, prompt, {
              signal: options.signal,
              timeoutMs: Math.min(DEFAULT_REQUEST_TIMEOUT_MS, remainingMs),
            });
      settings = updateConnection(settings, candidate.id, (connection) => ({
        ...connection,
        usage: {
          ...normalizedUsage(connection.usage),
          requests: normalizedUsage(connection.usage).requests + 1,
          tokens: normalizedUsage(connection.usage).tokens + result.tokens,
          lastStatus: "ok",
          lastError: "",
        },
      }));
      return {
        data: parseJson<T>(result.text),
        connectionId: candidate.id,
        connectionLabel: candidate.label,
        model: candidate.model,
        tokens: result.tokens,
        nextSettings: settings,
      };
    } catch (error) {
      if (options.signal?.aborted) throw new Error("Génération annulée.");
      const message = error instanceof Error ? error.message : "Erreur IA inconnue";
      const quota = error instanceof AiHttpError && error.quota;
      settings = updateConnection(settings, candidate.id, (connection) => ({
        ...connection,
        usage: {
          ...normalizedUsage(connection.usage),
          lastStatus: quota ? "quota" : "error",
          lastError: message.slice(0, 300),
        },
      }));
      failures.push(`${candidate.label} : ${message}`);
      const canRotate = settings.autoRotate && index < candidates.length - 1;
      if (!canRotate) break;
    }
  }
  throw new Error(`Toutes les connexions IA ont échoué. ${failures.join(" · ")}`);
}
