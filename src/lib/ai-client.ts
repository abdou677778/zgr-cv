import type { AiConnection, AiModelOption, AiRunResult, AiSettings, AiUsage } from "./ai-types";

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
    const response = await fetch(url, { ...init, signal: controller.signal });
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

async function listGeminiModels(connection: AiConnection): Promise<AiModelOption[]> {
  const { response, body } = await requestJson(
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
    {
      headers: { "x-goog-api-key": connection.apiKey },
    },
    "Liste des modèles Gemini",
  );
  ensureOk(response, body, "Connexion Gemini refusée");
  const models = Array.isArray(body.models) ? body.models : [];
  return models.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const model = item as JsonRecord;
    const methods = Array.isArray(model.supportedGenerationMethods)
      ? model.supportedGenerationMethods
      : [];
    if (!methods.includes("generateContent") || typeof model.name !== "string") return [];
    const id = model.name.replace(/^models\//, "");
    return [
      {
        id,
        name: typeof model.displayName === "string" ? model.displayName : id,
        // The models endpoint has no free-tier eligibility field.
        free: false,
      },
    ];
  });
}

async function listOpenRouterModels(connection: AiConnection): Promise<AiModelOption[]> {
  const { response, body } = await requestJson(
    "https://openrouter.ai/api/v1/models?output_modalities=text",
    { headers: { Authorization: `Bearer ${connection.apiKey}` } },
    "Liste des modèles OpenRouter",
  );
  ensureOk(response, body, "Connexion OpenRouter refusée");
  const models = Array.isArray(body.data) ? body.data : [];
  return models.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const model = item as JsonRecord;
    if (typeof model.id !== "string") return [];
    const pricing =
      model.pricing && typeof model.pricing === "object" ? (model.pricing as JsonRecord) : {};
    const promptPrice = Number(pricing.prompt ?? Number.NaN);
    const completionPrice = Number(pricing.completion ?? Number.NaN);
    const free =
      model.id.endsWith(":free") ||
      (Number.isFinite(promptPrice) &&
        promptPrice === 0 &&
        Number.isFinite(completionPrice) &&
        completionPrice === 0);
    return [
      {
        id: model.id,
        name: typeof model.name === "string" ? model.name : model.id,
        free,
        provider:
          typeof model.canonical_slug === "string" ? model.canonical_slug.split("/")[0] : undefined,
      },
    ];
  });
}

async function openRouterUsage(
  connection: AiConnection,
): Promise<Pick<AiUsage, "remotePercent" | "remoteLabel">> {
  const { response, body } = await requestJson(
    "https://openrouter.ai/api/v1/key",
    { headers: { Authorization: `Bearer ${connection.apiKey}` } },
    "Lecture de l’usage OpenRouter",
  );
  ensureOk(response, body, "Impossible de lire l’usage OpenRouter");
  const data = body.data && typeof body.data === "object" ? (body.data as JsonRecord) : {};
  const limit = Number(data.limit);
  const remaining = Number(data.limit_remaining);
  const usage = Number(data.usage);
  if (Number.isFinite(limit) && limit > 0 && Number.isFinite(remaining)) {
    const percent = Math.max(0, Math.min(100, ((limit - remaining) / limit) * 100));
    return {
      remotePercent: percent,
      remoteLabel: `${percent.toFixed(1)} % de la limite de clé · ${Math.max(0, remaining).toFixed(2)} restant`,
    };
  }
  return {
    remoteLabel: Number.isFinite(usage)
      ? `Usage OpenRouter déclaré : ${usage.toFixed(4)} USD · aucune limite de clé définie`
      : "OpenRouter ne déclare aucune limite exploitable pour cette clé",
  };
}

export async function testAiConnection(
  connection: AiConnection,
): Promise<{ models: AiModelOption[]; model: string; usage: AiUsage }> {
  if (!connection.apiKey.trim()) throw new Error("Ajoutez d’abord une clé API.");
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
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": connection.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
    "Génération Gemini",
    options,
  );
  ensureOk(response, body, "Échec Gemini");
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  const first =
    candidates[0] && typeof candidates[0] === "object" ? (candidates[0] as JsonRecord) : {};
  const content =
    first.content && typeof first.content === "object" ? (first.content as JsonRecord) : {};
  const parts = Array.isArray(content.parts) ? content.parts : [];
  const text = parts
    .flatMap((part) =>
      part && typeof part === "object" && typeof (part as JsonRecord).text === "string"
        ? [(part as JsonRecord).text as string]
        : [],
    )
    .join("");
  if (!text) throw new Error("Gemini n’a renvoyé aucun contenu exploitable.");
  const usage =
    body.usageMetadata && typeof body.usageMetadata === "object"
      ? (body.usageMetadata as JsonRecord)
      : {};
  return { text, tokens: Number(usage.totalTokenCount) || 0 };
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
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${connection.apiKey}`,
        "X-OpenRouter-Title": "ZGR CV AI Assistant",
      },
      body: JSON.stringify({
        model: connection.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
        ...(order.length
          ? { provider: { order, allow_fallbacks: connection.allowProviderFallbacks } }
          : {}),
      }),
    },
    "Génération OpenRouter",
    options,
  );
  ensureOk(response, body, "Échec OpenRouter");
  const choices = Array.isArray(body.choices) ? body.choices : [];
  const first = choices[0] && typeof choices[0] === "object" ? (choices[0] as JsonRecord) : {};
  const message =
    first.message && typeof first.message === "object" ? (first.message as JsonRecord) : {};
  const text = typeof message.content === "string" ? message.content : "";
  if (!text) throw new Error("OpenRouter n’a renvoyé aucun contenu exploitable.");
  const usage = body.usage && typeof body.usage === "object" ? (body.usage as JsonRecord) : {};
  return { text, tokens: Number(usage.total_tokens) || 0 };
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
    .filter(
      (connection) => connection.enabled && connection.apiKey.trim() && connection.model.trim(),
    )
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
