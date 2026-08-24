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

export async function onRequestGet(context) {
  if (!authorized(context)) return json({ error: "Accès non autorisé." }, 401);
  if (!context.env.CLIENTS_BUCKET) return json({ error: "Binding R2 CLIENTS_BUCKET absent." }, 503);

  const profiles = [];
  let cursor;
  do {
    const page = await context.env.CLIENTS_BUCKET.list({
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
  return json({ profiles });
}
