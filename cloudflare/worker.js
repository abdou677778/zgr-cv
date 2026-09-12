const MAX_JSON_BYTES = 5_000_000;
const MAX_LOGIN_BYTES = 4_096;
const MAX_ACCOUNT_BYTES = 16_384;
const MAX_AI_BYTES = 120_000;
const MAX_TELEMETRY_BYTES = 16_384;
const MAX_PHOTO_BYTES = 150 * 1024;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const TRASH_RETENTION_DAYS = 30;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 6;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
// Cloudflare Workers currently rejects PBKDF2 iteration counts above 100,000.
const PBKDF2_ITERATIONS = 100_000;
const ID_PATTERN = /^ZGR-\d{8}-[A-Z0-9]{6,12}$/;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const USERS_PREFIX = "system/users/";
const SESSIONS_PREFIX = "system/sessions/";
const AUDIT_PREFIX = "system/audit/";
const AI_KEYS_OBJECT = "system/secrets/ai-keys.enc.json";
const CLIENT_HISTORY_PREFIX = "history/clients/";
const DAILY_BACKUP_PREFIX = "backups/daily/";
const TELEMETRY_KINDS = new Set(["web_vital", "javascript_error", "api_failure", "sync_failure"]);
const TELEMETRY_NAMES = new Set([
  "LCP",
  "CLS",
  "INP",
  "FCP",
  "TTFB",
  "window_error",
  "unhandled_rejection",
  "http_error",
  "network_error",
  "sync_error",
]);
const TELEMETRY_RATINGS = new Set(["good", "needs-improvement", "poor", "error"]);
const ACCOUNT_ROLES = new Set(["admin", "editor", "viewer"]);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  if (origin === new URL(request.url).origin) return origin;
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
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Profile-Revision",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status = 200, origin = null, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      ...corsHeaders(origin),
      ...extraHeaders,
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

function normalizeUsername(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeAccountRole(value) {
  if (value === "admin" || value === "editor" || value === "viewer") return value;
  // The former `user` role is intentionally migrated to editor without
  // interrupting existing accounts or sessions.
  return value === "user" ? "editor" : "viewer";
}

function normalizeClientWorkflowStatus(value) {
  return value === "review" || value === "approved" ? value : "draft";
}

function rolePermissions(role) {
  const normalized = normalizeAccountRole(role);
  return {
    clientsRead: true,
    clientsWrite: normalized === "admin" || normalized === "editor",
    clientsDelete: normalized === "admin",
    clientsRestore: normalized === "admin",
    clientsDownload: true,
    aiUse: normalized === "admin" || normalized === "editor",
    manageUsers: normalized === "admin",
  };
}

function randomBase64Url(size) {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(size)));
}

async function hashPassword(password, salt = randomBase64Url(16)) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: decodeBase64Url(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    material,
    256,
  );
  return {
    algorithm: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERATIONS,
    salt,
    hash: encodeBase64Url(hash),
  };
}

async function verifyPasswordHash(password, stored) {
  if (
    !stored ||
    stored.algorithm !== "PBKDF2-SHA256" ||
    stored.iterations !== PBKDF2_ITERATIONS ||
    typeof stored.salt !== "string" ||
    typeof stored.hash !== "string"
  )
    return false;
  const candidate = await hashPassword(password, stored.salt);
  try {
    return crypto.subtle.timingSafeEqual(
      decodeBase64Url(candidate.hash),
      decodeBase64Url(stored.hash),
    );
  } catch {
    return false;
  }
}

async function readR2Json(env, key) {
  const object = await env.CLIENTS_BUCKET.get(key);
  if (!object) return null;
  try {
    return JSON.parse(await object.text());
  } catch {
    return null;
  }
}

function publicUser(user) {
  const role = normalizeAccountRole(user.role);
  return {
    username: user.username,
    displayName: user.displayName,
    role,
    permissions: rolePermissions(role),
    active: user.active !== false,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
    lastLoginAt: user.lastLoginAt || null,
    loginCount: Number(user.loginCount) || 0,
    sessionVersion: Number(user.sessionVersion) || 1,
  };
}

async function saveUser(env, user) {
  await env.CLIENTS_BUCKET.put(
    `${USERS_PREFIX}${encodeURIComponent(user.username)}.json`,
    JSON.stringify(user),
    {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: {
        username: user.username,
        displayName: String(user.displayName || user.username).slice(0, 120),
        role: normalizeAccountRole(user.role),
        active: user.active === false ? "false" : "true",
        createdAt: String(user.createdAt || "").slice(0, 40),
        updatedAt: String(user.updatedAt || "").slice(0, 40),
        lastLoginAt: String(user.lastLoginAt || "").slice(0, 40),
        loginCount: String(Number(user.loginCount) || 0),
        sessionVersion: String(Number(user.sessionVersion) || 1),
      },
    },
  );
}

async function getStoredUser(env, username) {
  const normalized = normalizeUsername(username);
  if (!USERNAME_PATTERN.test(normalized)) return null;
  const user = await readR2Json(env, `${USERS_PREFIX}${encodeURIComponent(normalized)}.json`);
  return user && user.username === normalized ? user : null;
}

function bootstrapAdmin(env) {
  const username = normalizeUsername(env.ADMIN_USERNAME || "admin");
  return {
    username,
    displayName: "Administrateur",
    role: "admin",
    active: true,
    password: null,
    sessionVersion: 1,
    createdAt: null,
    updatedAt: null,
    lastLoginAt: null,
    loginCount: 0,
    bootstrap: true,
  };
}

async function getLoginUser(env, username) {
  const stored = await getStoredUser(env, username);
  if (stored) return stored;
  const admin = bootstrapAdmin(env);
  return username === admin.username ? admin : null;
}

async function verifyUserPassword(user, password, env) {
  if (user?.password) return verifyPasswordHash(password, user.password);
  if (user?.bootstrap) {
    const expected = typeof env.ADMIN_PASSWORD === "string" ? env.ADMIN_PASSWORD : "";
    return expected.length >= 8 && secureEqual(password, expected);
  }
  await hashPassword(password || "invalid-password", "AAECAwQFBgcICQoLDA0ODw");
  return false;
}

async function writeAudit(env, request, event, username, outcome = "success", details = {}) {
  if (!env.CLIENTS_BUCKET) return;
  const createdAt = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    event,
    username: normalizeUsername(username) || "unknown",
    outcome,
    createdAt,
    ip: String(request.headers.get("CF-Connecting-IP") || "").slice(0, 80),
    country: String(request.cf?.country || "").slice(0, 8),
    userAgent: String(request.headers.get("User-Agent") || "").slice(0, 300),
    details,
  };
  await env.CLIENTS_BUCKET.put(
    `${AUDIT_PREFIX}${Date.now()}-${entry.id}.json`,
    JSON.stringify(entry),
    {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: {
        id: entry.id,
        event: entry.event.slice(0, 80),
        username: entry.username.slice(0, 32),
        outcome: entry.outcome.slice(0, 20),
        createdAt,
        ip: entry.ip,
        country: entry.country,
      },
    },
  );
}

async function issueSession(env, user, sessionId) {
  const key = await sessionKey(env, ["sign"]);
  if (!key) throw new Error("SESSION_SECRET absent ou trop court.");
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = encodeBase64Url(
    JSON.stringify({
      sub: user.username,
      role: normalizeAccountRole(user.role),
      sv: Number(user.sessionVersion) || 1,
      sid: sessionId,
      iat: issuedAt,
      exp: issuedAt + SESSION_TTL_SECONDS,
    }),
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return {
    token: `${payload}.${encodeBase64Url(signature)}`,
    expiresAt: issuedAt + SESSION_TTL_SECONDS,
  };
}

function sessionObjectKey(username, sessionId) {
  return `${SESSIONS_PREFIX}${encodeURIComponent(username)}/${sessionId}.json`;
}

function deviceLabel(request) {
  const userAgent = String(request.headers.get("User-Agent") || "");
  const browser = /Edg\//i.test(userAgent)
    ? "Microsoft Edge"
    : /Firefox\//i.test(userAgent)
      ? "Firefox"
      : /Chrome\//i.test(userAgent)
        ? "Google Chrome"
        : /Safari\//i.test(userAgent)
          ? "Safari"
          : "Navigateur web";
  const system = /Android/i.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(userAgent)
      ? "iOS"
      : /Windows/i.test(userAgent)
        ? "Windows"
        : /Macintosh|Mac OS X/i.test(userAgent)
          ? "macOS"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "appareil inconnu";
  return `${browser} sur ${system}`;
}

async function writeAccountSession(env, session) {
  await env.CLIENTS_BUCKET.put(
    sessionObjectKey(session.username, session.id),
    JSON.stringify(session),
    {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: {
        id: session.id,
        username: session.username,
        deviceLabel: session.deviceLabel.slice(0, 100),
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
      },
    },
  );
}

async function saveAccountSession(env, user, request, sessionId, expiresAt) {
  const now = new Date().toISOString();
  const session = {
    id: sessionId,
    username: user.username,
    deviceLabel: deviceLabel(request),
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
  await writeAccountSession(env, session);
  return session;
}

async function getAccountSession(env, username, sessionId) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(sessionId || "")) return null;
  const session = await readR2Json(env, sessionObjectKey(username, sessionId));
  return session?.username === username && session?.id === sessionId ? session : null;
}

async function deleteUserSessions(env, username) {
  const prefix = `${SESSIONS_PREFIX}${encodeURIComponent(username)}/`;
  let deleted = 0;
  let cursor;
  do {
    const page = await env.CLIENTS_BUCKET.list({ prefix, cursor, limit: 500 });
    const keys = page.objects.map((object) => object.key);
    if (keys.length) {
      await env.CLIENTS_BUCKET.delete(keys);
      deleted += keys.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}

async function verifySession(token, env) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const key = await sessionKey(env, ["verify"]);
  if (!key) return null;
  let verified = false;
  try {
    verified = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(signature),
      encoder.encode(payload),
    );
  } catch {
    return null;
  }
  if (!verified) return null;
  try {
    const claims = JSON.parse(decoder.decode(decodeBase64Url(payload)));
    const now = Math.floor(Date.now() / 1000);
    if (
      !USERNAME_PATTERN.test(normalizeUsername(claims?.sub)) ||
      ![...ACCOUNT_ROLES, "user"].includes(claims?.role) ||
      Number(claims.exp) <= now ||
      Number(claims.iat) > now + 60
    )
      return null;
    return claims;
  } catch {
    return null;
  }
}

async function authenticatedUser(request, env, ctx) {
  const received = request.headers.get("Authorization") || "";
  if (!received.startsWith("Bearer ")) return null;
  const claims = await verifySession(received.slice(7), env);
  if (!claims) return null;
  const user = await getStoredUser(env, claims.sub);
  if (
    !user ||
    user.active === false ||
    normalizeAccountRole(user.role) !== normalizeAccountRole(claims.role) ||
    (Number(user.sessionVersion) || 1) !== Number(claims.sv)
  )
    return null;
  if (claims.sid) {
    const session = await getAccountSession(env, user.username, claims.sid);
    if (!session || Date.parse(session.expiresAt) <= Date.now()) {
      if (session)
        ctx?.waitUntil(env.CLIENTS_BUCKET.delete(sessionObjectKey(user.username, claims.sid)));
      return null;
    }
    if (Date.now() - Date.parse(session.lastSeenAt) > 60 * 60 * 1000) {
      ctx?.waitUntil(
        writeAccountSession(env, { ...session, lastSeenAt: new Date().toISOString() }),
      );
    }
  }
  const authenticated = { ...user, role: normalizeAccountRole(user.role) };
  Object.defineProperty(authenticated, "sessionId", {
    value: claims.sid || null,
    enumerable: false,
  });
  return authenticated;
}

async function loginAttemptKey(request, env, username) {
  const network = String(request.headers.get("CF-Connecting-IP") || "unknown").slice(0, 80);
  const secret = String(env.SESSION_SECRET || "missing-secret");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${secret}\n${network}\n${normalizeUsername(username) || "invalid"}`),
  );
  return encodeBase64Url(digest);
}

async function loginThrottleState(request, env, username) {
  if (!env.CLIENTS_DB) return null;
  try {
    const key = await loginAttemptKey(request, env, username);
    const row = await env.CLIENTS_DB.prepare(
      "SELECT attempts, window_started_at, blocked_until FROM login_attempts WHERE key_hash = ?",
    )
      .bind(key)
      .first();
    if (!row) return { key, blocked: false };
    const now = Date.now();
    const blockedUntil = Date.parse(row.blocked_until || "");
    if (Number.isFinite(blockedUntil) && blockedUntil > now)
      return {
        key,
        blocked: true,
        retryAfter: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
      };
    if (now - Date.parse(row.window_started_at) >= LOGIN_WINDOW_MS) {
      await env.CLIENTS_DB.prepare("DELETE FROM login_attempts WHERE key_hash = ?").bind(key).run();
      return { key, blocked: false };
    }
    return { key, blocked: false };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "login_throttle_read_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    return null;
  }
}

async function recordFailedLogin(request, env, username, knownKey) {
  if (!env.CLIENTS_DB) return;
  try {
    const key = knownKey || (await loginAttemptKey(request, env, username));
    const existing = await env.CLIENTS_DB.prepare(
      "SELECT attempts, window_started_at FROM login_attempts WHERE key_hash = ?",
    )
      .bind(key)
      .first();
    const now = Date.now();
    const sameWindow = existing && now - Date.parse(existing.window_started_at) < LOGIN_WINDOW_MS;
    const attempts = sameWindow ? Number(existing.attempts) + 1 : 1;
    const windowStartedAt = sameWindow ? existing.window_started_at : new Date(now).toISOString();
    const blockedUntil =
      attempts >= LOGIN_MAX_ATTEMPTS ? new Date(now + LOGIN_BLOCK_MS).toISOString() : null;
    await env.CLIENTS_DB.prepare(
      `INSERT INTO login_attempts
         (key_hash, attempts, window_started_at, blocked_until, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key_hash) DO UPDATE SET
         attempts = excluded.attempts,
         window_started_at = excluded.window_started_at,
         blocked_until = excluded.blocked_until,
         updated_at = excluded.updated_at`,
    )
      .bind(key, attempts, windowStartedAt, blockedUntil, new Date(now).toISOString())
      .run();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "login_throttle_write_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
}

async function clearFailedLogins(request, env, username, knownKey) {
  if (!env.CLIENTS_DB) return;
  try {
    const key = knownKey || (await loginAttemptKey(request, env, username));
    await env.CLIENTS_DB.prepare("DELETE FROM login_attempts WHERE key_hash = ?").bind(key).run();
  } catch {
    // A successful login must not fail solely because rate-limit cleanup is unavailable.
  }
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

function normalizedTelemetryEvent(value, actor, createdAt) {
  if (!value || typeof value !== "object") return null;
  const kind = TELEMETRY_KINDS.has(value.kind) ? value.kind : null;
  const name = TELEMETRY_NAMES.has(value.name) ? value.name : null;
  const rating = TELEMETRY_RATINGS.has(value.rating) ? value.rating : null;
  if (!kind || !name || !rating) return null;
  const numericValue = Number(value.value);
  const status = Number(value.status);
  const route =
    typeof value.route === "string" && /^\/api\/[a-z:/_-]{1,100}$/i.test(value.route)
      ? value.route.slice(0, 120)
      : null;
  const buildId =
    typeof value.buildId === "string" && /^[a-z0-9_-]{1,80}$/i.test(value.buildId)
      ? value.buildId
      : null;
  return {
    id: crypto.randomUUID(),
    kind,
    name,
    value: Number.isFinite(numericValue) ? Math.max(0, Math.min(numericValue, 120_000)) : null,
    rating,
    status: Number.isInteger(status) && status >= 0 && status <= 599 ? status : null,
    route,
    buildId,
    role: actor.role === "admin" ? "admin" : "user",
    createdAt,
  };
}

async function recordOperationalEvents(request, env, actor, origin, ctx) {
  let payload;
  try {
    payload = (await readJson(request, MAX_TELEMETRY_BYTES)).value;
  } catch (error) {
    if (error instanceof Response)
      return json({ error: "Métriques techniques invalides." }, error.status, origin);
    throw error;
  }
  const createdAt = new Date().toISOString();
  const candidates = Array.isArray(payload?.events) ? payload.events.slice(0, 20) : [];
  const events = candidates
    .map((event) => normalizedTelemetryEvent(event, actor, createdAt))
    .filter(Boolean);
  if (!events.length) return json({ error: "Aucune métrique technique valide." }, 422, origin);
  if (!env.CLIENTS_DB) return json({ ok: true, stored: 0, available: false }, 202, origin);

  await env.CLIENTS_DB.batch(
    events.map((event) =>
      env.CLIENTS_DB.prepare(
        `INSERT INTO operational_events
          (id, kind, name, value, rating, status, route, build_id, role, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        event.id,
        event.kind,
        event.name,
        event.value,
        event.rating,
        event.status,
        event.route,
        event.buildId,
        event.role,
        event.createdAt,
      ),
    ),
  );
  ctx.waitUntil(
    env.CLIENTS_DB.prepare("DELETE FROM operational_events WHERE created_at < ?")
      .bind(new Date(Date.now() - 30 * 86_400_000).toISOString())
      .run(),
  );
  return json({ ok: true, stored: events.length, available: true }, 202, origin);
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

