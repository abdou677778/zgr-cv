import test from "node:test";
import assert from "node:assert/strict";
import { handleTechOrders } from "./tech-orders.js";

class Bucket {
  map = new Map();
  counter = 0;
  async get(key) {
    const item = this.map.get(key);
    return item ? { etag: item.etag, text: async () => item.text } : null;
  }
  async put(key, text, options = {}) {
    const old = this.map.get(key);
    if (options.onlyIf?.etagMatches && options.onlyIf.etagMatches !== old?.etag) return null;
    if (options.onlyIf?.etagDoesNotMatch === "*" && old) return null;
    const etag = `v${++this.counter}`;
    this.map.set(key, { text, etag });
    return { etag };
  }
  async list({ prefix }) {
    return {
      objects: [...this.map.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key, etag: this.map.get(key).etag })),
      truncated: false,
    };
  }
}
const order = {
  id: "fixture",
  client: "Client fictif",
  facebookUrl: "",
  notes: "",
  revision: 1,
  lines: [],
};
const respond = (body, status) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function setup() {
  const env = {
    CLIENTS_BUCKET: new Bucket(),
    TECH_CREDENTIALS_KEY: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
  };
  await env.CLIENTS_BUCKET.put("tech-orders/v1/current/orders/fixture.json", JSON.stringify(order));
  await env.CLIENTS_BUCKET.put(
    "tech-orders/v1/current/orders/renewal.json",
    JSON.stringify({ ...order, id: "renewal" }),
  );
  const call = (method, body, suffix = "", id = "fixture", role = "admin") =>
    handleTechOrders(
      new Request(`https://example.com/api/tech-orders/orders/${id}/credentials${suffix}`, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
      { role, username: "admin-test" },
      respond,
    );
  return { env, call };
}
test("Credentials encrypt at rest, share the client identity across renewals, and reveal only on explicit POST", async () => {
  const { env, call } = await setup();
  const input = { revision: 0, email: "client@example.com", password: "مفتاح-test-Only-123" };
  const saved = await call("PUT", input);
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { revision: 1, email: input.email, hasPassword: true });
  const metadata = await call("GET", undefined, "", "renewal");
  assert.equal(metadata.headers.get("Cache-Control"), "no-store");
  assert.equal((await metadata.json()).password, undefined);
  const raw = [...env.CLIENTS_BUCKET.map].find(([key]) => key.includes("private-credentials"))[1]
    .text;
  assert.ok(!raw.includes(input.password) && !raw.includes(input.email));
  assert.equal(
    (await (await call("POST", undefined, "/reveal", "renewal")).json()).password,
    input.password,
  );
  assert.equal((await call("GET", undefined, "/reveal")).status, 404);
  const dashboard = await handleTechOrders(
    new Request("https://example.com/api/tech-orders"),
    env,
    { role: "admin", username: "test" },
    respond,
  );
  const dashboardText = await dashboard.text();
  assert.ok(
    !dashboardText.includes(input.email) &&
      !dashboardText.includes(input.password) &&
      !dashboardText.includes("ciphertext"),
  );
  assert.deepEqual(
    JSON.parse(env.CLIENTS_BUCKET.map.get("tech-orders/v1/current/orders/fixture.json").text),
    order,
  );
});
test("Email-only edits preserve the secret; stale revisions and concurrent writes do not overwrite it", async () => {
  const { env, call } = await setup();
  await call("PUT", { revision: 0, email: "a@example.com", password: "first" });
  assert.equal((await call("PUT", { revision: 1, email: "b@example.com" })).status, 200);
  assert.equal((await (await call("POST", undefined, "/reveal")).json()).password, "first");
  assert.equal(
    (await call("PUT", { revision: 1, email: "c@example.com", password: "stale" })).status,
    409,
  );
  const put = env.CLIENTS_BUCKET.put.bind(env.CLIENTS_BUCKET);
  env.CLIENTS_BUCKET.put = async (key, body, options) =>
    key.includes("private-credentials") ? null : put(key, body, options);
  assert.equal(
    (await call("PUT", { revision: 2, email: "c@example.com", password: "race" })).status,
    409,
  );
  env.CLIENTS_BUCKET.put = put;
  assert.equal(
    (await call("PUT", { revision: 2, email: "b@example.com", password: "" })).status,
    200,
  );
  assert.equal((await (await call("GET")).json()).hasPassword, false);
});
test("Non-admins, missing keys, deleted clients, oversized and invalid inputs cannot access or replace credentials", async () => {
  const { env, call } = await setup();
  assert.equal((await call("GET", undefined, "", "fixture", "editor")).status, 403);
  assert.equal((await call("GET", undefined, "", "missing")).status, 404);
  for (const bad of [
    { revision: 0, email: "wrong", password: "x" },
    { revision: 0, email: "", password: "x".repeat(2049) },
    { revision: 0, email: "", password: {} },
    { revision: -1, email: "" },
    { revision: 0, email: "", password: "x".repeat(9000) },
  ])
    assert.equal((await call("PUT", bad)).status, 400);
  delete env.TECH_CREDENTIALS_KEY;
  assert.equal((await call("PUT", { revision: 0, email: "", password: "secret" })).status, 503);
  assert.ok(![...env.CLIENTS_BUCKET.map.keys()].some((key) => key.includes("private-credentials")));
});
test("Corrupted ciphertext fails closed instead of erasing or returning a password", async () => {
  const { env, call } = await setup();
  await call("PUT", { revision: 0, email: "a@example.com", password: "secret" });
  const key = [...env.CLIENTS_BUCKET.map.keys()].find((key) => key.includes("private-credentials"));
  const envelope = JSON.parse(env.CLIENTS_BUCKET.map.get(key).text);
  envelope.ciphertext = "AAAA";
  await env.CLIENTS_BUCKET.put(key, JSON.stringify(envelope));
  assert.equal((await call("POST", undefined, "/reveal")).status, 503);
  assert.equal((await call("PUT", { revision: 0, email: "", password: "overwrite" })).status, 503);
});
