const encoder = new TextEncoder();
const prefix = "tech-orders/v1/private-credentials/";
const base64 = (bytes) => btoa(String.fromCharCode(...bytes));
const bytes = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const clientIdentity = (order) =>
  JSON.stringify([
    order.client.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("fr"),
    order.facebookUrl.trim(),
  ]);
async function encryptionKey(env) {
  if (typeof env.TECH_CREDENTIALS_KEY !== "string") return null;
  const raw = bytes(env.TECH_CREDENTIALS_KEY);
  if (raw.length !== 32) return null;
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function boundedJson(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("body");
  let size = 0;
  const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8192) {
      await reader.cancel();
      throw Error("body");
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(combined));
}
/** Administrator-only vault. Never joins dashboard, sales, exports or MCP data. */
export async function handleTechCredentials(request, env, actor, respond) {
  if (actor.role !== "admin") return respond({ error: "Accès administrateur requis." }, 403);
  const match = new URL(request.url).pathname.match(
    /^\/api\/tech-orders\/orders\/([a-zA-Z0-9-]{1,80})\/credentials(\/reveal)?$/,
  );
  if (!match || !(match[2] ? request.method === "POST" : ["GET", "PUT"].includes(request.method)))
    return respond({ error: "Route introuvable." }, 404);
  const object = await env.CLIENTS_BUCKET.get(`tech-orders/v1/current/orders/${match[1]}.json`);
  const order = object ? JSON.parse(await object.text()) : null;
  if (!order || order.deletedAt) return respond({ error: "Vente introuvable." }, 404);
  let key;
  try {
    key = await encryptionKey(env);
  } catch {
    /* Fail closed for an invalid managed key. */
  }
  if (!key) return respond({ error: "Le coffre chiffré est indisponible." }, 503);
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(clientIdentity(order))),
  );
  const id = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  const storageKey = `${prefix}${id}.json`;
  const aad = encoder.encode(storageKey);
  const previous = await env.CLIENTS_BUCKET.get(storageKey);
  let stored = { revision: 0, email: "", password: "" };
  if (previous) {
    try {
      const envelope = JSON.parse(await previous.text());
      stored = JSON.parse(
        new TextDecoder().decode(
          await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: bytes(envelope.iv), additionalData: aad },
            key,
            bytes(envelope.ciphertext),
          ),
        ),
      );
    } catch {
      return respond(
        { error: "Impossible d’ouvrir le coffre chiffré. Aucun identifiant n’a été remplacé." },
        503,
      );
    }
  }
  const metadata = (value) => ({
    revision: value.revision,
    email: value.email,
    hasPassword: !!value.password,
  });
  if (request.method === "GET") return respond(metadata(stored), 200);
  if (match[2]) return respond({ password: stored.password, revision: stored.revision }, 200);
  let input;
  try {
    input = await boundedJson(request);
  } catch {
    return respond({ error: "Saisie invalide ou trop longue." }, 400);
  }
  if (
    !input ||
    Array.isArray(input) ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    typeof input.email !== "string" ||
    input.email.length > 254 ||
    (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) ||
    (Object.hasOwn(input, "password") &&
      (typeof input.password !== "string" || input.password.length > 2048))
  )
    return respond(
      { error: "Vérifiez l’e-mail et le mot de passe (2 048 caractères maximum)." },
      400,
    );
  if (input.revision !== stored.revision)
    return respond(
      { error: "Les identifiants ont changé. Fermez puis rouvrez ce panneau avant de réessayer." },
      409,
    );
  const updated = {
    revision: stored.revision + 1,
    email: input.email.trim(),
    password: Object.hasOwn(input, "password") ? input.password : stored.password,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.username,
  };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad },
    key,
    encoder.encode(JSON.stringify(updated)),
  );
  const saved = await env.CLIENTS_BUCKET.put(
    storageKey,
    JSON.stringify({ version: 1, iv: base64(iv), ciphertext: base64(new Uint8Array(ciphertext)) }),
    {
      onlyIf: previous ? { etagMatches: previous.etag } : { etagDoesNotMatch: "*" },
      httpMetadata: { contentType: "application/json" },
    },
  );
  return saved
    ? respond(metadata(updated), 200)
    : respond(
        { error: "Modification concurrente. Rouvrez les identifiants avant de réessayer." },
        409,
      );
}
