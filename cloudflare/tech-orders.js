// Separate private namespace: never read or write CV profiles, invitations or MCP data.
const PREFIX = "tech-orders/v1/";
const idPattern = /^[a-zA-Z0-9-]{1,80}$/;
const money = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100000000;
const text = (value, max) => typeof value === "string" && value.length <= max;
export function validTechDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= "2000-01-01" &&
    value <= "2199-12-31"
  );
}
function webUrl(value) {
  if (value === "") return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && value.length <= 2000;
  } catch {
    return false;
  }
}
function pngLogo(value) {
  if (value === "") return true;
  if (
    typeof value !== "string" ||
    value.length > 210000 ||
    !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value)
  )
    return false;
  const bytes = Uint8Array.from(atob(value.split(",")[1]), (c) => c.charCodeAt(0));
  return (
    bytes.length >= 24 &&
    bytes.length <= 153600 &&
    new DataView(bytes.buffer).getUint32(16) === 256 &&
    new DataView(bytes.buffer).getUint32(20) === 256
  );
}
export function validateTechRecord(kind, input, id) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !idPattern.test(id) ||
    input.id !== id ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0
  )
    throw Error("Identifiant ou version invalide.");
  if (kind === "services") {
    if (
      !text(input.name, 120) ||
      !input.name.trim() ||
      !text(input.icon, 80) ||
      !idPattern.test(input.icon) ||
      !pngLogo(input.logo) ||
      !money(input.priceUsd) ||
      !money(input.saleDzd) ||
      !money(input.rate) ||
      input.rate <= 0 ||
      !Number.isInteger(input.months) ||
      input.months < 1 ||
      input.months > 36
    )
      throw Error(
        "Service invalide : nom, prix, taux positif, durée et logo PNG 256 × 256 requis.",
      );
    return {
      id,
      name: input.name.trim(),
      icon: input.icon,
      logo: input.logo,
      priceUsd: input.priceUsd,
      rate: input.rate,
      saleDzd: input.saleDzd,
      months: input.months,
    };
  }
  if (
    !text(input.client, 180) ||
    !input.client.trim() ||
    !webUrl(input.facebookUrl) ||
    !text(input.notes, 3000) ||
    !text(input.renewalOf, 80) ||
    (input.renewalOf && !idPattern.test(input.renewalOf)) ||
    !Array.isArray(input.lines) ||
    input.lines.length < 1 ||
    input.lines.length > 30
  )
    throw Error("Client, lien HTTPS et au moins un service requis (30 maximum).");
  const ids = new Set();
  const lines = input.lines.map((line) => {
    if (
      !line ||
      !idPattern.test(line.id) ||
      ids.has(line.id) ||
      !idPattern.test(line.serviceId) ||
      !text(line.name, 120) ||
      !line.name.trim() ||
      !validTechDate(line.start) ||
      !validTechDate(line.end) ||
      line.end <= line.start ||
      !money(line.priceUsd) ||
      !money(line.rate) ||
      line.rate <= 0 ||
      !money(line.saleDzd) ||
      !webUrl(line.invoiceUrl) ||
      !text(line.invoiceRef, 180)
    )
      throw Error("Ligne invalide : dates, prix, taux ou facture. La fin doit suivre le début.");
    ids.add(line.id);
    return {
      id: line.id,
      serviceId: line.serviceId,
      name: line.name.trim(),
      start: line.start,
      end: line.end,
      priceUsd: line.priceUsd,
      rate: line.rate,
      saleDzd: line.saleDzd,
      invoiceUrl: line.invoiceUrl,
      invoiceRef: line.invoiceRef,
    };
  });
  return {
    id,
    client: input.client.trim(),
    facebookUrl: input.facebookUrl,
    notes: input.notes,
    renewalOf: input.renewalOf,
    lines,
  };
}
export async function handleTechOrders(request, env, actor, respond) {
  if (actor.role !== "admin")
    return respond({ error: "Espace financier réservé aux administrateurs." }, 403);
  const path = new URL(request.url).pathname;
  if (path === "/api/tech-orders" && request.method === "GET") {
    const services = [],
      orders = [];
    let cursor;
    do {
      const page = await env.CLIENTS_BUCKET.list({
        prefix: `${PREFIX}current/`,
        cursor,
        limit: 500,
      });
      for (const item of page.objects) {
        const object = await env.CLIENTS_BUCKET.get(item.key);
        if (!object) continue;
        const value = JSON.parse(await object.text());
        (item.key.includes("/services/") ? services : orders).push(value);
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return respond({ services, orders }, 200);
  }
  const match = path.match(/^\/api\/tech-orders\/(services|orders)\/([a-zA-Z0-9-]{1,80})$/);
  if (!match || request.method !== "PUT")
    return respond({ error: "Route ZGR Tech Orders introuvable." }, 404);
  // Read the actual body with a bound, even if Content-Length is omitted or forged.
  const reader = request.body?.getReader();
  const chunks = [];
  let size = 0;
  if (!reader) return respond({ error: "Corps JSON requis." }, 400);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 260000) {
      await reader.cancel();
      return respond({ error: "Enregistrement trop volumineux." }, 413);
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  let input, record;
  try {
    input = JSON.parse(new TextDecoder().decode(buffer));
    record = validateTechRecord(match[1], input, match[2]);
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Données invalides." }, 400);
  }
  const key = `${PREFIX}current/${match[1]}/${match[2]}.json`;
  const previous = await env.CLIENTS_BUCKET.get(key);
  const old = previous ? JSON.parse(await previous.text()) : null;
  if ((old?.revision ?? 0) !== input.revision)
    return respond(
      { error: "Modifié depuis un autre onglet. Actualisez avant de réessayer." },
      409,
    );
  if (record.renewalOf === record.id)
    return respond({ error: "Un renouvellement doit créer une nouvelle vente." }, 400);
  if (match[1] === "orders") {
    for (const line of record.lines) {
      if (!(await env.CLIENTS_BUCKET.get(`${PREFIX}current/services/${line.serviceId}.json`)))
        return respond(
          { error: "Service absent du catalogue cloud. Enregistrez-le avant la vente." },
          400,
        );
    }
  }
  const updated = {
    ...record,
    revision: input.revision + 1,
    createdAt: old?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actor.username,
  };
  if (old)
    await env.CLIENTS_BUCKET.put(
      `${PREFIX}history/${match[1]}/${match[2]}/${old.revision}-${crypto.randomUUID()}.json`,
      JSON.stringify(old),
    );
  const saved = await env.CLIENTS_BUCKET.put(key, JSON.stringify(updated), {
    onlyIf: previous ? { etagMatches: previous.etag } : { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/json" },
  });
  if (!saved)
    return respond({ error: "Conflit de modification. Rechargez les données cloud." }, 409);
  return respond({ record: updated }, 200);
}
