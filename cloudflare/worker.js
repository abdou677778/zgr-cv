const MAX_JSON_BYTES = 5_000_000;
const MAX_LOGIN_BYTES = 4_096;
const MAX_ACCOUNT_BYTES = 16_384;
const MAX_AI_BYTES = 120_000;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
// Cloudflare Workers currently rejects PBKDF2 iteration counts above 100,000.
const PBKDF2_ITERATIONS = 100_000;
const ID_PATTERN = /^ZGR-\d{8}-[A-Z0-9]{6,12}$/;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const USERS_PREFIX = "system/users/";
const AUDIT_PREFIX = "system/audit/";
const AI_KEYS_OBJECT = "system/secrets/ai-keys.enc.json";
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

function normalizeUsername(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
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
  return {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
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
        role: user.role,
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

async function issueSession(env, user) {
  const key = await sessionKey(env, ["sign"]);
  if (!key) throw new Error("SESSION_SECRET absent ou trop court.");
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = encodeBase64Url(
    JSON.stringify({
      sub: user.username,
      role: user.role,
      sv: Number(user.sessionVersion) || 1,
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
      !["admin", "user"].includes(claims?.role) ||
      Number(claims.exp) <= now ||
      Number(claims.iat) > now + 60
    )
      return null;
    return claims;
  } catch {
    return null;
  }
}

async function authenticatedUser(request, env) {
  const received = request.headers.get("Authorization") || "";
  if (!received.startsWith("Bearer ")) return null;
  const claims = await verifySession(received.slice(7), env);
  if (!claims) return null;
  const user = await getStoredUser(env, claims.sub);
  if (
    !user ||
    user.active === false ||
    user.role !== claims.role ||
    (Number(user.sessionVersion) || 1) !== Number(claims.sv)
  )
    return null;
  return user;
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
  const user = await getLoginUser(env, username);
  const passwordMatches = user ? await verifyUserPassword(user, password, env) : false;
  if (!user || user.active === false || !passwordMatches) {
    if (!user) await hashPassword(password || "invalid-password", "AAECAwQFBgcICQoLDA0ODw");
    ctx.waitUntil(writeAudit(env, request, "login", username, "failure"));
    await new Promise((resolve) => setTimeout(resolve, 650));
    return json({ error: "Identifiants incorrects." }, 401, origin);
  }
  const now = new Date().toISOString();
  const storedUser = {
    ...user,
    bootstrap: undefined,
    password: user.password || (await hashPassword(password)),
    role: user.role === "admin" ? "admin" : "user",
    active: true,
    createdAt: user.createdAt || now,
    updatedAt: now,
    lastLoginAt: now,
    loginCount: (Number(user.loginCount) || 0) + 1,
    sessionVersion: Number(user.sessionVersion) || 1,
  };
  const [session] = await Promise.all([issueSession(env, storedUser), saveUser(env, storedUser)]);
  ctx.waitUntil(writeAudit(env, request, "login", username, "success"));
  return json({ ok: true, ...session, user: publicUser(storedUser) }, 200, origin);
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
      users.push({
        username: metadata.username || "",
        displayName: metadata.displayName || metadata.username || "Profil",
        role: metadata.role === "admin" ? "admin" : "user",
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
  users.sort((left, right) => {
    if (left.role !== right.role) return left.role === "admin" ? -1 : 1;
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
  const role = payload?.role === "admin" ? "admin" : "user";
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
  const requestedRole =
    payload?.role === "admin" || payload?.role === "user" ? payload.role : user.role;
  const role = username === adminUsername ? "admin" : protectedAccount ? user.role : requestedRole;
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
  await saveUser(env, updated);
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
  await saveUser(env, updated);
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
  await saveUser(env, updated);
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
  await env.CLIENTS_BUCKET.delete(`${USERS_PREFIX}${encodeURIComponent(username)}.json`);
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

  const actor = await authenticatedUser(request, env);
  if (!actor) return json({ error: "Session expirée ou accès non autorisé." }, 401, origin);
  if (url.pathname === "/api/auth/session" && request.method === "GET")
    return json({ ok: true, user: publicUser(actor) }, 200, origin);
  if (url.pathname === "/api/account/password" && request.method === "PUT")
    return changeOwnPassword(request, env, actor, origin, ctx);

  if (url.pathname.startsWith("/api/admin/")) {
    if (actor.role !== "admin")
      return json({ error: "Droits administrateur requis." }, 403, origin);
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
    const provider = url.searchParams.get("provider");
    if (provider !== "gemini" && provider !== "openrouter")
      return json({ error: "Fournisseur IA invalide." }, 400, origin);
    return listAiModels(provider, env, origin);
  }
  if (url.pathname === "/api/ai/generate" && request.method === "POST")
    return generateAi(request, env, origin);

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
};
