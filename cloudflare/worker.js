const MAX_JSON_BYTES = 5_000_000;
const MAX_LOGIN_BYTES = 4_096;
const MAX_AI_BYTES = 120_000;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const ID_PATTERN = /^ZGR-\d{8}-[A-Z0-9]{6,12}$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const origins = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return origins.includes(origin) ? origin : null;
}

function corsHeaders(origin) {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status = 200, origin = null) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(origin),
    },
  });
}

async function secureEqual(left, right) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  return crypto.subtle.timingSafeEqual(leftHash, rightHash);
}

function encodeBase64Url(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sessionKey(env, usages) {
  if (typeof env.SESSION_SECRET !== "string" || env.SESSION_SECRET.length < 40) return null;
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

async function issueSession(env) {
  const key = await sessionKey(env, ["sign"]);
  if (!key) throw new Error("SESSION_SECRET absent ou trop court.");
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = encodeBase64Url(
    JSON.stringify({ sub: "admin", iat: issuedAt, exp: issuedAt + SESSION_TTL_SECONDS }),
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return {
    token: `${payload}.${encodeBase64Url(signature)}`,
    expiresAt: issuedAt + SESSION_TTL_SECONDS,
  };
}

async function verifySession(token, env) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const key = await sessionKey(env, ["verify"]);
  if (!key) return false;
  let verified = false;
  try {
    verified = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(signature),
      encoder.encode(payload),
    );
  } catch {
    return false;
  }
  if (!verified) return false;
  try {
    const claims = JSON.parse(decoder.decode(decodeBase64Url(payload)));
    const now = Math.floor(Date.now() / 1000);
    return claims?.sub === "admin" && Number(claims.exp) > now && Number(claims.iat) <= now + 60;
  } catch {
    return false;
  }
}

async function authorized(request, env) {
  const received = request.headers.get("Authorization") || "";
  return received.startsWith("Bearer ") && verifySession(received.slice(7), env);
}

async function readJson(request, maxBytes) {
  const declaredSize = Number(request.headers.get("Content-Length") || 0);
  if (declaredSize > maxBytes) throw new Response(null, { status: 413 });
  const rawBuffer = await request.arrayBuffer();
  if (rawBuffer.byteLength > maxBytes) throw new Response(null, { status: 413 });
  const raw = decoder.decode(rawBuffer);
  try {
    return { value: JSON.parse(raw), raw };
  } catch {
    throw new Response(null, { status: 400 });
  }
}

async function login(request, env, origin) {
  let credentials;
  try {
    credentials = (await readJson(request, MAX_LOGIN_BYTES)).value;
  } catch (error) {
    if (error instanceof Response)
      return json(
        { error: error.status === 413 ? "Requête trop volumineuse." : "JSON invalide." },
        error.status,
        origin,
      );
    throw error;
  }
  const expectedUser = String(env.ADMIN_USERNAME || "admin");
  const expectedPassword = typeof env.ADMIN_PASSWORD === "string" ? env.ADMIN_PASSWORD : "";
  const user = typeof credentials?.username === "string" ? credentials.username.trim() : "";
  const password = typeof credentials?.password === "string" ? credentials.password : "";
  const [userMatches, passwordMatches] = await Promise.all([
    secureEqual(user, expectedUser),
    secureEqual(password, expectedPassword),
  ]);
  if (!userMatches || !passwordMatches || expectedPassword.length < 8) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    return json({ error: "Identifiants incorrects." }, 401, origin);
  }
  const session = await issueSession(env);
  return json({ ok: true, ...session }, 200, origin);
}

function profileId(pathname) {
  const match = pathname.match(/^\/api\/clients\/([^/]+)$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]).toUpperCase();
  return ID_PATTERN.test(id) ? id : null;
}