async function operationalMonitoring(env, origin) {
  const empty = {
    generatedAt: new Date().toISOString(),
    available: false,
    health: "collecting",
    retentionDays: 30,
    last24h: { events: 0, javascriptErrors: 0, apiFailures: 0, syncFailures: 0 },
    vitals: [],
    daily: [],
    privacy: "Aucun nom, CV, courriel, téléphone, adresse IP ou contenu client n’est enregistré.",
  };
  if (!env.CLIENTS_DB) return json(empty, 200, origin);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  let rows;
  try {
    const result = await env.CLIENTS_DB.prepare(
      `SELECT kind, name, value, rating, status, route, build_id, created_at
       FROM operational_events WHERE created_at >= ? ORDER BY created_at DESC LIMIT 5000`,
    )
      .bind(since)
      .all();
    rows = result.results || [];
  } catch (error) {
    return json(
      {
        ...empty,
        error: error instanceof Error ? "Table de supervision indisponible." : "D1 indisponible.",
      },
      200,
      origin,
    );
  }

  const last24hCutoff = new Date(Date.now() - 86_400_000).toISOString();
  const last24hRows = rows.filter((row) => row.created_at >= last24hCutoff);
  const last24h = {
    events: last24hRows.length,
    javascriptErrors: last24hRows.filter((row) => row.kind === "javascript_error").length,
    apiFailures: last24hRows.filter((row) => row.kind === "api_failure").length,
    syncFailures: last24hRows.filter((row) => row.kind === "sync_failure").length,
  };
  const vitals = ["LCP", "INP", "CLS", "FCP", "TTFB"].map((name) => {
    const matching = last24hRows.filter(
      (row) => row.kind === "web_vital" && row.name === name && Number.isFinite(Number(row.value)),
    );
    const values = matching.map((row) => Number(row.value));
    return {
      name,
      samples: values.length,
      p75: percentile(values, 0.75),
      average: values.length
        ? Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 100) /
          100
        : null,
      poor: matching.filter((row) => row.rating === "poor").length,
    };
  });
  const days = Array.from({ length: 7 }, (_, offset) =>
    new Date(Date.now() - (6 - offset) * 86_400_000).toISOString().slice(0, 10),
  );
  const daily = days.map((day) => {
    const matching = rows.filter((row) => String(row.created_at).startsWith(day));
    return {
      day,
      events: matching.length,
      errors: matching.filter((row) => row.kind !== "web_vital").length,
    };
  });
  const failures = last24h.javascriptErrors + last24h.apiFailures + last24h.syncFailures;
  const vitalSamples = vitals.reduce((total, vital) => total + vital.samples, 0);
  const poorVitals = vitals.reduce((total, vital) => total + vital.poor, 0);
  const poorRatio = vitalSamples ? poorVitals / vitalSamples : 0;
  const health =
    last24h.events === 0
      ? "collecting"
      : failures >= 20 || poorRatio >= 0.4
        ? "critical"
        : failures >= 5 || poorRatio >= 0.15
          ? "warning"
          : "healthy";
  return json({ ...empty, available: true, health, last24h, vitals, daily }, 200, origin);
}

async function login(request, env, origin, ctx) {
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
  const username = normalizeUsername(credentials?.username);
  const password = typeof credentials?.password === "string" ? credentials.password : "";
  const throttle = await loginThrottleState(request, env, username);
  if (throttle?.blocked) {
    ctx.waitUntil(writeAudit(env, request, "login", username, "blocked"));
    return json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, 429, origin, {
      "Retry-After": String(throttle.retryAfter),
    });
  }
  const user = await getLoginUser(env, username);
  const passwordMatches = user ? await verifyUserPassword(user, password, env) : false;
  if (!user || user.active === false || !passwordMatches) {
    if (!user) await hashPassword(password || "invalid-password", "AAECAwQFBgcICQoLDA0ODw");
    await recordFailedLogin(request, env, username, throttle?.key);
    ctx.waitUntil(writeAudit(env, request, "login", username, "failure"));
    await new Promise((resolve) => setTimeout(resolve, 650));
    return json({ error: "Identifiants incorrects." }, 401, origin);
  }
  const now = new Date().toISOString();
  const storedUser = {
    ...user,
    bootstrap: undefined,
    password: user.password || (await hashPassword(password)),
    role: normalizeAccountRole(user.role),
    active: true,
    createdAt: user.createdAt || now,
    updatedAt: now,
    lastLoginAt: now,
    loginCount: (Number(user.loginCount) || 0) + 1,
    sessionVersion: Number(user.sessionVersion) || 1,
  };
  const sessionId = randomBase64Url(18);
  const session = await issueSession(env, storedUser, sessionId);
  await Promise.all([
    saveUser(env, storedUser),
    saveAccountSession(env, storedUser, request, sessionId, session.expiresAt),
    clearFailedLogins(request, env, username, throttle?.key),
  ]);
  ctx.waitUntil(writeAudit(env, request, "login", username, "success"));
  return json({ ok: true, ...session, user: publicUser(storedUser) }, 200, origin);
}

