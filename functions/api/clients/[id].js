const MAX_JSON_BYTES = 5_000_000;

const json = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });

function authorized(context) {
  const expected = context.env.ZGR_SYNC_TOKEN;
  const received = context.request.headers.get("Authorization") || "";
  return typeof expected === "string" && expected.length >= 24 && received === `Bearer ${expected}`;
}

function profileId(context) {
  const id = String(context.params.id || "").toUpperCase();
  return /^ZGR-\d{8}-[A-Z0-9]{6,12}$/.test(id) ? id : null;
}

function ready(context) {
  if (!authorized(context)) return json({ error: "Accès non autorisé." }, 401);
  if (!context.env.CLIENTS_BUCKET) return json({ error: "Binding R2 CLIENTS_BUCKET absent." }, 503);
  if (!profileId(context)) return json({ error: "ID client invalide." }, 400);
  return null;
}

export async function onRequestGet(context) {
  const error = ready(context);
  if (error) return error;
  const id = profileId(context);
  const object = await context.env.CLIENTS_BUCKET.get(`clients/${id}.json`);
  if (!object) return json({ error: "Profil introuvable." }, 404);
  return new Response(object.body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ETag: object.httpEtag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function onRequestPut(context) {
  const error = ready(context);
  if (error) return error;
  const declaredSize = Number(context.request.headers.get("Content-Length") || 0);
  if (declaredSize > MAX_JSON_BYTES) return json({ error: "JSON supérieur à 5 Mo." }, 413);

  const raw = await context.request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES)
    return json({ error: "JSON supérieur à 5 Mo." }, 413);

  let profile;
  try {
    profile = JSON.parse(raw);
  } catch {
    return json({ error: "JSON invalide." }, 400);
  }
  const id = profileId(context);
  if (
    !profile ||
    profile.version !== 1 ||
    profile.id !== id ||
    typeof profile.name !== "string" ||
    typeof profile.updatedAt !== "string" ||
    !profile.cvByLanguage ||
    typeof profile.cvByLanguage !== "object"
  ) {
    return json({ error: "Structure du profil invalide." }, 422);
  }

  await context.env.CLIENTS_BUCKET.put(`clients/${id}.json`, raw, {
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
  return json({ ok: true, id });
}

export async function onRequestDelete(context) {
  const error = ready(context);
  if (error) return error;
  const id = profileId(context);
  await context.env.CLIENTS_BUCKET.delete(`clients/${id}.json`);
  return json({ ok: true, id });
}
