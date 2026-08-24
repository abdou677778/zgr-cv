const MAX_JSON_BYTES = 5_000_000;
const ID_PATTERN = /^ZGR-\d{8}-[A-Z0-9]{6,12}$/;
const encoder = new TextEncoder();

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
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
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
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ (rightBytes[index] || 0);
  }
  return difference === 0;
}

async function authorized(request, env) {
  const expected = typeof env.ZGR_SYNC_TOKEN === "string" ? env.ZGR_SYNC_TOKEN : "";
  const received = request.headers.get("Authorization") || "";
  if (expected.length < 32 || !received.startsWith("Bearer ")) return false;
  return secureEqual(received.slice(7), expected);
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
  const declaredSize = Number(request.headers.get("Content-Length") || 0);
  if (declaredSize > MAX_JSON_BYTES)
    return json({ error: "JSON supérieur à 5 Mo." }, 413, origin);

  const rawBuffer = await request.arrayBuffer();
  if (rawBuffer.byteLength > MAX_JSON_BYTES)
    return json({ error: "JSON supérieur à 5 Mo." }, 413, origin);
  const raw = new TextDecoder().decode(rawBuffer);

  let profile;
  try {
    profile = JSON.parse(raw);
  } catch {
    return json({ error: "JSON invalide." }, 400, origin);
  }
  if (
    !profile ||
    profile.version !== 1 ||
    profile.id !== id ||
    typeof profile.name !== "string" ||
    typeof profile.updatedAt !== "string" ||
    !profile.cvByLanguage ||
    typeof profile.cvByLanguage !== "object"
  ) {
    return json({ error: "Structure du profil invalide." }, 422, origin);
  }

  await env.CLIENTS_BUCKET.put(`clients/${id}.json`, raw, {
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

async function route(request, env) {
  const url = new URL(request.url);
  const origin = allowedOrigin(request, env);

  if (request.method === "OPTIONS") {
    if (request.headers.get("Origin") && !origin)
      return json({ error: "Origine non autorisée." }, 403);
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (url.pathname === "/health" && request.method === "GET") {
    return json({ ok: true, service: "zgr-cv-storage-api" }, 200, origin);
  }

  if (request.headers.get("Origin") && !origin)
    return json({ error: "Origine non autorisée." }, 403);
  if (!(await authorized(request, env)))
    return json({ error: "Accès non autorisé." }, 401, origin);
  if (!env.CLIENTS_BUCKET)
    return json({ error: "Binding R2 CLIENTS_BUCKET absent." }, 503, origin);

  if (url.pathname === "/api/clients" && request.method === "GET") {
    return listProfiles(env, origin);
  }

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
      console.error("Unhandled worker error", error);
      return json({ error: "Erreur interne de synchronisation." }, 500, allowedOrigin(request, env));
    });
  },
};