async function listAccountSessions(env, actor, origin, ctx) {
  const prefix = `${SESSIONS_PREFIX}${encodeURIComponent(actor.username)}/`;
  const sessions = [];
  const expiredKeys = [];
  let cursor;
  do {
    const page = await env.CLIENTS_BUCKET.list({
      prefix,
      cursor,
      include: ["customMetadata"],
      limit: 500,
    });
    for (const object of page.objects) {
      const metadata = object.customMetadata || {};
      const expiresAt = metadata.expiresAt || null;
      if (!expiresAt || Date.parse(expiresAt) <= Date.now()) {
        expiredKeys.push(object.key);
        continue;
      }
      sessions.push({
        id: metadata.id || object.key.slice(prefix.length).replace(/\.json$/, ""),
        deviceLabel: metadata.deviceLabel || "Navigateur web sur appareil inconnu",
        createdAt: metadata.createdAt || null,
        lastSeenAt: metadata.lastSeenAt || metadata.createdAt || null,
        expiresAt,
        current: Boolean(actor.sessionId && metadata.id === actor.sessionId),
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  if (expiredKeys.length) ctx.waitUntil(env.CLIENTS_BUCKET.delete(expiredKeys));
  sessions.sort(
    (left, right) => Date.parse(right.lastSeenAt || "") - Date.parse(left.lastSeenAt || ""),
  );
  return json({ sessions, legacySession: !actor.sessionId }, 200, origin);
}

async function revokeAccountSession(request, env, actor, sessionId, origin, ctx) {
  const session = await getAccountSession(env, actor.username, sessionId);
  if (!session) return json({ error: "Session introuvable ou déjà fermée." }, 404, origin);
  await env.CLIENTS_BUCKET.delete(sessionObjectKey(actor.username, sessionId));
  ctx.waitUntil(
    writeAudit(env, request, "session_revoked", actor.username, "success", {
      current: sessionId === actor.sessionId,
      deviceLabel: session.deviceLabel,
    }),
  );
  return json({ ok: true, logoutRequired: sessionId === actor.sessionId }, 200, origin);
}

async function revokeOtherAccountSessions(request, env, actor, origin, ctx) {
  const prefix = `${SESSIONS_PREFIX}${encodeURIComponent(actor.username)}/`;
  const keys = [];
  let cursor;
  do {
    const page = await env.CLIENTS_BUCKET.list({ prefix, cursor, limit: 500 });
    for (const object of page.objects) {
      const id = object.key.slice(prefix.length).replace(/\.json$/, "");
      if (!actor.sessionId || id !== actor.sessionId) keys.push(object.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  if (keys.length) await env.CLIENTS_BUCKET.delete(keys);
  ctx.waitUntil(
    writeAudit(env, request, "other_sessions_revoked", actor.username, "success", {
      revoked: keys.length,
    }),
  );
  return json({ ok: true, revoked: keys.length }, 200, origin);
}

function accountSessionId(pathname) {
  const match = pathname.match(/^\/api\/account\/sessions\/([A-Za-z0-9_-]{20,40})$/);
  return match ? match[1] : null;
}

async function listUsers(env, origin) {
  const users = [];
  const adminUsername = normalizeUsername(env.ADMIN_USERNAME || "admin");
  let cursor;
  do {
    const page = await env.CLIENTS_BUCKET.list({
      prefix: USERS_PREFIX,
      cursor,
      include: ["customMetadata"],
      limit: 500,
    });
    for (const object of page.objects) {
      const metadata = object.customMetadata || {};
      const role = normalizeAccountRole(metadata.role);
      users.push({
        username: metadata.username || "",
        displayName: metadata.displayName || metadata.username || "Profil",
        role,
        permissions: rolePermissions(role),
        active: metadata.active !== "false",
        createdAt: metadata.createdAt || null,
        updatedAt: metadata.updatedAt || null,
        lastLoginAt: metadata.lastLoginAt || null,
        loginCount: Number(metadata.loginCount) || 0,
        sessionVersion: Number(metadata.sessionVersion) || 1,
        isPrimary: metadata.username === adminUsername,
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  if (!users.some((user) => user.username === adminUsername))
    users.unshift({ ...publicUser(bootstrapAdmin(env)), isPrimary: true });
  const roleOrder = { admin: 0, editor: 1, viewer: 2 };
  users.sort((left, right) => {
    if (left.role !== right.role) return roleOrder[left.role] - roleOrder[right.role];
    return left.username.localeCompare(right.username);
  });
  return json({ users }, 200, origin);
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 10 && password.length <= 200;
}

async function createUser(request, env, actor, origin, ctx) {
  let payload;
  try {
    payload = (await readJson(request, MAX_ACCOUNT_BYTES)).value;
  } catch (error) {
    if (error instanceof Response)
      return json({ error: "Données de profil invalides." }, error.status, origin);
    throw error;
  }
  const username = normalizeUsername(payload?.username);
  const displayName =
    typeof payload?.displayName === "string" ? payload.displayName.trim().slice(0, 120) : "";
  const password = typeof payload?.password === "string" ? payload.password : "";
  const role = ACCOUNT_ROLES.has(payload?.role) ? payload.role : "editor";
  if (!USERNAME_PATTERN.test(username))
    return json(
      {
        error:
          "Identifiant invalide : 3 à 32 caractères minuscules, chiffres, point, tiret ou soulignement.",
      },
      422,
      origin,
    );
  if (username === normalizeUsername(env.ADMIN_USERNAME || "admin"))
    return json({ error: "Ce nom est réservé à l’administrateur principal." }, 409, origin);
  if (!displayName) return json({ error: "Le nom affiché est obligatoire." }, 422, origin);
  if (!validPassword(password))
    return json(
      { error: "Le mot de passe doit contenir entre 10 et 200 caractères." },
      422,
      origin,
    );
  if (await getStoredUser(env, username))
    return json({ error: "Ce profil existe déjà." }, 409, origin);
  const now = new Date().toISOString();
  const user = {
    username,
    displayName,
    role,
    active: true,
    password: await hashPassword(password),
    sessionVersion: 1,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    loginCount: 0,
  };
  await saveUser(env, user);
  ctx.waitUntil(
    writeAudit(env, request, "user_created", actor.username, "success", {
      target: username,
      role,
    }),
  );
  return json({ ok: true, user: { ...publicUser(user), isPrimary: false } }, 201, origin);
}

function accountUsername(pathname) {
  const match = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  return match ? normalizeUsername(decodeURIComponent(match[1])) : null;
}

function accountPasswordUsername(pathname) {
  const match = pathname.match(/^\/api\/admin\/users\/([^/]+)\/password$/);
  return match ? normalizeUsername(decodeURIComponent(match[1])) : null;
}

async function updateUser(request, env, actor, username, origin, ctx) {
  const user = await getStoredUser(env, username);
  if (!user) return json({ error: "Profil introuvable." }, 404, origin);
  let payload;
  try {
    payload = (await readJson(request, MAX_ACCOUNT_BYTES)).value;
  } catch (error) {
    if (error instanceof Response)
      return json({ error: "Données de profil invalides." }, error.status, origin);
    throw error;
  }
  const adminUsername = normalizeUsername(env.ADMIN_USERNAME || "admin");
  const displayName =
    typeof payload?.displayName === "string"
      ? payload.displayName.trim().slice(0, 120)
      : user.displayName;
  const protectedAccount = username === adminUsername || username === actor.username;
  const requestedRole = ACCOUNT_ROLES.has(payload?.role)
    ? payload.role
    : normalizeAccountRole(user.role);
  const role =
    username === adminUsername
      ? "admin"
      : protectedAccount
        ? normalizeAccountRole(user.role)
        : requestedRole;
  const active = protectedAccount ? true : payload?.active !== false;
  if (!displayName) return json({ error: "Le nom affiché est obligatoire." }, 422, origin);
  const changedActivity = user.active !== active;
  const changedRole = user.role !== role;
  const updated = {
    ...user,
    displayName,
    role,
    active,
    updatedAt: new Date().toISOString(),
    sessionVersion: (Number(user.sessionVersion) || 1) + (changedActivity || changedRole ? 1 : 0),
  };
  await Promise.all([
    saveUser(env, updated),
    changedActivity || changedRole ? deleteUserSessions(env, username) : Promise.resolve(),
  ]);
  ctx.waitUntil(
    writeAudit(env, request, "user_updated", actor.username, "success", {
      target: username,
      active,
      role,
    }),
  );
  return json(
    { ok: true, user: { ...publicUser(updated), isPrimary: username === adminUsername } },
    200,
    origin,
  );
}

async function resetUserPassword(request, env, actor, username, origin, ctx) {
  const user = await getStoredUser(env, username);
  if (!user) return json({ error: "Profil introuvable." }, 404, origin);
  let payload;
  try {
    payload = (await readJson(request, MAX_ACCOUNT_BYTES)).value;
  } catch (error) {
    if (error instanceof Response)
      return json({ error: "Mot de passe invalide." }, error.status, origin);
    throw error;
  }
  const password = typeof payload?.password === "string" ? payload.password : "";
  if (!validPassword(password))
    return json(
      { error: "Le mot de passe doit contenir entre 10 et 200 caractères." },
      422,
      origin,
    );
  const updated = {
    ...user,
    password: await hashPassword(password),
    updatedAt: new Date().toISOString(),
    sessionVersion: (Number(user.sessionVersion) || 1) + 1,
  };
  await Promise.all([saveUser(env, updated), deleteUserSessions(env, username)]);
  ctx.waitUntil(
    writeAudit(env, request, "password_reset", actor.username, "success", { target: username }),
  );
  return json({ ok: true, logoutRequired: username === actor.username }, 200, origin);
}

async function changeOwnPassword(request, env, actor, origin, ctx) {
  let payload;
  try {
    payload = (await readJson(request, MAX_ACCOUNT_BYTES)).value;
  } catch (error) {
    if (error instanceof Response)
      return json({ error: "Mot de passe invalide." }, error.status, origin);
    throw error;
  }
  const currentPassword =
    typeof payload?.currentPassword === "string" ? payload.currentPassword : "";
  const newPassword = typeof payload?.newPassword === "string" ? payload.newPassword : "";
  if (!(await verifyUserPassword(actor, currentPassword, env)))
    return json({ error: "Le mot de passe actuel est incorrect." }, 403, origin);
  if (!validPassword(newPassword))
    return json(
      { error: "Le nouveau mot de passe doit contenir entre 10 et 200 caractères." },
      422,
      origin,
    );
  const updated = {
    ...actor,
    password: await hashPassword(newPassword),
    updatedAt: new Date().toISOString(),
    sessionVersion: (Number(actor.sessionVersion) || 1) + 1,
  };
  await Promise.all([saveUser(env, updated), deleteUserSessions(env, actor.username)]);
  ctx.waitUntil(writeAudit(env, request, "password_changed", actor.username, "success"));
  return json({ ok: true, logoutRequired: true }, 200, origin);
}

async function deleteUser(request, env, actor, username, origin, ctx) {
  const adminUsername = normalizeUsername(env.ADMIN_USERNAME || "admin");
  if (username === adminUsername || username === actor.username)
    return json(
      { error: "Le compte administrateur actif ne peut pas être supprimé." },
      409,
      origin,
    );
  if (!(await getStoredUser(env, username)))
    return json({ error: "Profil introuvable." }, 404, origin);
  await Promise.all([
    env.CLIENTS_BUCKET.delete(`${USERS_PREFIX}${encodeURIComponent(username)}.json`),
    deleteUserSessions(env, username),
  ]);
  ctx.waitUntil(
    writeAudit(env, request, "user_deleted", actor.username, "success", { target: username }),
  );
  return json({ ok: true }, 200, origin);
}

async function listAudit(env, origin, requestedLimit) {
  const limit = Math.min(200, Math.max(1, Number(requestedLimit) || 100));
  const page = await env.CLIENTS_BUCKET.list({
    prefix: AUDIT_PREFIX,
    include: ["customMetadata"],
    limit: 1000,
  });
  const entries = page.objects
    .map((object) => ({
      id: object.customMetadata?.id || object.key,
      event: object.customMetadata?.event || "event",
      username: object.customMetadata?.username || "unknown",
      outcome: object.customMetadata?.outcome || "unknown",
      createdAt: object.customMetadata?.createdAt || object.uploaded.toISOString(),
      ip: object.customMetadata?.ip || "",
      country: object.customMetadata?.country || "",
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
  return json({ entries }, 200, origin);
}

function profileId(pathname) {
  const match = pathname.match(/^\/api\/clients\/([^/]+)$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]).toUpperCase();
  return ID_PATTERN.test(id) ? id : null;
}

function profilePhotoId(pathname) {
  const match = pathname.match(/^\/api\/clients\/([^/]+)\/photo$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]).toUpperCase();
  return ID_PATTERN.test(id) ? id : null;
}

function profileVersionsId(pathname) {
  const match = pathname.match(/^\/api\/clients\/([^/]+)\/versions$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]).toUpperCase();
  return ID_PATTERN.test(id) ? id : null;
}

function profileVersionRestore(pathname) {
  const match = pathname.match(/^\/api\/clients\/([^/]+)\/versions\/(\d+)\/restore$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]).toUpperCase();
  const revision = Number(match[2]);
  return ID_PATTERN.test(id) && Number.isSafeInteger(revision) && revision > 0
    ? { id, revision }
    : null;
}

function profileVersionId(pathname) {
  const match = pathname.match(/^\/api\/clients\/([^/]+)\/versions\/(\d+)$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]).toUpperCase();
  const revision = Number(match[2]);
  return ID_PATTERN.test(id) && Number.isSafeInteger(revision) && revision > 0
    ? { id, revision }
    : null;
}

function profileWorkflowId(pathname) {
  const match = pathname.match(/^\/api\/clients\/([^/]+)\/workflow$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]).toUpperCase();
  return ID_PATTERN.test(id) ? id : null;
}

const profilePhotoKey = (id) => `clients/${id}/photo.webp`;
const profileDeletedKey = (id) => `clients/${id}.deleted.json`;
const trashProfilePrefix = (id) => `trash/clients/${id}/`;
const trashProfileKey = (id) => `${trashProfilePrefix(id)}profile.json`;
const trashPhotoKey = (id) => `${trashProfilePrefix(id)}photo.webp`;
const trashManifestKey = (id) => `${trashProfilePrefix(id)}manifest.json`;
const profileVersionKey = (id, revision) =>
  `${CLIENT_HISTORY_PREFIX}${id}/${String(revision).padStart(8, "0")}.json`;
const profileVersionPhotoKey = (id, revision) =>
  `${CLIENT_HISTORY_PREFIX}${id}/${String(revision).padStart(8, "0")}.webp`;

function isWebp(buffer) {
  if (buffer.byteLength < 12) return false;
  const bytes = new Uint8Array(buffer, 0, 12);
  return (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

async function getProfilePhoto(env, id, origin) {
  const object = await env.CLIENTS_BUCKET.get(profilePhotoKey(id));
  if (!object) return json({ error: "Photo du profil introuvable." }, 404, origin);
  return new Response(object.body, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(object.size),
      "Cache-Control": "private, no-store",
      ETag: object.httpEtag,
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(origin),
    },
  });
}

async function putProfilePhoto(request, env, id, origin) {
  if ((request.headers.get("Content-Type") || "").split(";", 1)[0].trim() !== "image/webp") {
    return json({ error: "La photo doit être envoyée au format WebP." }, 415, origin);
  }
  const declaredSize = Number(request.headers.get("Content-Length") || 0);
  if (declaredSize > MAX_PHOTO_BYTES) {
    return json({ error: "La photo WebP dépasse 150 Ko." }, 413, origin);
  }
  const currentProfile = await readR2Json(env, `clients/${id}.json`);
  const expectedRevision = Number(request.headers.get("X-Profile-Revision") || 0);
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0 ||
    (currentProfile && expectedRevision !== storedProfileRevision(currentProfile)) ||
    (!currentProfile && expectedRevision !== 0)
  )
    return profileConflict(origin, currentProfile);
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_PHOTO_BYTES) {
    return json({ error: "La photo WebP dépasse 150 Ko." }, 413, origin);
  }
  if (!isWebp(buffer)) return json({ error: "Le fichier WebP est invalide." }, 422, origin);
  if (currentProfile && expectedRevision > 0) {
    await snapshotCurrentProfilePhoto(env, id, expectedRevision);
  }
  const updatedAt = new Date().toISOString();
  const key = profilePhotoKey(id);
  await env.CLIENTS_BUCKET.put(key, buffer, {
    httpMetadata: { contentType: "image/webp" },
    customMetadata: { id, updatedAt, size: String(buffer.byteLength) },
  });
  return json({ ok: true, id, key, size: buffer.byteLength, updatedAt }, 200, origin);
}

async function readR2ProfileIndex(env) {
  const profiles = [];
  const deletedProfiles = [];
  let cursor;
  do {
    const page = await env.CLIENTS_BUCKET.list({
      prefix: "clients/",
      cursor,
      include: ["customMetadata"],
      limit: 500,
    });
    for (const object of page.objects) {
      if (object.key.endsWith(".deleted.json")) {
        const metadata = object.customMetadata || {};
        deletedProfiles.push({
          id: metadata.id || object.key.replace(/^clients\//, "").replace(/\.deleted\.json$/, ""),
          deletedAt: metadata.deletedAt || object.uploaded.toISOString(),
          deletedBy: metadata.deletedBy || "unknown",
        });
        continue;
      }
      if (!object.key.endsWith(".json")) continue;
      const metadata = object.customMetadata || {};
      profiles.push({
        id: metadata.id || object.key.replace(/^clients\//, "").replace(/\.json$/, ""),
        revision: Number(metadata.revision) || 0,
        name: metadata.name || "Profil sans nom",
        email: metadata.email || "",
        phone: metadata.phone || "",
        createdAt: metadata.createdAt || object.uploaded.toISOString(),
        updatedAt: metadata.updatedAt || object.uploaded.toISOString(),
        language: metadata.language || "fr",
        workflowStatus: normalizeClientWorkflowStatus(metadata.workflowStatus),
        workflowUpdatedAt: metadata.workflowUpdatedAt || undefined,
        workflowUpdatedBy: metadata.workflowUpdatedByUsername
          ? {
              username: metadata.workflowUpdatedByUsername,
              displayName:
                metadata.workflowUpdatedByDisplayName || metadata.workflowUpdatedByUsername,
              role: normalizeAccountRole(metadata.workflowUpdatedByRole),
            }
          : undefined,
        size: object.size,
        hasPhoto: metadata.hasPhoto === "true",
        createdBy: metadata.createdByUsername
          ? {
              username: metadata.createdByUsername,
              displayName: metadata.createdByDisplayName || metadata.createdByUsername,
              role: normalizeAccountRole(metadata.createdByRole),
            }
          : undefined,
        updatedBy: metadata.updatedByUsername
          ? {
              username: metadata.updatedByUsername,
              displayName: metadata.updatedByDisplayName || metadata.updatedByUsername,
              role: normalizeAccountRole(metadata.updatedByRole),
            }
          : undefined,
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  profiles.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  deletedProfiles.sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
  return { profiles, deletedProfiles };
}

const CLIENT_PROFILE_INDEX_UPSERT = `
  INSERT INTO client_profiles (
    id, revision, name, email, phone, language, created_at, updated_at, size, has_photo,
    created_by_username, created_by_display_name, created_by_role,
    updated_by_username, updated_by_display_name, updated_by_role,
    workflow_status, workflow_updated_at,
    workflow_updated_by_username, workflow_updated_by_display_name, workflow_updated_by_role
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    revision = excluded.revision,
    name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    language = excluded.language,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    size = excluded.size,
    has_photo = excluded.has_photo,
    created_by_username = excluded.created_by_username,
    created_by_display_name = excluded.created_by_display_name,
    created_by_role = excluded.created_by_role,
    updated_by_username = excluded.updated_by_username,
    updated_by_display_name = excluded.updated_by_display_name,
    updated_by_role = excluded.updated_by_role,
    workflow_status = excluded.workflow_status,
    workflow_updated_at = excluded.workflow_updated_at,
    workflow_updated_by_username = excluded.workflow_updated_by_username,
    workflow_updated_by_display_name = excluded.workflow_updated_by_display_name,
    workflow_updated_by_role = excluded.workflow_updated_by_role
`;

function profileIndexBindings(profile, size = 0) {
  const createdBy = storedProfileActor(profile.createdBy);
  const updatedBy = storedProfileActor(profile.updatedBy);
  const workflowUpdatedBy = storedProfileActor(profile.workflowUpdatedBy);
  return [
    profile.id,
    storedProfileRevision(profile),
    String(profile.name || "Profil sans nom").slice(0, 180),
    String(profile.email || "").slice(0, 180),
    String(profile.phone || "").slice(0, 80),
    String(profile.language || "fr").slice(0, 8),
    String(profile.createdAt || profile.updatedAt || new Date().toISOString()).slice(0, 40),
    String(profile.updatedAt || new Date().toISOString()).slice(0, 40),
    Number(size) || 0,
    profile.hasPhoto || profile.photoAsset?.r2Key ? 1 : 0,
    createdBy?.username ?? null,
    createdBy?.displayName ?? null,
    createdBy?.role ?? null,
    updatedBy?.username ?? null,
    updatedBy?.displayName ?? null,
    updatedBy?.role ?? null,
    normalizeClientWorkflowStatus(profile.workflowStatus),
    typeof profile.workflowUpdatedAt === "string" ? profile.workflowUpdatedAt.slice(0, 40) : null,
    workflowUpdatedBy?.username ?? null,
    workflowUpdatedBy?.displayName ?? null,
    workflowUpdatedBy?.role ?? null,
  ];
}

function d1Actor(row, prefix) {
  const username = row[`${prefix}_by_username`];
  if (!username) return undefined;
  return {
    username,
    displayName: row[`${prefix}_by_display_name`] || username,
    role: normalizeAccountRole(row[`${prefix}_by_role`]),
  };
}

function d1ProfileSummary(row) {
  return {
    id: row.id,
    revision: Number(row.revision) || 0,
    name: row.name || "Profil sans nom",
    email: row.email || "",
    phone: row.phone || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    language: row.language || "fr",
    workflowStatus: normalizeClientWorkflowStatus(row.workflow_status),
    workflowUpdatedAt: row.workflow_updated_at || undefined,
    workflowUpdatedBy: d1Actor(row, "workflow_updated"),
    size: Number(row.size) || 0,
    hasPhoto: Number(row.has_photo) === 1,
    createdBy: d1Actor(row, "created"),
    updatedBy: d1Actor(row, "updated"),
  };
}

async function clientIndexReady(env) {
  if (!env.CLIENTS_DB) return false;
  const state = await env.CLIENTS_DB.prepare(
    "SELECT value FROM system_state WHERE key = 'client_index_ready'",
  ).first();
  return state?.value === "1";
}

async function setClientIndexReady(env, ready) {
  if (!env.CLIENTS_DB) return;
  await env.CLIENTS_DB.prepare(
    `INSERT INTO system_state (key, value, updated_at) VALUES ('client_index_ready', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  )
    .bind(ready ? "1" : "0", new Date().toISOString())
    .run();
}

async function upsertClientProfileIndex(env, profile, size = 0) {
  if (!env.CLIENTS_DB) return;
  await env.CLIENTS_DB.prepare(CLIENT_PROFILE_INDEX_UPSERT)
    .bind(...profileIndexBindings(profile, size))
    .run();
  await env.CLIENTS_DB.prepare("DELETE FROM client_profile_deletions WHERE id = ?")
    .bind(profile.id)
    .run();
}

async function deleteClientProfileIndex(env, id, deletedAt, deletedBy) {
  if (!env.CLIENTS_DB) return;
  await env.CLIENTS_DB.batch([
    env.CLIENTS_DB.prepare("DELETE FROM client_profiles WHERE id = ?").bind(id),
    env.CLIENTS_DB.prepare(
      `INSERT INTO client_profile_deletions (id, deleted_at, deleted_by) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET deleted_at = excluded.deleted_at, deleted_by = excluded.deleted_by`,
    ).bind(id, deletedAt, deletedBy),
  ]);
}

async function maintainClientProfileIndex(env, operation) {
  if (!env.CLIENTS_DB) return;
  try {
    await operation();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "client_index_write_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    try {
      await setClientIndexReady(env, false);
    } catch {
      // A D1 outage also makes listProfiles fall back to R2.
    }
  }
}

function clientProfileListOptions(searchParams) {
  const scope = searchParams?.get("scope") === "sync" ? "sync" : "page";
  const requestedPage = Number(searchParams?.get("page") || 1);
  const requestedPageSize = Number(searchParams?.get("pageSize") || 20);
  const owner = ["created", "updated", "involved"].includes(searchParams?.get("owner"))
    ? searchParams.get("owner")
    : "all";
  return {
    scope,
    query: String(searchParams?.get("q") || "")
      .trim()
      .slice(0, 120),
    owner,
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageSize:
      Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0
        ? Math.min(requestedPageSize, 100)
        : 20,
  };
}

function clientProfileMatches(profile, options, username) {
  const createdUsername = profile.createdBy?.username || "";
  const updatedUsername = profile.updatedBy?.username || "";
  if (options.owner === "created" && createdUsername !== username) return false;
  if (options.owner === "updated" && updatedUsername !== username) return false;
  if (options.owner === "involved" && createdUsername !== username && updatedUsername !== username)
    return false;
  if (!options.query) return true;
  const query = options.query.toLocaleLowerCase("fr");
  return [
    profile.id,
    profile.name,
    profile.email,
    profile.phone,
    profile.createdBy?.username,
    profile.createdBy?.displayName,
    profile.updatedBy?.username,
    profile.updatedBy?.displayName,
  ].some((value) =>
    String(value || "")
      .toLocaleLowerCase("fr")
      .includes(query),
  );
}

function paginateR2ProfileIndex(index, options, username) {
  if (options.scope === "sync") return index;
  const filtered = index.profiles.filter((profile) =>
    clientProfileMatches(profile, options, username),
  );
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / options.pageSize));
  const page = Math.min(options.page, totalPages);
  const offset = (page - 1) * options.pageSize;
  return {
    profiles: filtered.slice(offset, offset + options.pageSize),
    deletedProfiles: [],
    pagination: {
      page,
      pageSize: options.pageSize,
      total,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    },
  };
}

async function readD1ProfileIndex(env, options, username) {
  if (options.scope === "sync") {
    const [profilesResult, deletionsResult] = await env.CLIENTS_DB.batch([
      env.CLIENTS_DB.prepare("SELECT * FROM client_profiles ORDER BY updated_at DESC LIMIT 5000"),
      env.CLIENTS_DB.prepare(
        "SELECT id, deleted_at, deleted_by FROM client_profile_deletions ORDER BY deleted_at DESC LIMIT 5000",
      ),
    ]);
    return {
      profiles: (profilesResult.results || []).map(d1ProfileSummary),
      deletedProfiles: (deletionsResult.results || []).map((row) => ({
        id: row.id,
        deletedAt: row.deleted_at,
        deletedBy: row.deleted_by,
      })),
    };
  }

  const clauses = [];
  const bindings = [];
  if (options.query) {
    const escapedQuery = options.query
      .replaceAll("\\", "\\\\")
      .replaceAll("%", "\\%")
      .replaceAll("_", "\\_");
    const like = `%${escapedQuery}%`;
    clauses.push(`(
      id LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR
      phone LIKE ? ESCAPE '\\' OR created_by_username LIKE ? ESCAPE '\\' OR
      created_by_display_name LIKE ? ESCAPE '\\' OR updated_by_username LIKE ? ESCAPE '\\' OR
      updated_by_display_name LIKE ? ESCAPE '\\'
    )`);
    bindings.push(like, like, like, like, like, like, like, like);
  }
  if (options.owner === "created") {
    clauses.push("created_by_username = ?");
    bindings.push(username);
  } else if (options.owner === "updated") {
    clauses.push("updated_by_username = ?");
    bindings.push(username);
  } else if (options.owner === "involved") {
    clauses.push("(created_by_username = ? OR updated_by_username = ?)");
    bindings.push(username, username);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const countStatement = env.CLIENTS_DB.prepare(
    `SELECT COUNT(*) AS total FROM client_profiles ${where}`,
  ).bind(...bindings);
  const count = await countStatement.first();
  const total = Number(count?.total) || 0;
  const totalPages = Math.max(1, Math.ceil(total / options.pageSize));
  const page = Math.min(options.page, totalPages);
  const offset = (page - 1) * options.pageSize;
  const result = await env.CLIENTS_DB.prepare(
    `SELECT * FROM client_profiles ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...bindings, options.pageSize, offset)
    .all();
  return {
    profiles: (result.results || []).map(d1ProfileSummary),
    deletedProfiles: [],
    pagination: {
      page,
      pageSize: options.pageSize,
      total,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    },
  };
}

async function listProfiles(env, origin, ctx, actor, searchParams) {
  const options = clientProfileListOptions(searchParams);
  const username = normalizeUsername(actor?.username) || "unknown";
  if (env.CLIENTS_DB) {
    try {
      if (await clientIndexReady(env)) {
        const result = await readD1ProfileIndex(env, options, username);
        return json({ ...result, indexSource: "d1" }, 200, origin);
      }
      const r2Index = await readR2ProfileIndex(env);
      ctx?.waitUntil(rebuildClientProfileIndexData(env, r2Index));
      return json(
        { ...paginateR2ProfileIndex(r2Index, options, username), indexSource: "r2-backfill" },
        200,
        origin,
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "client_index_fallback",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }
  return json(
    {
      ...paginateR2ProfileIndex(await readR2ProfileIndex(env), options, username),
      indexSource: "r2",
    },
    200,
    origin,
  );
}

async function rebuildClientProfileIndexData(env, existingIndex) {
  await setClientIndexReady(env, false);
  const index = existingIndex ?? (await readR2ProfileIndex(env));
  await env.CLIENTS_DB.batch([
    env.CLIENTS_DB.prepare("DELETE FROM client_profiles"),
    env.CLIENTS_DB.prepare("DELETE FROM client_profile_deletions"),
  ]);

  const statements = [
    ...index.profiles.map((profile) =>
      env.CLIENTS_DB.prepare(CLIENT_PROFILE_INDEX_UPSERT).bind(
        ...profileIndexBindings(profile, profile.size),
      ),
    ),
    ...index.deletedProfiles.map((deleted) =>
      env.CLIENTS_DB.prepare(
        `INSERT INTO client_profile_deletions (id, deleted_at, deleted_by) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET deleted_at = excluded.deleted_at, deleted_by = excluded.deleted_by`,
      ).bind(deleted.id, deleted.deletedAt, deleted.deletedBy),
    ),
  ];
  for (let offset = 0; offset < statements.length; offset += 80) {
    await env.CLIENTS_DB.batch(statements.slice(offset, offset + 80));
  }
  await setClientIndexReady(env, true);
  return index;
}

async function rebuildClientProfileIndex(env, origin) {
  if (!env.CLIENTS_DB) return json({ error: "Binding D1 CLIENTS_DB absent." }, 503, origin);
  const index = await rebuildClientProfileIndexData(env);
  return json(
    {
      ok: true,
      profiles: index.profiles.length,
      deletedProfiles: index.deletedProfiles.length,
      indexSource: "d1",
    },
    200,
    origin,
  );
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

function clientProfileActor(user) {
  return {
    username: normalizeUsername(user?.username) || "unknown",
    displayName: String(user?.displayName || user?.username || "Profil").slice(0, 120),
    role: normalizeAccountRole(user?.role),
  };
}

function storedProfileActor(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !USERNAME_PATTERN.test(normalizeUsername(value.username))
  )
    return undefined;
  return {
    username: normalizeUsername(value.username),
    displayName: String(value.displayName || value.username).slice(0, 120),
    role: normalizeAccountRole(value.role),
  };
}

function storedProfileRevision(profile) {
  const revision = Number(profile?.revision);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

function profileConflict(origin, profile) {
  return json(
    {
      error:
        "Ce profil a été modifié dans une autre session. Rechargez la version partagée avant de fusionner ou de remplacer vos changements.",
      code: "CLIENT_PROFILE_CONFLICT",
      current: profile
        ? {
            revision: storedProfileRevision(profile),
            updatedAt: typeof profile.updatedAt === "string" ? profile.updatedAt : "",
            updatedBy: storedProfileActor(profile.updatedBy),
          }
        : undefined,
    },
    409,
    origin,
  );
}

function profileLocked(origin, profile) {
  return json(
    {
      error:
        "Ce CV est validé et verrouillé. Un administrateur doit le repasser en brouillon avant toute modification.",
      code: "CLIENT_PROFILE_LOCKED",
      current: profile
        ? {
            revision: storedProfileRevision(profile),
            updatedAt: typeof profile.updatedAt === "string" ? profile.updatedAt : "",
            updatedBy: storedProfileActor(profile.updatedBy),
            workflowStatus: normalizeClientWorkflowStatus(profile.workflowStatus),
          }
        : undefined,
    },
    423,
    origin,
  );
}

function clientProfileMetadata(profile) {
  const creator = storedProfileActor(profile.createdBy);
  const editor = storedProfileActor(profile.updatedBy);
  const workflowEditor = storedProfileActor(profile.workflowUpdatedBy);
  return {
    id: profile.id,
    revision: String(storedProfileRevision(profile)),
    name: String(profile.name || "Profil sans nom").slice(0, 180),
    email: String(profile.email || "").slice(0, 180),
    phone: String(profile.phone || "").slice(0, 80),
    language: String(profile.language || "fr").slice(0, 8),
    createdAt: String(profile.createdAt || profile.updatedAt || "").slice(0, 40),
    updatedAt: String(profile.updatedAt || "").slice(0, 40),
    hasPhoto: profile.photoAsset?.r2Key ? "true" : "false",
    workflowStatus: normalizeClientWorkflowStatus(profile.workflowStatus),
    workflowUpdatedAt: String(profile.workflowUpdatedAt || "").slice(0, 40),
    ...(creator
      ? {
          createdByUsername: creator.username,
          createdByDisplayName: creator.displayName,
          createdByRole: creator.role,
        }
      : {}),
    ...(editor
      ? {
          updatedByUsername: editor.username,
          updatedByDisplayName: editor.displayName,
          updatedByRole: editor.role,
        }
      : {}),
    ...(Number.isSafeInteger(profile.restoredFromRevision)
      ? { restoredFromRevision: String(profile.restoredFromRevision) }
      : {}),
    ...(workflowEditor
      ? {
          workflowUpdatedByUsername: workflowEditor.username,
          workflowUpdatedByDisplayName: workflowEditor.displayName,
          workflowUpdatedByRole: workflowEditor.role,
        }
      : {}),
  };
}

async function snapshotProfileVersion(env, profile, raw = JSON.stringify(profile)) {
  const revision = storedProfileRevision(profile);
  if (!revision) return;
  await env.CLIENTS_BUCKET.put(profileVersionKey(profile.id, revision), raw, {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: clientProfileMetadata(profile),
  });
}

async function snapshotCurrentProfilePhoto(env, id, revision) {
  if (!Number.isSafeInteger(revision) || revision < 1) return false;
  const currentPhoto = await env.CLIENTS_BUCKET.get(profilePhotoKey(id));
  if (!currentPhoto) return false;
  const photoBytes = await new Response(currentPhoto.body).arrayBuffer();
  const stored = await env.CLIENTS_BUCKET.put(profileVersionPhotoKey(id, revision), photoBytes, {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "image/webp" },
    customMetadata: {
      id,
      revision: String(revision),
      updatedAt: currentPhoto.customMetadata?.updatedAt || new Date().toISOString(),
      size: String(photoBytes.byteLength),
    },
  });
  return Boolean(stored);
}

async function ensureCurrentProfileSnapshot(env, id) {
  const object = await env.CLIENTS_BUCKET.get(`clients/${id}.json`);
  if (!object) return null;
  let profile;
  try {
    profile = JSON.parse(await object.text());
  } catch {
    return null;
  }
  await snapshotProfileVersion(env, profile);
  if (profile.photoAsset?.r2Key) {
    await snapshotCurrentProfilePhoto(env, id, storedProfileRevision(profile));
  }
  return profile;
}

async function archiveClientInTrash(env, profile, actor, deletedAt) {
  const id = profile.id;
  const expiresAt = new Date(
    Date.parse(deletedAt) + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const photo = await env.CLIENTS_BUCKET.get(profilePhotoKey(id));
  const photoBytes = photo ? await new Response(photo.body).arrayBuffer() : null;
  const deletedBy = clientProfileActor(actor);
  const manifest = {
    version: 1,
    id,
    name: String(profile.name || "Profil sans nom").slice(0, 180),
    deletedAt,
    expiresAt,
    deletedBy,
    revision: storedProfileRevision(profile),
    hasPhoto: Boolean(photoBytes),
  };
  const writes = [
    env.CLIENTS_BUCKET.put(trashProfileKey(id), JSON.stringify(profile), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: clientProfileMetadata(profile),
    }),
    env.CLIENTS_BUCKET.put(trashManifestKey(id), JSON.stringify(manifest), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: {
        id,
        name: manifest.name,
        deletedAt,
        expiresAt,
        deletedByUsername: deletedBy.username,
        deletedByDisplayName: deletedBy.displayName,
        deletedByRole: deletedBy.role,
        revision: String(manifest.revision),
        hasPhoto: manifest.hasPhoto ? "true" : "false",
      },
    }),
  ];
  if (photoBytes) {
    writes.push(
      env.CLIENTS_BUCKET.put(trashPhotoKey(id), photoBytes, {
        httpMetadata: { contentType: "image/webp" },
        customMetadata: {
          id,
          deletedAt,
          size: String(photoBytes.byteLength),
        },
      }),
    );
  }
  await Promise.all(writes);
  return manifest;
}

async function readTrashManifests(env) {
  const items = [];
  let cursor;
  do {
    const page = await env.CLIENTS_BUCKET.list({
      prefix: "trash/clients/",
      cursor,
      include: ["customMetadata"],
      limit: 500,
    });
    for (const object of page.objects) {
      if (!object.key.endsWith("/manifest.json")) continue;
      const metadata = object.customMetadata || {};
      const id = metadata.id || object.key.split("/")[2];
      if (!ID_PATTERN.test(id)) continue;
      items.push({
        id,
        name: metadata.name || "Profil sans nom",
        deletedAt: metadata.deletedAt || object.uploaded.toISOString(),
        expiresAt: metadata.expiresAt || object.uploaded.toISOString(),
        deletedBy: {
          username: metadata.deletedByUsername || "unknown",
          displayName: metadata.deletedByDisplayName || metadata.deletedByUsername || "Profil",
          role: normalizeAccountRole(metadata.deletedByRole),
        },
        revision: Number(metadata.revision) || 0,
        hasPhoto: metadata.hasPhoto === "true",
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return items.sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
}

async function listTrash(env, origin) {
  const items = await readTrashManifests(env);
  return json({ items, retentionDays: TRASH_RETENTION_DAYS }, 200, origin);
}

async function purgeTrashData(env, id) {
  const keys = [trashManifestKey(id), trashProfileKey(id), trashPhotoKey(id)];
  let cursor;
  do {
    const page = await env.CLIENTS_BUCKET.list({
      prefix: `${CLIENT_HISTORY_PREFIX}${id}/`,
      cursor,
      limit: 500,
    });
    keys.push(...page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  for (let offset = 0; offset < keys.length; offset += 500)
    await env.CLIENTS_BUCKET.delete(keys.slice(offset, offset + 500));
  return keys.length;
}

async function restoreTrashProfile(request, env, id, actor, origin, ctx) {
  const [manifest, archived, active] = await Promise.all([
    readR2Json(env, trashManifestKey(id)),
    readR2Json(env, trashProfileKey(id)),
    readR2Json(env, `clients/${id}.json`),
  ]);
  if (!manifest || !archived)
    return json({ error: "Ce profil n’est plus disponible dans la corbeille." }, 404, origin);
  if (active) return json({ error: "Un profil actif utilise déjà cet identifiant." }, 409, origin);
  const archivedPhoto = manifest.hasPhoto ? await env.CLIENTS_BUCKET.get(trashPhotoKey(id)) : null;
  if (manifest.hasPhoto && !archivedPhoto)
    return json(
      { error: "La photo archivée est manquante. Restauration interrompue." },
      409,
      origin,
    );
  const now = new Date().toISOString();
  const restored = {
    ...archived,
    revision: storedProfileRevision(archived) + 1,
    updatedAt: now,
    updatedBy: clientProfileActor(actor),
    restoredFromTrash: true,
  };
  const raw = JSON.stringify(restored);
  const photoBytes = archivedPhoto ? await new Response(archivedPhoto.body).arrayBuffer() : null;
  if (photoBytes) {
    await env.CLIENTS_BUCKET.put(profilePhotoKey(id), photoBytes, {
      httpMetadata: { contentType: "image/webp" },
      customMetadata: { id, updatedAt: now, size: String(photoBytes.byteLength) },
    });
  }
  const stored = await env.CLIENTS_BUCKET.put(`clients/${id}.json`, raw, {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: clientProfileMetadata(restored),
  });
  if (!stored) return json({ error: "Le profil a déjà été restauré." }, 409, origin);
  await Promise.all([
    snapshotProfileVersion(env, restored, raw),
    env.CLIENTS_BUCKET.delete([
      trashManifestKey(id),
      trashProfileKey(id),
      trashPhotoKey(id),
      profileDeletedKey(id),
    ]),
  ]);
  await maintainClientProfileIndex(env, () => upsertClientProfileIndex(env, restored, stored.size));
  ctx.waitUntil(
    writeAudit(env, request, "client_trash_restored", actor.username, "success", {
      clientId: id,
      revision: restored.revision,
    }),
  );
  return json({ ok: true, profile: restored }, 200, origin);
}

async function purgeTrashProfile(request, env, id, actor, origin, ctx, confirmation) {
  const manifest = await readR2Json(env, trashManifestKey(id));
  if (!manifest)
    return json({ error: "Ce profil n’est plus disponible dans la corbeille." }, 404, origin);
  const expected = `SUPPRIMER ${id}`;
  if (confirmation !== expected)
    return json({ error: `Confirmation requise : ${expected}` }, 422, origin);
  const deletedObjects = await purgeTrashData(env, id);
  ctx.waitUntil(
    writeAudit(env, request, "client_trash_purged", actor.username, "success", {
      clientId: id,
      deletedObjects,
    }),
  );
  return json({ ok: true, id, deletedObjects }, 200, origin);
}

function trashProfileRoute(pathname) {
  const match = pathname.match(/^\/api\/admin\/trash\/(ZGR-\d{8}-[A-Z0-9]{6,12})(\/restore)?$/);
  return match ? { id: match[1], restore: Boolean(match[2]) } : null;
}

async function listProfileVersions(env, id, origin) {
  const current = await ensureCurrentProfileSnapshot(env, id);
  if (!current) return json({ error: "Profil introuvable." }, 404, origin);
  const versions = [];
  let cursor;
  do {
    const page = await env.CLIENTS_BUCKET.list({
      prefix: `${CLIENT_HISTORY_PREFIX}${id}/`,
      cursor,
      include: ["customMetadata"],
      limit: 500,
    });
    for (const object of page.objects) {
      if (!object.key.endsWith(".json")) continue;
      const metadata = object.customMetadata || {};
      const revision = Number(metadata.revision || object.key.match(/(\d+)\.json$/)?.[1]);
      if (!Number.isSafeInteger(revision) || revision < 1) continue;
      versions.push({
        revision,
        updatedAt: metadata.updatedAt || object.uploaded.toISOString(),
        updatedBy: metadata.updatedByUsername
          ? {
              username: metadata.updatedByUsername,
              displayName: metadata.updatedByDisplayName || metadata.updatedByUsername,
              role: normalizeAccountRole(metadata.updatedByRole),
            }
          : undefined,
        restoredFromRevision: Number(metadata.restoredFromRevision) || undefined,
        workflowStatus: normalizeClientWorkflowStatus(metadata.workflowStatus),
        hasPhoto: metadata.hasPhoto === "true",
        size: object.size,
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  versions.sort((left, right) => right.revision - left.revision);
  return json({ id, currentRevision: storedProfileRevision(current), versions }, 200, origin);
}

async function getProfileVersion(env, target, origin) {
  const current = await env.CLIENTS_BUCKET.get(`clients/${target.id}.json`);
  if (!current) return json({ error: "Profil introuvable." }, 404, origin);
  const historical = await readR2Json(env, profileVersionKey(target.id, target.revision));
  if (!historical) return json({ error: "Cette version n’existe plus." }, 404, origin);
  return json(
    {
      id: target.id,
      revision: target.revision,
      profile: historical,
    },
    200,
    origin,
  );
}

async function restoreProfileVersion(request, env, target, actor, origin, ctx) {
  let value;
  try {
    value = (await readJson(request, 4_096)).value;
  } catch (error) {
    if (error instanceof Response)
      return json({ error: "Requête de restauration invalide." }, 400, origin);
    throw error;
  }
  const expectedRevision = Number(value?.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    return json({ error: "Révision courante attendue invalide." }, 422, origin);
  }
  const profileKey = `clients/${target.id}.json`;
  const currentObject = await env.CLIENTS_BUCKET.get(profileKey);
  if (!currentObject) return json({ error: "Profil introuvable." }, 404, origin);
  let current;
  try {
    current = JSON.parse(await currentObject.text());
  } catch {
    return json({ error: "Le profil partagé existant est illisible." }, 500, origin);
  }
  if (normalizeClientWorkflowStatus(current.workflowStatus) === "approved")
    return profileLocked(origin, current);
  if (storedProfileRevision(current) !== expectedRevision) return profileConflict(origin, current);
  const historicalObject = await env.CLIENTS_BUCKET.get(
    profileVersionKey(target.id, target.revision),
  );
  if (!historicalObject) return json({ error: "Cette version n’existe plus." }, 404, origin);
  let historical;
  try {
    historical = JSON.parse(await historicalObject.text());
  } catch {
    return json({ error: "Cette version historique est illisible." }, 500, origin);
  }
  const historicalPhoto = historical.photoAsset?.r2Key
    ? await env.CLIENTS_BUCKET.get(profileVersionPhotoKey(target.id, target.revision))
    : null;
  if (historical.photoAsset?.r2Key && !historicalPhoto) {
    return json(
      { error: "La photo liée à cette version historique est indisponible." },
      409,
      origin,
    );
  }
  await snapshotProfileVersion(env, current);
  if (current.photoAsset?.r2Key) {
    await snapshotCurrentProfilePhoto(env, target.id, expectedRevision);
  }
  const now = new Date().toISOString();
  const editor = clientProfileActor(actor);
  const restored = {
    ...historical,
    id: target.id,
    revision: expectedRevision + 1,
    restoredFromRevision: target.revision,
    createdAt: current.createdAt || historical.createdAt || now,
    createdBy: storedProfileActor(current.createdBy) || storedProfileActor(historical.createdBy),
    updatedAt: now,
    updatedBy: editor,
    workflowStatus: normalizeClientWorkflowStatus(current.workflowStatus),
    workflowUpdatedAt: current.workflowUpdatedAt,
    workflowUpdatedBy: storedProfileActor(current.workflowUpdatedBy),
  };
  const storedRaw = JSON.stringify(restored);
  const storedObject = await env.CLIENTS_BUCKET.put(profileKey, storedRaw, {
    onlyIf: { etagMatches: currentObject.etag },
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: clientProfileMetadata(restored),
  });
  if (!storedObject) {
    return profileConflict(origin, await readR2Json(env, profileKey));
  }

  if (restored.photoAsset?.r2Key) {
    await env.CLIENTS_BUCKET.put(
      profilePhotoKey(target.id),
      await new Response(historicalPhoto.body).arrayBuffer(),
      {
        httpMetadata: { contentType: "image/webp" },
        customMetadata: {
          id: target.id,
          updatedAt: now,
          size: String(historicalPhoto.size),
        },
      },
    );
    await snapshotCurrentProfilePhoto(env, target.id, restored.revision);
  } else {
    await env.CLIENTS_BUCKET.delete(profilePhotoKey(target.id));
  }
  await snapshotProfileVersion(env, restored, storedRaw);
  await maintainClientProfileIndex(env, () =>
    upsertClientProfileIndex(env, restored, storedObject.size),
  );
  await env.CLIENTS_BUCKET.delete(profileDeletedKey(target.id));
  ctx.waitUntil(
    writeAudit(env, request, "client_version_restored", actor.username, "success", {
      clientId: target.id,
      restoredFromRevision: target.revision,
      revision: restored.revision,
    }),
  );
  return json(
    {
      ok: true,
      id: target.id,
      restoredFromRevision: target.revision,
      profile: {
        revision: restored.revision,
        createdAt: restored.createdAt,
        updatedAt: restored.updatedAt,
        createdBy: restored.createdBy,
        updatedBy: restored.updatedBy,
      },
    },
    200,
    origin,
  );
}

async function updateProfileWorkflow(request, env, id, actor, origin, ctx) {
  let value;
  try {
    value = (await readJson(request, 4_096)).value;
  } catch (error) {
    if (error instanceof Response)
      return json({ error: "Changement de statut invalide." }, 400, origin);
    throw error;
  }
  const targetStatus = value?.status;
  const expectedRevision = Number(value?.expectedRevision);
  if (!["draft", "review", "approved"].includes(targetStatus))
    return json({ error: "Statut de validation invalide." }, 422, origin);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
    return json({ error: "Révision courante attendue invalide." }, 422, origin);

  const profileKey = `clients/${id}.json`;
  const currentObject = await env.CLIENTS_BUCKET.get(profileKey);
  if (!currentObject) return json({ error: "Profil introuvable." }, 404, origin);
  let current;
  try {
    current = JSON.parse(await currentObject.text());
  } catch {
    return json({ error: "Le profil partagé existant est illisible." }, 500, origin);
  }
  if (storedProfileRevision(current) !== expectedRevision) return profileConflict(origin, current);
  const currentStatus = normalizeClientWorkflowStatus(current.workflowStatus);
  if (currentStatus === targetStatus)
    return json({ ok: true, id, unchanged: true, profile: current }, 200, origin);

  const role = normalizeAccountRole(actor.role);
  const adminTransition =
    role === "admin" &&
    ((currentStatus === "draft" && targetStatus === "review") ||
      (currentStatus === "review" && (targetStatus === "draft" || targetStatus === "approved")) ||
      (currentStatus === "approved" && targetStatus === "draft"));
  const editorTransition =
    role === "editor" &&
    ((currentStatus === "draft" && targetStatus === "review") ||
      (currentStatus === "review" && targetStatus === "draft"));
  if (!adminTransition && !editorTransition)
    return json(
      { error: "Cette transition de validation n’est pas autorisée pour votre rôle." },
      403,
      origin,
    );

  const now = new Date().toISOString();
  const workflowEditor = clientProfileActor(actor);
  const updated = {
    ...current,
    revision: expectedRevision + 1,
    updatedAt: now,
    updatedBy: workflowEditor,
    workflowStatus: targetStatus,
    workflowUpdatedAt: now,
    workflowUpdatedBy: workflowEditor,
  };
  const raw = JSON.stringify(updated);
  await snapshotProfileVersion(env, current);
  if (current.photoAsset?.r2Key) await snapshotCurrentProfilePhoto(env, id, expectedRevision);
  const storedObject = await env.CLIENTS_BUCKET.put(profileKey, raw, {
    onlyIf: { etagMatches: currentObject.etag },
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: clientProfileMetadata(updated),
  });
  if (!storedObject) return profileConflict(origin, await readR2Json(env, profileKey));
  await snapshotProfileVersion(env, updated, raw);
  if (updated.photoAsset?.r2Key) await snapshotCurrentProfilePhoto(env, id, updated.revision);
  await maintainClientProfileIndex(env, () =>
    upsertClientProfileIndex(env, updated, storedObject.size),
  );
  const event =
    targetStatus === "approved"
      ? "client_workflow_approved"
      : targetStatus === "review"
        ? "client_workflow_submitted"
        : currentStatus === "approved"
          ? "client_workflow_reopened"
          : "client_workflow_withdrawn";
  ctx.waitUntil(
    writeAudit(env, request, event, actor.username, "success", {
      clientId: id,
      from: currentStatus,
      to: targetStatus,
      revision: updated.revision,
    }),
  );
  return json({ ok: true, id, profile: updated }, 200, origin);
}

async function putProfile(request, env, id, actor, origin, ctx) {
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

  if (
    profile.revision !== undefined &&
    (!Number.isSafeInteger(profile.revision) || profile.revision < 0)
  )
    return json({ error: "Révision du profil invalide." }, 422, origin);

  const profileKey = `clients/${id}.json`;
  const previousObject = await env.CLIENTS_BUCKET.get(profileKey);
  let previous = null;
  if (previousObject) {
    try {
      previous = JSON.parse(await previousObject.text());
    } catch {
      return json({ error: "Le profil partagé existant est illisible." }, 500, origin);
    }
  }
  if (previous && normalizeClientWorkflowStatus(previous.workflowStatus) === "approved")
    return profileLocked(origin, previous);
  const expectedRevision = storedProfileRevision(profile);
  const currentRevision = storedProfileRevision(previous);
  if ((previous && expectedRevision !== currentRevision) || (!previous && expectedRevision !== 0)) {
    ctx.waitUntil(
      writeAudit(env, request, "client_conflict", actor.username, "rejected", {
        clientId: id,
        expectedRevision,
        currentRevision,
      }),
    );
    return profileConflict(origin, previous);
  }

  const now = new Date().toISOString();
  const editor = clientProfileActor(actor);
  const creator = previous ? storedProfileActor(previous.createdBy) : editor;
  const workflowStatus = previous
    ? normalizeClientWorkflowStatus(previous.workflowStatus)
    : "draft";
  const storedProfile = {
    ...profile,
    revision: currentRevision + 1,
    createdAt:
      previous && typeof previous.createdAt === "string"
        ? previous.createdAt
        : typeof profile.createdAt === "string"
          ? profile.createdAt
          : now,
    updatedAt: now,
    createdBy: creator,
    updatedBy: editor,
    workflowStatus,
    workflowUpdatedAt: previous?.workflowUpdatedAt || now,
    workflowUpdatedBy: storedProfileActor(previous?.workflowUpdatedBy) || creator,
  };
  const storedRaw = JSON.stringify(storedProfile);

  if (previous) {
    await snapshotProfileVersion(env, previous);
    if (previous.photoAsset?.r2Key) await snapshotCurrentProfilePhoto(env, id, currentRevision);
  }

  const storedObject = await env.CLIENTS_BUCKET.put(profileKey, storedRaw, {
    onlyIf: previousObject ? { etagMatches: previousObject.etag } : { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: clientProfileMetadata(storedProfile),
  });
  if (!storedObject) {
    const latest = await readR2Json(env, profileKey);
    ctx.waitUntil(
      writeAudit(env, request, "client_conflict", actor.username, "rejected", {
        clientId: id,
        expectedRevision,
        currentRevision: storedProfileRevision(latest),
      }),
    );
    return profileConflict(origin, latest);
  }
  await snapshotProfileVersion(env, storedProfile, storedRaw);
  if (storedProfile.photoAsset?.r2Key) {
    await snapshotCurrentProfilePhoto(env, id, storedProfile.revision);
  }
  await maintainClientProfileIndex(env, () =>
    upsertClientProfileIndex(env, storedProfile, storedObject.size),
  );
  await env.CLIENTS_BUCKET.delete(profileDeletedKey(id));
  ctx.waitUntil(
    writeAudit(
      env,
      request,
      previous ? "client_updated" : "client_created",
      actor.username,
      "success",
      {
        clientId: id,
      },
    ),
  );
  return json(
    {
      ok: true,
      id,
      profile: {
        revision: storedProfile.revision,
        createdAt: storedProfile.createdAt,
        updatedAt: storedProfile.updatedAt,
        createdBy: storedProfile.createdBy,
        updatedBy: storedProfile.updatedBy,
        workflowStatus: storedProfile.workflowStatus,
        workflowUpdatedAt: storedProfile.workflowUpdatedAt,
        workflowUpdatedBy: storedProfile.workflowUpdatedBy,
      },
    },
    200,
    origin,
  );
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

async function aiEncryptionKey(env, usages) {
  if (typeof env.SESSION_SECRET !== "string" || env.SESSION_SECRET.length < 40) return null;
  const raw = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${env.SESSION_SECRET}:zgr-ai-keys:v1`),
  );
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, usages);
}

async function readManagedAiKeys(env) {
  const encrypted = await readR2Json(env, AI_KEYS_OBJECT);
  if (!encrypted) return [];
  if (typeof encrypted.iv !== "string" || typeof encrypted.ciphertext !== "string") return [];
  const key = await aiEncryptionKey(env, ["decrypt"]);
  if (!key) return [];
  try {
    const clear = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodeBase64Url(encrypted.iv) },
      key,
      decodeBase64Url(encrypted.ciphertext),
    );
    const parsed = JSON.parse(decoder.decode(clear));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        ["gemini", "openrouter"].includes(item.provider) &&
        typeof item.key === "string",
    );
  } catch {
    return [];
  }
}

async function writeManagedAiKeys(env, entries) {
  const key = await aiEncryptionKey(env, ["encrypt"]);
  if (!key) throw new Error("Clé de chiffrement IA indisponible.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(entries)),
  );
  await env.CLIENTS_BUCKET.put(
    AI_KEYS_OBJECT,
    JSON.stringify({
      version: 1,
      iv: encodeBase64Url(iv),
      ciphertext: encodeBase64Url(ciphertext),
    }),
    { httpMetadata: { contentType: "application/json; charset=utf-8" } },
  );
}

async function providerKeys(provider, env) {
  const environmentKeys = secretKeys(
    provider === "gemini" ? env.GEMINI_API_KEYS : env.OPENROUTER_API_KEYS,
  );
  const managedKeys = (await readManagedAiKeys(env))
    .filter((entry) => entry.provider === provider)
    .map((entry) => entry.key);
  return [...new Set([...managedKeys, ...environmentKeys])];
}

async function modelsForProviderKey(provider, key) {
  const response =
    provider === "gemini"
      ? await fetchProvider(
          "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
          { headers: { "x-goog-api-key": key } },
        )
      : await fetchProvider("https://openrouter.ai/api/v1/models?output_modalities=text", {
          headers: { Authorization: `Bearer ${key}` },
        });
  if (!response.ok) {
    const error = await providerError(response, "Impossible de charger les modèles.");
    throw Object.assign(new Error(error.message), { status: error.status });
  }
  const body = await response.json();
  if (provider === "gemini") {
    return (Array.isArray(body.models) ? body.models : []).flatMap((model) => {
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
  }
  return (Array.isArray(body.data) ? body.data : []).flatMap((model) => {
    if (!model || typeof model.id !== "string") return [];
    const promptPrice = Number(model.pricing?.prompt);
    const completionPrice = Number(model.pricing?.completion);
    const free = model.id.endsWith(":free") || (promptPrice === 0 && completionPrice === 0);
    return [{ id: model.id, name: typeof model.name === "string" ? model.name : model.id, free }];
  });
}

function preferredProbeModel(provider, models, requestedModel = "") {
  const requested = requestedModel.replace(/^models\//, "");
  if (requested && models.some((model) => model.id === requested)) return requested;
  const preferred =
    provider === "gemini"
      ? ["gemini-2.5-flash", "gemini-2.5-flash-lite"]
      : [
          "openrouter/free",
          "google/gemini-2.5-flash-lite:free",
          "openai/gpt-oss-20b:free",
          "meta-llama/llama-3.3-70b-instruct:free",
        ];
  return (
    preferred.find((id) => models.some((model) => model.id === id)) ||
    models.find((model) => model.free)?.id ||
    models[0]?.id ||
    ""
  );
}

async function probeProviderKey(provider, key, models, requestedModel = "") {
  const model = preferredProbeModel(provider, models, requestedModel);
  if (!model) throw Object.assign(new Error("Aucun modèle de texte disponible."), { status: 422 });
  const response =
    provider === "gemini"
      ? await fetchProvider(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: "Réponds uniquement en JSON valide." }] },
              contents: [
                { role: "user", parts: [{ text: 'Réponds exactement avec {"status":"ok"}.' }] },
              ],
              generationConfig: { temperature: 0, responseMimeType: "application/json" },
            }),
          },
          20_000,
        )
      : await fetchProvider(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
              "X-OpenRouter-Title": "ZGR CV AI Assistant",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: "Réponds uniquement en JSON valide." },
                { role: "user", content: 'Réponds exactement avec {"status":"ok"}.' },
              ],
              temperature: 0,
              response_format: { type: "json_object" },
            }),
          },
          20_000,
        );
  if (!response.ok) {
    const error = await providerError(response, `Échec du test ${provider}.`);
    throw Object.assign(new Error(error.message), { status: error.status });
  }
  const body = await response.json();
  const text =
    provider === "gemini"
      ? Array.isArray(body?.candidates?.[0]?.content?.parts)
        ? body.candidates[0].content.parts.map((part) => part?.text || "").join("")
        : ""
      : body?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim())
    throw Object.assign(new Error("Le test n’a renvoyé aucun contenu exploitable."), {
      status: 502,
    });
  return {
    model,
    tokens: Number(body?.usageMetadata?.totalTokenCount || body?.usage?.total_tokens) || 0,
  };
}

function validProviderKey(provider, key) {
  if (typeof key !== "string" || key.length < 20 || key.length > 500) return false;
  if (provider === "gemini") return /^(?:AIza|AQ\.)[A-Za-z0-9_-]+$/.test(key);
  return /^sk-or-v1-[A-Za-z0-9_-]+$/.test(key);
}

async function aiKeyStatus(env, origin) {
  const managed = await readManagedAiKeys(env);
  const providers = {};
  for (const provider of ["gemini", "openrouter"]) {
    const environment = secretKeys(
      provider === "gemini" ? env.GEMINI_API_KEYS : env.OPENROUTER_API_KEYS,
    );
    const managedForProvider = managed.filter((entry) => entry.provider === provider);
    const managedValues = new Set(managedForProvider.map((entry) => entry.key));
    providers[provider] = {
      environmentCount: new Set(environment.filter((key) => !managedValues.has(key))).size,
      managed: managedForProvider.map((entry, index) => ({
        id: entry.id,
        label: entry.label || "Clé interface",
        last4: entry.key.slice(-4),
        createdAt: entry.createdAt,
        priority: index + 1,
      })),
    };
  }
  return json({ providers }, 200, origin);
}

async function saveAiKey(request, env, actor, origin, ctx) {
  let payload;
  try {
    payload = (await readJson(request, MAX_ACCOUNT_BYTES)).value;
  } catch (error) {
    if (error instanceof Response)
      return json({ error: "Clé API invalide." }, error.status, origin);
    throw error;
  }
  const provider =
    payload?.provider === "openrouter"
      ? "openrouter"
      : payload?.provider === "gemini"
        ? "gemini"
        : null;
  const key = typeof payload?.key === "string" ? payload.key.trim() : "";
  const mode = payload?.mode === "replace" ? "replace" : "add";
  const label =
    typeof payload?.label === "string" ? payload.label.trim().slice(0, 80) : "Clé interface";
  if (!provider || !validProviderKey(provider, key))
    return json(
      { error: "Le format de la clé API ne correspond pas au fournisseur choisi." },
      422,
      origin,
    );
  let models;
  let probe;
  try {
    models = await modelsForProviderKey(provider, key);
    if (!models.length)
      return json(
        { error: "Clé valide, mais aucun modèle de texte compatible n’a été trouvé." },
        422,
        origin,
      );
    probe = await probeProviderKey(
      provider,
      key,
      models,
      typeof payload?.model === "string" ? payload.model.trim() : "",
    );
  } catch (error) {
    const status = Number(error?.status);
    return json(
      {
        error: `Test de la clé refusé : ${error instanceof Error ? error.message : "erreur inconnue"}`,
      },
      status >= 400 && status <= 599 ? status : 502,
      origin,
    );
  }
  const current = await readManagedAiKeys(env);
  const kept =
    mode === "replace" ? current.filter((entry) => entry.provider !== provider) : current;
  if (kept.some((entry) => entry.provider === provider && entry.key === key))
    return json({ error: "Cette clé est déjà enregistrée." }, 409, origin);
  const entry = {
    id: crypto.randomUUID(),
    provider,
    key,
    label: label || "Clé interface",
    createdAt: new Date().toISOString(),
  };
  await writeManagedAiKeys(env, [...kept, entry]);
  ctx.waitUntil(
    writeAudit(env, request, "ai_key_saved", actor.username, "success", { provider, mode }),
  );
  return json(
    {
      ok: true,
      id: entry.id,
      last4: key.slice(-4),
      model: probe.model,
      models,
      generationVerified: true,
      tokens: probe.tokens,
    },
    201,
    origin,
  );
}

function aiKeyId(pathname) {
  const match = pathname.match(/^\/api\/admin\/ai-keys\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function deleteAiKey(request, env, actor, id, origin, ctx) {
  const current = await readManagedAiKeys(env);
  const target = current.find((entry) => entry.id === id);
  if (!target)
    return json({ error: "Clé interface introuvable ou gérée par Cloudflare." }, 404, origin);
  await writeManagedAiKeys(
    env,
    current.filter((entry) => entry.id !== id),
  );
  ctx.waitUntil(
    writeAudit(env, request, "ai_key_deleted", actor.username, "success", {
      provider: target.provider,
    }),
  );
  return json({ ok: true }, 200, origin);
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
  const keys = await providerKeys(provider, env);
  if (!keys.length)
    return json({ error: `Aucune clé ${provider} configurée côté serveur.` }, 503, origin);
  const failures = [];
  for (const key of keys) {
    try {
      const models = await modelsForProviderKey(provider, key);
      if (models.length) return json({ models }, 200, origin);
      failures.push("aucun modèle compatible");
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "erreur inconnue");
    }
  }
  return json(
    { error: `Toutes les clés ${provider} ont échoué. ${failures.join(" · ").slice(0, 700)}` },
    503,
    origin,
  );
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

  const keys = await providerKeys(provider, env);
  if (!keys.length)
    return json({ error: `Aucune clé ${provider} configurée côté serveur.` }, 503, origin);
  const orderedKeys = keys;
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

function portalConfiguration(env) {
  const baseUrl = String(env.CLIENT_PORTAL_API_URL || "")
    .trim()
    .replace(/\/$/, "");
  const token = String(env.CLIENT_PORTAL_ADMIN_TOKEN || "").trim();
  return baseUrl && token ? { baseUrl, token } : null;
}

function clientOrderPortalPath(pathname) {
  const root = "/api/admin/client-orders";
  if (pathname === root) return "/api/admin/orders";
  if (!pathname.startsWith(`${root}/`)) return null;
  return `/api/admin/orders/${pathname.slice(root.length + 1)}`;
}

async function proxyClientOrders(request, env, origin, pathname) {
  const configuration = portalConfiguration(env);
  if (!configuration)
    return json(
      { error: "Le portail CV PRO TEAM Clients n’est pas encore connecté à ZGR CV." },
      503,
      origin,
    );
  const portalPath = clientOrderPortalPath(pathname);
  if (!portalPath) return json({ error: "Route de commande invalide." }, 404, origin);
  const incomingUrl = new URL(request.url);
  const target = new URL(`${configuration.baseUrl}${portalPath}`);
  target.search = incomingUrl.search;
  const headers = new Headers();
  headers.set("X-Admin-Token", configuration.token);
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  const outbound = new Request(target, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
  });
  const response = env.CLIENT_PORTAL_SERVICE?.fetch
    ? await env.CLIENT_PORTAL_SERVICE.fetch(outbound)
    : await fetch(outbound);
  const responseHeaders = new Headers(corsHeaders(origin));
  for (const header of [
    "Content-Type",
    "Content-Length",
    "Content-Disposition",
    "ETag",
    "Last-Modified",
  ]) {
    const value = response.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

async function copyR2Object(env, sourceKey, destinationKey) {
  const source = await env.CLIENTS_BUCKET.get(sourceKey);
  if (!source) return false;
  const bytes = await new Response(source.body).arrayBuffer();
  await env.CLIENTS_BUCKET.put(destinationKey, bytes, {
    httpMetadata: source.httpMetadata,
    customMetadata: source.customMetadata,
  });
  return true;
}

const BACKUP_STATUS_OBJECT = "system/backups/latest-status.json";

async function recordBackupStatus(env, status) {
  const checkedAt = new Date().toISOString();
  const value = { version: 1, checkedAt, ...status };
  await env.CLIENTS_BUCKET.put(BACKUP_STATUS_OBJECT, JSON.stringify(value), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: {
      state: value.state,
      checkedAt,
      day: String(value.day || "").slice(0, 10),
    },
  });
  return value;
}

async function r2PrefixInventory(env, prefix) {
  let cursor;
  let objects = 0;
  let bytes = 0;
  const manifestKeys = [];
  do {
    const page = await env.CLIENTS_BUCKET.list({ prefix, cursor, limit: 1000 });
    for (const object of page.objects) {
      objects += 1;
      bytes += Number(object.size) || 0;
      if (object.key.endsWith("/manifest.json")) manifestKeys.push(object.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return { objects, bytes, manifestKeys };
}

async function listR2ObjectKeys(env, prefix) {
  let cursor;
  const keys = [];
  do {
    const page = await env.CLIENTS_BUCKET.list({ prefix, cursor, limit: 1000 });
    keys.push(...page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

async function deleteR2ObjectKeys(env, keys) {
  for (let offset = 0; offset < keys.length; offset += 1000) {
    await env.CLIENTS_BUCKET.delete(keys.slice(offset, offset + 1000));
  }
}

async function copyR2Prefix(env, sourcePrefix, destinationPrefix) {
  const keys = await listR2ObjectKeys(env, sourcePrefix);
  let copied = 0;
  for (const key of keys) {
    const destinationKey = `${destinationPrefix}${key.slice(sourcePrefix.length)}`;
    if (await copyR2Object(env, key, destinationKey)) copied += 1;
  }
  return copied;
}

async function createMonthlyBackup(env, dailyRoot, dailyManifest) {
  const month = dailyManifest.day.slice(0, 7);
  const monthlyRoot = `backups/monthly/${month}`;
  const manifestKey = `${monthlyRoot}/manifest.json`;
  if (await readR2Json(env, manifestKey)) return { month, created: false };
  await copyR2Prefix(env, `${dailyRoot}/`, `${monthlyRoot}/`);
  const manifest = {
    ...dailyManifest,
    kind: "monthly",
    month,
    sourceDay: dailyManifest.day,
  };
  await env.CLIENTS_BUCKET.put(manifestKey, JSON.stringify(manifest), {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: { month, sourceDay: dailyManifest.day, createdAt: dailyManifest.createdAt },
  });
  return { month, created: true };
}

async function enforceBackupRetention(env, prefix, keep) {
  const keys = await listR2ObjectKeys(env, prefix);
  const periods = [
    ...new Set(keys.map((key) => key.slice(prefix.length).split("/", 1)[0]).filter(Boolean)),
  ].sort((left, right) => right.localeCompare(left));
  const expired = periods.slice(keep);
  const expiredSet = new Set(expired);
  const keysToDelete = keys.filter((key) =>
    expiredSet.has(key.slice(prefix.length).split("/", 1)[0]),
  );
  await deleteR2ObjectKeys(env, keysToDelete);
  return {
    kept: Math.min(periods.length, keep),
    removedPeriods: expired.length,
    removedObjects: keysToDelete.length,
  };
}

function backupRestoreTarget(pathname) {
  const match = pathname.match(
    /^\/api\/admin\/backups\/(daily|monthly|recovery)\/([^/]+)\/restore$/,
  );
  if (!match) return null;
  const kind = match[1];
  const period = decodeURIComponent(match[2]);
  if (kind === "daily" && !/^\d{4}-\d{2}-\d{2}$/.test(period)) return null;
  if (kind === "monthly" && !/^\d{4}-\d{2}$/.test(period)) return null;
  if (kind === "recovery" && !/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/.test(period)) return null;
  return { kind, period, root: `backups/${kind}/${period}` };
}

async function backupRestorePlan(env, target) {
  const manifest = await readR2Json(env, `${target.root}/manifest.json`);
  if (!manifest) return null;
  const [backupKeys, currentIndex] = await Promise.all([
    listR2ObjectKeys(env, `${target.root}/r2/clients/`),
    readR2ProfileIndex(env),
  ]);
  const backupProfileIds = new Set(
    backupKeys
      .filter((key) => key.endsWith(".json") && !key.endsWith(".deleted.json"))
      .map((key) => key.match(/\/clients\/([^/]+)\.json$/)?.[1])
      .filter(Boolean),
  );
  const currentProfileIds = new Set(currentIndex.profiles.map((profile) => profile.id));
  return {
    target,
    manifest,
    backupKeys,
    backupProfileIds,
    currentProfileIds,
    summary: {
      profilesInBackup: backupProfileIds.size,
      added: [...backupProfileIds].filter((id) => !currentProfileIds.has(id)).length,
      overwritten: [...backupProfileIds].filter((id) => currentProfileIds.has(id)).length,
      removed: [...currentProfileIds].filter((id) => !backupProfileIds.has(id)).length,
      objectsToRestore: backupKeys.length,
    },
    confirmation: `RESTAURER ${target.period}`,
  };
}

async function createRecoveryPoint(env, actor) {
  const createdAt = new Date().toISOString();
  const period = createdAt.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  const root = `backups/recovery/${period}`;
  const copied = await copyR2Prefix(env, "clients/", `${root}/r2/clients/`);
  const manifest = { version: 1, kind: "recovery", period, createdAt, copied, createdBy: actor };
  await env.CLIENTS_BUCKET.put(`${root}/manifest.json`, JSON.stringify(manifest), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: { period, createdAt, createdBy: actor.username },
  });
  await enforceBackupRetention(env, "backups/recovery/", 10);
  return manifest;
}

async function highestHistoricalRevisions(env) {
  const keys = await listR2ObjectKeys(env, CLIENT_HISTORY_PREFIX);
  const revisions = new Map();
  for (const key of keys) {
    const match = key.match(/^history\/clients\/([^/]+)\/(\d+)\.json$/);
    if (!match) continue;
    revisions.set(match[1], Math.max(revisions.get(match[1]) || 0, Number(match[2]) || 0));
  }
  return revisions;
}

async function readBackupD1Stats(env) {
  if (!env.CLIENTS_DB) return { available: false, profiles: 0, deletions: 0, indexReady: false };
  try {
    const [profiles, deletions, indexState] = await env.CLIENTS_DB.batch([
      env.CLIENTS_DB.prepare("SELECT COUNT(*) AS total FROM client_profiles"),
      env.CLIENTS_DB.prepare("SELECT COUNT(*) AS total FROM client_profile_deletions"),
      env.CLIENTS_DB.prepare(
        "SELECT value FROM system_state WHERE key = 'client_index_ready' LIMIT 1",
      ),
    ]);
    return {
      available: true,
      profiles: Number(profiles.results?.[0]?.total) || 0,
      deletions: Number(deletions.results?.[0]?.total) || 0,
      indexReady: indexState.results?.[0]?.value === "1",
    };
  } catch (error) {
    return {
      available: false,
      profiles: 0,
      deletions: 0,
      indexReady: false,
      error: error instanceof Error ? error.message : "D1 indisponible",
    };
  }
}

async function previewBackupRestore(env, target, origin) {
  const plan = await backupRestorePlan(env, target);
  if (!plan) return json({ error: "Sauvegarde introuvable." }, 404, origin);
  return json(
    {
      backup: plan.manifest,
      summary: plan.summary,
      confirmation: plan.confirmation,
      safety: "Un point de récupération est créé automatiquement avant toute modification.",
    },
    200,
    origin,
  );
}

async function restoreClientBackup(request, env, target, actor, origin, ctx) {
  let payload;
  try {
    payload = (await readJson(request, 4_096)).value;
  } catch (error) {
    if (error instanceof Response)
      return json({ error: "Confirmation de restauration invalide." }, 400, origin);
    throw error;
  }
  const plan = await backupRestorePlan(env, target);
  if (!plan) return json({ error: "Sauvegarde introuvable." }, 404, origin);
  if (payload?.confirmation !== plan.confirmation) {
    return json(
      { error: `Saisissez exactement « ${plan.confirmation} » pour autoriser la restauration.` },
      422,
      origin,
    );
  }

  const [currentIndex, historicalRevisions] = await Promise.all([
    readR2ProfileIndex(env),
    highestHistoricalRevisions(env),
  ]);
  const currentRevisions = new Map(
    currentIndex.profiles.map((profile) => [profile.id, storedProfileRevision(profile)]),
  );
  const recoveryPoint = await createRecoveryPoint(env, clientProfileActor(actor));
  const currentKeys = await listR2ObjectKeys(env, "clients/");
  await deleteR2ObjectKeys(env, currentKeys);
  await copyR2Prefix(env, `${target.root}/r2/clients/`, "clients/");

  const now = new Date().toISOString();
  const editor = clientProfileActor(actor);
  for (const id of plan.backupProfileIds) {
    const profileKey = `clients/${id}.json`;
    const restoredProfile = await readR2Json(env, profileKey);
    if (!restoredProfile) continue;
    const nextRevision =
      Math.max(
        storedProfileRevision(restoredProfile),
        currentRevisions.get(id) || 0,
        historicalRevisions.get(id) || 0,
      ) + 1;
    const restored = {
      ...restoredProfile,
      id,
      revision: nextRevision,
      updatedAt: now,
      updatedBy: editor,
      restoredFromBackup: { kind: target.kind, period: target.period },
    };
    const raw = JSON.stringify(restored);
    await env.CLIENTS_BUCKET.put(profileKey, raw, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: clientProfileMetadata(restored),
    });
    await snapshotProfileVersion(env, restored, raw);
    if (restored.photoAsset?.r2Key) {
      await snapshotCurrentProfilePhoto(env, id, nextRevision);
    }
  }

  for (const id of plan.currentProfileIds) {
    if (plan.backupProfileIds.has(id)) continue;
    const tombstoneKey = profileDeletedKey(id);
    if (await readR2Json(env, tombstoneKey)) continue;
    await env.CLIENTS_BUCKET.put(
      tombstoneKey,
      JSON.stringify({ id, deletedAt: now, deletedBy: actor.username }),
      {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
        customMetadata: { id, deletedAt: now, deletedBy: actor.username },
      },
    );
  }

  const rebuilt = env.CLIENTS_DB ? await rebuildClientProfileIndexData(env) : null;
  ctx.waitUntil(
    writeAudit(env, request, "client_backup_restored", actor.username, "success", {
      kind: target.kind,
      period: target.period,
      recoveryPoint: recoveryPoint.period,
      ...plan.summary,
    }),
  );
  return json(
    {
      ok: true,
      backup: plan.manifest,
      summary: plan.summary,
      recoveryPoint,
      profiles: rebuilt?.profiles.length ?? plan.backupProfileIds.size,
    },
    200,
    origin,
  );
}

async function backupMonitoring(env, origin) {
  const [clients, history, dailyBackups, monthlyBackups, recoveryPoints, system, latestStatus, d1] =
    await Promise.all([
      r2PrefixInventory(env, "clients/"),
      r2PrefixInventory(env, CLIENT_HISTORY_PREFIX),
      r2PrefixInventory(env, DAILY_BACKUP_PREFIX),
      r2PrefixInventory(env, "backups/monthly/"),
      r2PrefixInventory(env, "backups/recovery/"),
      r2PrefixInventory(env, "system/"),
      readR2Json(env, BACKUP_STATUS_OBJECT),
      readBackupD1Stats(env),
    ]);
  const manifestKeys = dailyBackups.manifestKeys.sort((left, right) => right.localeCompare(left));
  const recentBackups = (
    await Promise.all(manifestKeys.slice(0, 14).map((key) => readR2Json(env, key)))
  ).filter(Boolean);
  const monthlyManifestKeys = monthlyBackups.manifestKeys.sort((left, right) =>
    right.localeCompare(left),
  );
  const recentMonthlyBackups = (
    await Promise.all(monthlyManifestKeys.slice(0, 12).map((key) => readR2Json(env, key)))
  ).filter(Boolean);
  const recoveryManifestKeys = recoveryPoints.manifestKeys.sort((left, right) =>
    right.localeCompare(left),
  );
  const recentRecoveryPoints = (
    await Promise.all(recoveryManifestKeys.slice(0, 10).map((key) => readR2Json(env, key)))
  ).filter(Boolean);
  const latestBackup = recentBackups[0] || null;
  const alerts = [];
  if (!latestBackup) {
    alerts.push({ level: "critical", message: "Aucune sauvegarde quotidienne disponible." });
  } else {
    const ageHours = (Date.now() - Date.parse(latestBackup.createdAt)) / 3_600_000;
    if (!Number.isFinite(ageHours) || ageHours > 36) {
      alerts.push({
        level: "warning",
        message: "La dernière sauvegarde complète date de plus de 36 heures.",
      });
    }
    if (latestBackup.d1?.available === false) {
      alerts.push({ level: "warning", message: "Le dernier export n’inclut pas l’index D1." });
    }
  }
  if (latestStatus?.state === "failed") {
    alerts.push({
      level: "critical",
      message: `Dernier essai en échec : ${latestStatus.message || "erreur inconnue"}`,
    });
  }
  if (!d1.available || !d1.indexReady) {
    alerts.push({ level: "warning", message: "L’index D1 n’est pas prêt ou est indisponible." });
  }
  const health = alerts.some((alert) => alert.level === "critical")
    ? "critical"
    : alerts.length
      ? "warning"
      : "healthy";
  return json(
    {
      generatedAt: new Date().toISOString(),
      health,
      alerts,
      latestStatus,
      latestBackup,
      recentBackups,
      recentMonthlyBackups,
      recentRecoveryPoints,
      storage: {
        clients: { objects: clients.objects, bytes: clients.bytes },
        history: { objects: history.objects, bytes: history.bytes },
        backups: {
          objects: dailyBackups.objects + monthlyBackups.objects + recoveryPoints.objects,
          bytes: dailyBackups.bytes + monthlyBackups.bytes + recoveryPoints.bytes,
        },
        recovery: { objects: recoveryPoints.objects, bytes: recoveryPoints.bytes },
        system: { objects: system.objects, bytes: system.bytes },
        total: {
          objects:
            clients.objects +
            history.objects +
            dailyBackups.objects +
            monthlyBackups.objects +
            recoveryPoints.objects +
            system.objects,
          bytes:
            clients.bytes +
            history.bytes +
            dailyBackups.bytes +
            monthlyBackups.bytes +
            recoveryPoints.bytes +
            system.bytes,
        },
      },
      d1,
      schedule: { cron: "15 3 * * *", timezone: "UTC", algerTime: "04:15" },
      retention: { daily: 30, monthly: 12, recoveryPoints: 10 },
    },
    200,
    origin,
  );
}

async function createDailyBackup(env, scheduledTime = Date.now()) {
  const createdAt = new Date(scheduledTime).toISOString();
  const day = createdAt.slice(0, 10);
  const root = `${DAILY_BACKUP_PREFIX}${day}`;
  const manifestKey = `${root}/manifest.json`;
  const existing = await readR2Json(env, manifestKey);
  if (existing) {
    const monthly = await createMonthlyBackup(env, root, existing);
    const [dailyRetention, monthlyRetention] = await Promise.all([
      enforceBackupRetention(env, DAILY_BACKUP_PREFIX, 30),
      enforceBackupRetention(env, "backups/monthly/", 12),
    ]);
    await recordBackupStatus(env, {
      state: "success",
      day,
      message: "La sauvegarde quotidienne existe déjà.",
      manifest: existing,
      monthly,
      retention: { daily: dailyRetention, monthly: monthlyRetention },
    });
    return { ...existing, skipped: true };
  }

  const index = await readR2ProfileIndex(env);
  let profiles = 0;
  let photos = 0;
  let deletions = 0;
  for (const profile of index.profiles) {
    if (
      await copyR2Object(env, `clients/${profile.id}.json`, `${root}/r2/clients/${profile.id}.json`)
    ) {
      profiles += 1;
    }
    if (
      profile.hasPhoto &&
      (await copyR2Object(
        env,
        profilePhotoKey(profile.id),
        `${root}/r2/clients/${profile.id}/photo.webp`,
      ))
    ) {
      photos += 1;
    }
  }
  for (const deleted of index.deletedProfiles) {
    if (
      await copyR2Object(
        env,
        profileDeletedKey(deleted.id),
        `${root}/r2/clients/${deleted.id}.deleted.json`,
      )
    ) {
      deletions += 1;
    }
  }

  let d1 = { available: false, profiles: 0, deletions: 0, systemState: 0 };
  if (env.CLIENTS_DB) {
    try {
      const [profileRows, deletionRows, stateRows] = await env.CLIENTS_DB.batch([
        env.CLIENTS_DB.prepare("SELECT * FROM client_profiles ORDER BY id"),
        env.CLIENTS_DB.prepare("SELECT * FROM client_profile_deletions ORDER BY id"),
        env.CLIENTS_DB.prepare("SELECT * FROM system_state ORDER BY key"),
      ]);
      const exportData = {
        exportedAt: createdAt,
        clientProfiles: profileRows.results || [],
        clientProfileDeletions: deletionRows.results || [],
        systemState: stateRows.results || [],
      };
      d1 = {
        available: true,
        profiles: exportData.clientProfiles.length,
        deletions: exportData.clientProfileDeletions.length,
        systemState: exportData.systemState.length,
      };
      await env.CLIENTS_BUCKET.put(`${root}/d1/index.json`, JSON.stringify(exportData), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
        customMetadata: { createdAt, day },
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "daily_backup_d1_failed",
          day,
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }

  const manifest = { version: 1, day, createdAt, profiles, photos, deletions, d1 };
  await env.CLIENTS_BUCKET.put(manifestKey, JSON.stringify(manifest), {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: { day, createdAt, profiles: String(profiles) },
  });
  const monthly = await createMonthlyBackup(env, root, manifest);
  const [dailyRetention, monthlyRetention] = await Promise.all([
    enforceBackupRetention(env, DAILY_BACKUP_PREFIX, 30),
    enforceBackupRetention(env, "backups/monthly/", 12),
  ]);
  await recordBackupStatus(env, {
    state: "success",
    day,
    message: "Sauvegarde quotidienne terminée.",
    manifest,
    monthly,
    retention: { daily: dailyRetention, monthly: monthlyRetention },
  });
  return manifest;
}

async function runDailyBackup(env, origin) {
  try {
    const manifest = await createDailyBackup(env);
    return json({ ok: true, backup: manifest }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await recordBackupStatus(env, {
      state: "failed",
      day: new Date().toISOString().slice(0, 10),
      message,
    });
    return json({ error: `Sauvegarde impossible : ${message}` }, 500, origin);
  }
}

async function cleanupSecurityState(env, scheduledTime = Date.now()) {
  const cutoff = new Date(Number(scheduledTime) - 24 * 60 * 60 * 1000).toISOString();
  if (env.CLIENTS_DB) {
    try {
      await env.CLIENTS_DB.prepare("DELETE FROM login_attempts WHERE updated_at < ?")
        .bind(cutoff)
        .run();
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "login_throttle_cleanup_failed",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }
  const expiredKeys = [];
  let cursor;
  do {
    const page = await env.CLIENTS_BUCKET.list({
      prefix: SESSIONS_PREFIX,
      cursor,
      include: ["customMetadata"],
      limit: 500,
    });
    for (const object of page.objects) {
      if (Date.parse(object.customMetadata?.expiresAt || "") <= Number(scheduledTime))
        expiredKeys.push(object.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  for (let offset = 0; offset < expiredKeys.length; offset += 500)
    await env.CLIENTS_BUCKET.delete(expiredKeys.slice(offset, offset + 500));
  return { expiredSessions: expiredKeys.length };
}

async function cleanupExpiredTrash(env, scheduledTime = Date.now()) {
  const items = await readTrashManifests(env);
  let purged = 0;
  for (const item of items) {
    if (Date.parse(item.expiresAt) > Number(scheduledTime)) continue;
    try {
      await purgeTrashData(env, item.id);
      purged += 1;
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "trash_cleanup_failed",
          clientId: item.id,
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }
  if (purged)
    console.log(
      JSON.stringify({
        event: "trash_cleanup_completed",
        purged,
        retentionDays: TRASH_RETENTION_DAYS,
      }),
    );
  return { purged };
}

async function route(request, env, ctx) {
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
  if (!env.CLIENTS_BUCKET) return json({ error: "Binding R2 CLIENTS_BUCKET absent." }, 503, origin);
  if (url.pathname === "/api/auth/login" && request.method === "POST")
    return login(request, env, origin, ctx);

  const actor = await authenticatedUser(request, env, ctx);
  if (!actor) return json({ error: "Session expirée ou accès non autorisé." }, 401, origin);
  const permissions = rolePermissions(actor.role);
  if (url.pathname === "/api/auth/session" && request.method === "GET")
    return json({ ok: true, user: publicUser(actor) }, 200, origin);
  if (url.pathname === "/api/account/sessions" && request.method === "GET")
    return listAccountSessions(env, actor, origin, ctx);
  if (url.pathname === "/api/account/sessions/others" && request.method === "DELETE")
    return revokeOtherAccountSessions(request, env, actor, origin, ctx);
  const sessionId = accountSessionId(url.pathname);
  if (sessionId && request.method === "DELETE")
    return revokeAccountSession(request, env, actor, sessionId, origin, ctx);
  if (url.pathname === "/api/account/password" && request.method === "PUT")
    return changeOwnPassword(request, env, actor, origin, ctx);

  if (url.pathname.startsWith("/api/admin/")) {
    if (actor.role !== "admin")
      return json({ error: "Droits administrateur requis." }, 403, origin);
    if (url.pathname === "/api/admin/trash" && request.method === "GET")
      return listTrash(env, origin);
    const trashTarget = trashProfileRoute(url.pathname);
    if (trashTarget?.restore && request.method === "POST")
      return restoreTrashProfile(request, env, trashTarget.id, actor, origin, ctx);
    if (trashTarget && !trashTarget.restore && request.method === "DELETE")
      return purgeTrashProfile(
        request,
        env,
        trashTarget.id,
        actor,
        origin,
        ctx,
        url.searchParams.get("confirmation"),
      );
    const restoreTarget = backupRestoreTarget(url.pathname);
    if (restoreTarget) {
      if (request.method === "GET") return previewBackupRestore(env, restoreTarget, origin);
      if (request.method === "POST")
        return restoreClientBackup(request, env, restoreTarget, actor, origin, ctx);
      return json({ error: "Méthode non autorisée." }, 405, origin);
    }
    if (clientOrderPortalPath(url.pathname))
      return proxyClientOrders(request, env, origin, url.pathname);
    if (url.pathname === "/api/admin/users" && request.method === "GET")
      return listUsers(env, origin);
    if (url.pathname === "/api/admin/users" && request.method === "POST")
      return createUser(request, env, actor, origin, ctx);
    const passwordUsername = accountPasswordUsername(url.pathname);
    if (passwordUsername && request.method === "PUT")
      return resetUserPassword(request, env, actor, passwordUsername, origin, ctx);
    const username = accountUsername(url.pathname);
    if (username && request.method === "PUT")
      return updateUser(request, env, actor, username, origin, ctx);
    if (username && request.method === "DELETE")
      return deleteUser(request, env, actor, username, origin, ctx);
    if (url.pathname === "/api/admin/audit" && request.method === "GET")
      return listAudit(env, origin, url.searchParams.get("limit"));
    if (url.pathname === "/api/admin/monitoring" && request.method === "GET")
      return operationalMonitoring(env, origin);
    if (url.pathname === "/api/admin/clients/reindex" && request.method === "POST")
      return rebuildClientProfileIndex(env, origin);
    if (url.pathname === "/api/admin/backups") {
      if (request.method === "GET") return backupMonitoring(env, origin);
      if (request.method === "POST") return runDailyBackup(env, origin);
    }
    if (url.pathname === "/api/admin/ai-keys" && request.method === "GET")
      return aiKeyStatus(env, origin);
    if (url.pathname === "/api/admin/ai-keys" && request.method === "PUT")
      return saveAiKey(request, env, actor, origin, ctx);
    const keyId = aiKeyId(url.pathname);
    if (keyId && request.method === "DELETE")
      return deleteAiKey(request, env, actor, keyId, origin, ctx);
    return json({ error: "Route d’administration introuvable." }, 404, origin);
  }

  if (url.pathname === "/api/ai/models" && request.method === "GET") {
    if (!permissions.aiUse)
      return json({ error: "Votre rôle ne permet pas d’utiliser les fonctions IA." }, 403, origin);
    const provider = url.searchParams.get("provider");
    if (provider !== "gemini" && provider !== "openrouter")
      return json({ error: "Fournisseur IA invalide." }, 400, origin);
    return listAiModels(provider, env, origin);
  }
  if (url.pathname === "/api/ai/generate" && request.method === "POST") {
    if (!permissions.aiUse)
      return json({ error: "Votre rôle ne permet pas d’utiliser les fonctions IA." }, 403, origin);
    return generateAi(request, env, origin);
  }

  if (url.pathname === "/api/telemetry" && request.method === "POST")
    return recordOperationalEvents(request, env, actor, origin, ctx);

  if (url.pathname === "/api/clients" && request.method === "GET")
    return listProfiles(env, origin, ctx, actor, url.searchParams);
  const workflowId = profileWorkflowId(url.pathname);
  if (workflowId) {
    if (request.method !== "PUT") return json({ error: "Méthode non autorisée." }, 405, origin);
    if (!permissions.clientsWrite)
      return json({ error: "Votre rôle est limité à la lecture." }, 403, origin);
    return updateProfileWorkflow(request, env, workflowId, actor, origin, ctx);
  }
  const restoreTarget = profileVersionRestore(url.pathname);
  if (restoreTarget) {
    if (request.method === "POST") {
      if (!permissions.clientsRestore)
        return json(
          { error: "Seul un administrateur peut restaurer une révision client." },
          403,
          origin,
        );
      return restoreProfileVersion(request, env, restoreTarget, actor, origin, ctx);
    }
    return json({ error: "Méthode non autorisée." }, 405, origin);
  }
  const versionTarget = profileVersionId(url.pathname);
  if (versionTarget) {
    if (request.method === "GET") return getProfileVersion(env, versionTarget, origin);
    return json({ error: "Méthode non autorisée." }, 405, origin);
  }
  const versionsId = profileVersionsId(url.pathname);
  if (versionsId) {
    if (request.method === "GET") return listProfileVersions(env, versionsId, origin);
    return json({ error: "Méthode non autorisée." }, 405, origin);
  }
  const photoId = profilePhotoId(url.pathname);
  if (photoId) {
    if (request.method === "GET") return getProfilePhoto(env, photoId, origin);
    if (request.method === "PUT") {
      if (!permissions.clientsWrite)
        return json({ error: "Votre rôle est limité à la lecture." }, 403, origin);
      const current = await readR2Json(env, `clients/${photoId}.json`);
      if (current && normalizeClientWorkflowStatus(current.workflowStatus) === "approved")
        return profileLocked(origin, current);
      return putProfilePhoto(request, env, photoId, origin);
    }
    if (request.method === "DELETE") {
      if (!permissions.clientsWrite)
        return json({ error: "Votre rôle est limité à la lecture." }, 403, origin);
      const current = await readR2Json(env, `clients/${photoId}.json`);
      if (current && normalizeClientWorkflowStatus(current.workflowStatus) === "approved")
        return profileLocked(origin, current);
      if (current) {
        await snapshotProfileVersion(env, current);
        await snapshotCurrentProfilePhoto(env, photoId, storedProfileRevision(current));
      }
      await env.CLIENTS_BUCKET.delete(profilePhotoKey(photoId));
      return json({ ok: true, id: photoId }, 200, origin);
    }
    return json({ error: "Méthode non autorisée." }, 405, origin);
  }
  const id = profileId(url.pathname);
  if (!id) return json({ error: "Route ou ID client invalide." }, 404, origin);
  if (request.method === "GET") return getProfile(env, id, origin);
  if (request.method === "PUT") {
    if (!permissions.clientsWrite)
      return json({ error: "Votre rôle est limité à la lecture." }, 403, origin);
    return putProfile(request, env, id, actor, origin, ctx);
  }
  if (request.method === "DELETE") {
    if (!permissions.clientsDelete)
      return json(
        { error: "Seul un administrateur peut supprimer un profil client." },
        403,
        origin,
      );
    const deletedAt = new Date().toISOString();
    const current = await ensureCurrentProfileSnapshot(env, id);
    if (!current) return json({ error: "Profil introuvable." }, 404, origin);
    const trash = await archiveClientInTrash(env, current, actor, deletedAt);
    await Promise.all([
      env.CLIENTS_BUCKET.delete(`clients/${id}.json`),
      env.CLIENTS_BUCKET.delete(profilePhotoKey(id)),
      env.CLIENTS_BUCKET.put(
        profileDeletedKey(id),
        JSON.stringify({
          id,
          deletedAt,
          deletedBy: actor.username,
          trashExpiresAt: trash.expiresAt,
        }),
        {
          httpMetadata: { contentType: "application/json; charset=utf-8" },
          customMetadata: {
            id,
            deletedAt,
            deletedBy: actor.username,
            trashExpiresAt: trash.expiresAt,
          },
        },
      ),
    ]);
    await maintainClientProfileIndex(env, () =>
      deleteClientProfileIndex(env, id, deletedAt, actor.username),
    );
    ctx.waitUntil(
      writeAudit(env, request, "client_deleted", actor.username, "success", { clientId: id }),
    );
    return json({ ok: true, id, trash }, 200, origin);
  }
  return json({ error: "Méthode non autorisée." }, 405, origin);
}

export default {
  fetch(request, env, ctx) {
    return route(request, env, ctx).catch((error) => {
      console.error(
        JSON.stringify({
          event: "worker_error",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
      return json({ error: "Erreur interne du service." }, 500, allowedOrigin(request, env));
    });
  },
  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      createDailyBackup(env, controller.scheduledTime).catch(async (error) => {
        const message = error instanceof Error ? error.message : "unknown";
        console.error(
          JSON.stringify({
            event: "daily_backup_failed",
            message,
          }),
        );
        await recordBackupStatus(env, {
          state: "failed",
          day: new Date(controller.scheduledTime).toISOString().slice(0, 10),
          message,
        });
        throw error;
      }),
    );
    ctx.waitUntil(cleanupSecurityState(env, controller.scheduledTime));
    ctx.waitUntil(cleanupExpiredTrash(env, controller.scheduledTime));
  },
};
