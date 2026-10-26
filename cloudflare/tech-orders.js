// Separate private namespace: never read or write CV profiles, invitations or MCP data.
const PREFIX = "tech-orders/v1/";
const idPattern = /^[a-zA-Z0-9-]{1,80}$/;
const cents = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const money = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 100000000 &&
  (value === 0 || cents(value) > 0) &&
  Math.abs(cents(value) - value) <= Number.EPSILON * Math.max(1, Math.abs(value)) * 4;
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
  if (kind === "logos") {
    if (
      !input.dataUrl ||
      !pngLogo(input.dataUrl) ||
      !text(input.icon, 80) ||
      !idPattern.test(input.icon)
    )
      throw Error("Logo PNG 256 × 256 et identifiant logiciel requis.");
    return { id, icon: input.icon, dataUrl: input.dataUrl };
  }
  if (kind === "finance") {
    if (id !== "main" || !Array.isArray(input.entries) || input.entries.length > 1000)
      throw Error("Registre de frais invalide (1000 lignes maximum).");
    const seen = new Set();
    const entries = input.entries.map((entry) => {
      if (
        !entry ||
        typeof entry.id !== "string" ||
        !idPattern.test(entry.id) ||
        seen.has(entry.id) ||
        !validTechDate(entry.date) ||
        ![
          "sponsor",
          "other",
          "cancellation_fee",
          "refund",
          "cancellation",
          "supplier_credit",
        ].includes(entry.kind) ||
        !money(entry.amountDzd) ||
        entry.amountDzd <= 0 ||
        !text(entry.label, 180) ||
        !entry.label.trim() ||
        !text(entry.orderId, 80) ||
        (entry.orderId && !idPattern.test(entry.orderId)) ||
        (["refund", "cancellation"].includes(entry.kind) && !entry.orderId) ||
        typeof entry.voided !== "boolean"
      )
        throw Error(
          "Frais invalide : date, catégorie, libellé, montant positif à 2 décimales et vente liée si remboursement/annulation.",
        );
      seen.add(entry.id);
      return {
        id: entry.id,
        date: entry.date,
        kind: entry.kind,
        amountDzd: cents(entry.amountDzd),
        label: entry.label.trim(),
        orderId: entry.orderId,
        voided: entry.voided,
      };
    });
    return { id, entries };
  }
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
      cents(input.priceUsd * input.rate) > 100000000 ||
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
      priceUsd: cents(input.priceUsd),
      rate: cents(input.rate),
      saleDzd: cents(input.saleDzd),
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
      cents(line.priceUsd * line.rate) > 100000000 ||
      !money(line.saleDzd) ||
      !webUrl(line.invoiceUrl) ||
      !text(line.invoiceRef, 180)
    )
      throw Error("Ligne invalide : dates, prix, taux ou facture. La fin doit suivre le début.");
    ids.add(line.id);
    const contact = line.renewalContact;
    if (
      contact !== undefined &&
      (!contact ||
        !validTechDate(contact.start) ||
        !validTechDate(contact.end) ||
        contact.end <= contact.start ||
        typeof contact.at !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(contact.at) ||
        !Number.isFinite(Date.parse(contact.at)) ||
        new Date(contact.at).toISOString() !== contact.at ||
        Date.parse(contact.at) > Date.now() + 60000)
    )
      throw Error("Confirmation de contact invalide.");
    return {
      id: line.id,
      ...(contact
        ? { renewalContact: { start: contact.start, end: contact.end, at: contact.at } }
        : {}),
      serviceId: line.serviceId,
      name: line.name.trim(),
      start: line.start,
      end: line.end,
      priceUsd: cents(line.priceUsd),
      rate: cents(line.rate),
      saleDzd: cents(line.saleDzd),
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
export function validateFinanceLinks(finance, orders) {
  const sums = new Map();
  for (const entry of finance.entries) {
    if (!entry.orderId) continue;
    if (!orders.has(entry.orderId)) throw Error("La vente liée aux frais est introuvable.");
    if (entry.voided) continue;
    const current = sums.get(entry.orderId) || { revenue: 0, credit: 0 };
    if (entry.kind === "refund" || entry.kind === "cancellation")
      current.revenue = cents(current.revenue + entry.amountDzd);
    if (entry.kind === "supplier_credit") current.credit = cents(current.credit + entry.amountDzd);
    sums.set(entry.orderId, current);
  }
  for (const [id, amounts] of sums) {
    const source = orders.get(id);
    const sale = source.lines.reduce((n, line) => cents(n + line.saleDzd), 0);
    const cost = source.lines.reduce((n, line) => cents(n + cents(line.priceUsd * line.rate)), 0);
    if (amounts.revenue > sale)
      throw Error(
        "Remboursements + ventes annulées dépassent le total de la vente liée. Ne déduisez pas deux fois le même montant.",
      );
    if (amounts.credit > cost)
      throw Error("Les avoirs fournisseurs liés dépassent le coût de cette vente.");
  }
}
export async function handleTechOrders(request, env, actor, respond) {
  if (actor.role !== "admin")
    return respond({ error: "Espace financier réservé aux administrateurs." }, 403);
  const path = new URL(request.url).pathname;
  if (path === "/api/tech-orders" && request.method === "GET") {
    const services = [],
      orders = [],
      logos = {};
    let finance = { id: "main", revision: 0, entries: [] };
    let cursor;
    do {
      const page = await env.CLIENTS_BUCKET.list({
        prefix: `${PREFIX}current/`,
        cursor,
        limit: 500,
      });
      // Bounded parallel reads shorten loading without flooding R2 with requests.
      for (let offset = 0; offset < page.objects.length; offset += 8) {
        const values = await Promise.all(
          page.objects.slice(offset, offset + 8).map(async (item) => {
            const object = await env.CLIENTS_BUCKET.get(item.key);
            return object ? { key: item.key, value: JSON.parse(await object.text()) } : null;
          }),
        );
        for (const item of values) {
          if (!item) continue;
          if (item.key.includes("/logos/")) logos[item.value.id] = item.value;
          else if (item.key === `${PREFIX}current/finance/main.json`) finance = item.value;
          else if (item.key.includes("/services/")) services.push(item.value);
          else if (item.key.includes("/orders/")) orders.push(item.value);
        }
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return respond({ services, orders, logos, finance }, 200);
  }
  const match = path.match(
    /^\/api\/tech-orders\/(services|orders|logos|finance)\/([a-zA-Z0-9-]{1,80})$/,
  );
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
    if (size > (match[1] === "finance" ? 2 * 1024 * 1024 : 260000)) {
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
  if (match[1] === "finance") {
    const nextIds = new Set(record.entries.map((entry) => entry.id));
    if (old?.entries.some((entry) => !nextIds.has(entry.id)))
      return respond(
        {
          error:
            "Conservez les anciennes lignes : neutralisez une ligne erronée au lieu de la supprimer.",
        },
        400,
      );
    const oldEntries = new Map((old?.entries || []).map((entry) => [entry.id, entry]));
    const changed = record.entries.filter(
      (entry) => JSON.stringify(entry) !== JSON.stringify(oldEntries.get(entry.id)),
    );
    if (changed.length > 25)
      return respond({ error: "Modifiez au maximum 25 lignes de frais par enregistrement." }, 400);
    const ids = [
      ...new Set(
        changed
          .flatMap((entry) => [entry.orderId, oldEntries.get(entry.id)?.orderId])
          .filter(Boolean),
      ),
    ];
    const linkedOrders = new Map();
    for (let offset = 0; offset < ids.length; offset += 8)
      await Promise.all(
        ids.slice(offset, offset + 8).map(async (id) => {
          const object = await env.CLIENTS_BUCKET.get(`${PREFIX}current/orders/${id}.json`);
          if (object) linkedOrders.set(id, JSON.parse(await object.text()));
        }),
      );
    try {
      validateFinanceLinks(
        { ...record, entries: record.entries.filter((entry) => ids.includes(entry.orderId)) },
        linkedOrders,
      );
    } catch (error) {
      return respond({ error: error.message }, 400);
    }
  }
  if (record.renewalOf === record.id)
    return respond({ error: "Un renouvellement doit créer une nouvelle vente." }, 400);
  if (match[1] === "orders") {
    const ledger = await env.CLIENTS_BUCKET.get(`${PREFIX}current/finance/main.json`);
    if (ledger) {
      const finance = JSON.parse(await ledger.text());
      const linked = {
        ...finance,
        entries: finance.entries.filter((entry) => entry.orderId === record.id),
      };
      try {
        validateFinanceLinks(linked, new Map([[record.id, record]]));
      } catch (error) {
        return respond(
          {
            error:
              "Cette modification contredit les remboursements/annulations déjà saisis. Corrigez d’abord les frais concernés. " +
              error.message,
          },
          400,
        );
      }
    }
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