async function listProfiles(env, origin) {
  const profiles = [];
  let cursor;
  do {
    const page = await env.CLIENTS_BUCKET.list({
      prefix: "clients/",
      cursor,
      include: ["customMetadata"],
      limit: 500,
    });
    for (const object of page.objects) {
      const metadata = object.customMetadata || {};
      profiles.push({
        id: metadata.id || object.key.replace(/^clients\//, "").replace(/\.json$/, ""),
        name: metadata.name || "Profil sans nom",
        email: metadata.email || "",
        phone: metadata.phone || "",
        createdAt: metadata.createdAt || object.uploaded.toISOString(),
        updatedAt: metadata.updatedAt || object.uploaded.toISOString(),
        language: metadata.language || "fr",
        size: object.size,
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  profiles.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return json({ profiles }, 200, origin);
}

async function getProfile(env, id, origin) {
  const object = await env.CLIENTS_BUCKET.get(`clients/${id}.json`);
  if (!object) return json({ error: "Profil introuvable." }, 404, origin);
  return new Response(object.body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ETag: object.httpEtag,
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(origin),
    },
  });
}

async function putProfile(request, env, id, origin) {
  let parsed;
  try {
    parsed = await readJson(request, MAX_JSON_BYTES);
  } catch (error) {
    if (error instanceof Response)
      return json(
        { error: error.status === 413 ? "JSON supérieur à 5 Mo." : "JSON invalide." },
        error.status,
        origin,
      );
    throw error;
  }
  const profile = parsed.value;
  if (
    !profile ||
    profile.version !== 1 ||
    profile.id !== id ||
    typeof profile.name !== "string" ||
    typeof profile.updatedAt !== "string" ||
    !profile.cvByLanguage ||
    typeof profile.cvByLanguage !== "object"
  )
    return json({ error: "Structure du profil invalide." }, 422, origin);

  await env.CLIENTS_BUCKET.put(`clients/${id}.json`, parsed.raw, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: {
      id,
      name: profile.name.slice(0, 180),
      email: String(profile.email || "").slice(0, 180),
      phone: String(profile.phone || "").slice(0, 80),
      language: String(profile.language || "fr").slice(0, 8),
      createdAt: String(profile.createdAt || profile.updatedAt).slice(0, 40),
      updatedAt: profile.updatedAt.slice(0, 40),
    },
  });
  return json({ ok: true, id }, 200, origin);
}

function secretKeys(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed))
      return parsed.filter((item) => typeof item === "string" && item.trim());
  } catch {
    // Newline/comma-separated values are accepted too.
  }
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fetchProvider(url, init, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function providerError(response, fallback) {
  const body = await response.json().catch(() => ({}));
  const nested = body?.error && typeof body.error === "object" ? body.error : {};
  const message = typeof nested.message === "string" ? nested.message : fallback;
  return { message: message.slice(0, 500), status: response.status };
}

async function listAiModels(provider, env, origin) {
  const keys = secretKeys(provider === "gemini" ? env.GEMINI_API_KEYS : env.OPENROUTER_API_KEYS);
  if (!keys.length)
    return json({ error: `Aucune clé ${provider} configurée côté serveur.` }, 503, origin);
  const response =
    provider === "gemini"
      ? await fetchProvider(
          "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
          { headers: { "x-goog-api-key": keys[0] } },
        )
      : await fetchProvider("https://openrouter.ai/api/v1/models?output_modalities=text", {
          headers: { Authorization: `Bearer ${keys[0]}` },
        });
  if (!response.ok) {
    const error = await providerError(response, "Impossible de charger les modèles.");
    return json({ error: error.message }, error.status, origin);
  }
  const body = await response.json();
  if (provider === "gemini") {
    const models = (Array.isArray(body.models) ? body.models : []).flatMap((model) => {
      if (!model || typeof model.name !== "string") return [];
      const methods = Array.isArray(model.supportedGenerationMethods)
        ? model.supportedGenerationMethods
        : [];
      if (!methods.includes("generateContent")) return [];
      const id = model.name.replace(/^models\//, "");
      return [
        { id, name: typeof model.displayName === "string" ? model.displayName : id, free: false },
      ];
    });
    return json({ models }, 200, origin);
  }
  const models = (Array.isArray(body.data) ? body.data : []).flatMap((model) => {
    if (!model || typeof model.id !== "string") return [];
    const promptPrice = Number(model.pricing?.prompt);
    const completionPrice = Number(model.pricing?.completion);
    const free = model.id.endsWith(":free") || (promptPrice === 0 && completionPrice === 0);
    return [{ id: model.id, name: typeof model.name === "string" ? model.name : model.id, free }];
  });
  return json({ models }, 200, origin);
}

async function generateAi(request, env, origin) {
  let payload;
  try {
    payload = (await readJson(request, MAX_AI_BYTES)).value;
  } catch (error) {
    if (error instanceof Response)
      return json(
        { error: error.status === 413 ? "Instruction IA trop volumineuse." : "JSON IA invalide." },
        error.status,
        origin,
      );
    throw error;
  }
  const provider =
    payload?.provider === "openrouter"
      ? "openrouter"
      : payload?.provider === "gemini"
        ? "gemini"
        : null;
  const model =
    typeof payload?.model === "string" ? payload.model.trim().replace(/^models\//, "") : "";
  const system = typeof payload?.system === "string" ? payload.system : "";
  const prompt = typeof payload?.prompt === "string" ? payload.prompt : "";
  if (
    !provider ||
    !model ||
    !system ||
    !prompt ||
    model.length > 200 ||
    system.length > 20_000 ||
    prompt.length > 90_000
  )
    return json({ error: "Paramètres IA invalides." }, 422, origin);

  const keys = secretKeys(provider === "gemini" ? env.GEMINI_API_KEYS : env.OPENROUTER_API_KEYS);
  if (!keys.length)
    return json({ error: `Aucune clé ${provider} configurée côté serveur.` }, 503, origin);
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % keys.length;
  const orderedKeys = [...keys.slice(random), ...keys.slice(0, random)];
  const failures = [];

  for (const key of orderedKeys) {
    const response =
      provider === "gemini"
        ? await fetchProvider(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": key },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
              }),
            },
          )
        : await fetchProvider("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
              "X-OpenRouter-Title": "ZGR CV AI Assistant",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: system },
                { role: "user", content: prompt },
              ],
              temperature: 0.2,
              response_format: { type: "json_object" },
              ...(typeof payload.providerOrder === "string" && payload.providerOrder.trim()
                ? {
                    provider: {
                      order: payload.providerOrder
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                      allow_fallbacks: payload.allowProviderFallbacks !== false,
                    },
                  }
                : {}),
            }),
          });

    if (!response.ok) {
      const error = await providerError(response, `Échec ${provider}.`);
      failures.push(error.message);
      if ([402, 408, 429].includes(response.status) || response.status >= 500) continue;
      return json({ error: error.message }, response.status, origin);
    }
    const body = await response.json();
    if (provider === "gemini") {
      const parts = body?.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts) ? parts.map((part) => part?.text || "").join("") : "";
      if (!text)
        return json({ error: "Gemini n’a renvoyé aucun contenu exploitable." }, 502, origin);
      return json(
        { text, tokens: Number(body?.usageMetadata?.totalTokenCount) || 0, provider, model },
        200,
        origin,
      );
    }
    const text = body?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text)
      return json({ error: "OpenRouter n’a renvoyé aucun contenu exploitable." }, 502, origin);
    return json(
      { text, tokens: Number(body?.usage?.total_tokens) || 0, provider, model },
      200,
      origin,
    );
  }
  return json(
    { error: `Toutes les clés ${provider} ont échoué. ${failures.join(" · ").slice(0, 700)}` },
    503,
    origin,
  );
}

