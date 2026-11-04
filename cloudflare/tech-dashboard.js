const PREFIX = "tech-orders/v1/current/";
const CACHE_KEY = "tech-orders/v1/cache/dashboard-v1.json";
/** Private derived view. A fresh listing checks every object's ETag before reuse.
 * The cache is outside current/, so it never invalidates itself or enters the ledger.
 * Concurrent rebuilds may replace each other; mismatching versions are never reused.
 */
export async function readTechDashboard(bucket) {
  const objects = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix: PREFIX, cursor, limit: 500 });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const versioned = objects.every(
    (object) => typeof object.etag === "string" && object.etag.length > 0,
  );
  let signature = "";
  if (versioned) {
    const version = JSON.stringify(
      objects.map((object) => [object.key, object.etag]).sort((a, b) => a[0].localeCompare(b[0])),
    );
    signature = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(version))),
    ]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    try {
      const cached = await bucket.get(CACHE_KEY);
      if (cached) {
        const snapshot = JSON.parse(await cached.text());
        if (
          snapshot.signature === signature &&
          snapshot.schema === 1 &&
          Array.isArray(snapshot.data?.orders) &&
          Array.isArray(snapshot.data?.services) &&
          snapshot.data?.logos &&
          snapshot.data?.finance
        )
          return snapshot.data;
      }
    } catch {
      /* A missing/corrupted derived cache must never hide the real ledger. */
    }
  }
  const data = {
    services: [],
    orders: [],
    logos: {},
    finance: { id: "main", revision: 0, entries: [] },
  };
  for (let offset = 0; offset < objects.length; offset += 8) {
    const values = await Promise.all(
      objects.slice(offset, offset + 8).map(async (object) => {
        const stored = await bucket.get(object.key);
        return stored ? { key: object.key, record: JSON.parse(await stored.text()) } : null;
      }),
    );
    for (const item of values) {
      if (!item) continue;
      if (item.key.startsWith(PREFIX + "logos/")) data.logos[item.record.id] = item.record;
      else if (item.key === PREFIX + "finance/main.json") data.finance = item.record;
      else if (item.key.startsWith(PREFIX + "services/")) data.services.push(item.record);
      else if (item.key.startsWith(PREFIX + "orders/") && !item.record.deletedAt)
        data.orders.push(item.record);
    }
  }
  if (versioned) {
    try {
      const serialized = JSON.stringify({ schema: 1, signature, data });
      // Bound the derived document; very large ledgers retain the uncached path.
      if (new TextEncoder().encode(serialized).byteLength <= 8 * 1024 * 1024)
        await bucket.put(CACHE_KEY, serialized, {
          httpMetadata: { contentType: "application/json" },
        });
    } catch {
      /* Cache storage is optional; the authoritative read has succeeded. */
    }
  }
  return data;
}