async function route(request, env) {
  const url = new URL(request.url);
  const origin = allowedOrigin(request, env);

  if (request.method === "OPTIONS") {
    if (request.headers.get("Origin") && !origin)
      return json({ error: "Origine non autorisée." }, 403);
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (url.pathname === "/health" && request.method === "GET")
    return json({ ok: true, service: "zgr-cv-storage-api" }, 200, origin);
  if (request.headers.get("Origin") && !origin)
    return json({ error: "Origine non autorisée." }, 403);
  if (url.pathname === "/api/auth/login" && request.method === "POST")
    return login(request, env, origin);

  if (!(await authorized(request, env)))
    return json({ error: "Session expirée ou accès non autorisé." }, 401, origin);
  if (url.pathname === "/api/auth/session" && request.method === "GET")
    return json({ ok: true, user: "admin" }, 200, origin);
  if (url.pathname === "/api/ai/models" && request.method === "GET") {
    const provider = url.searchParams.get("provider");
    if (provider !== "gemini" && provider !== "openrouter")
      return json({ error: "Fournisseur IA invalide." }, 400, origin);
    return listAiModels(provider, env, origin);
  }
  if (url.pathname === "/api/ai/generate" && request.method === "POST")
    return generateAi(request, env, origin);

  if (!env.CLIENTS_BUCKET) return json({ error: "Binding R2 CLIENTS_BUCKET absent." }, 503, origin);
  if (url.pathname === "/api/clients" && request.method === "GET") return listProfiles(env, origin);
  const id = profileId(url.pathname);
  if (!id) return json({ error: "Route ou ID client invalide." }, 404, origin);
  if (request.method === "GET") return getProfile(env, id, origin);
  if (request.method === "PUT") return putProfile(request, env, id, origin);
  if (request.method === "DELETE") {
    await env.CLIENTS_BUCKET.delete(`clients/${id}.json`);
    return json({ ok: true, id }, 200, origin);
  }
  return json({ error: "Méthode non autorisée." }, 405, origin);
}

export default {
  fetch(request, env) {
    return route(request, env).catch((error) => {
      console.error(
        JSON.stringify({
          event: "worker_error",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
      return json({ error: "Erreur interne du service." }, 500, allowedOrigin(request, env));
    });
  },
};
