import test from "node:test";
import assert from "node:assert/strict";
import { handleTechOrders, validateTechRecord, validTechDate } from "./tech-orders.js";
import worker from "./worker.js";
const service = {
  id: "test-service",
  revision: 0,
  name: "Test service",
  icon: "openai",
  logo: "",
  priceUsd: 20,
  rate: 260,
  saleDzd: 6200,
  months: 1,
};
const order = {
  id: "test-order",
  revision: 0,
  client: "CLIENT FICTIF",
  facebookUrl: "",
  notes: "",
  renewalOf: "",
  lines: [
    {
      id: "line-1",
      serviceId: "test-service",
      name: "Test service",
      start: "2026-10-25",
      end: "2026-11-25",
      priceUsd: 20,
      rate: 260,
      saleDzd: 6200,
      invoiceUrl: "",
      invoiceRef: "",
    },
  ],
};
class Bucket {
  map = new Map();
  counter = 0;
  async get(key) {
    const v = this.map.get(key);
    return v ? { etag: v.etag, text: async () => v.text } : null;
  }
  async put(key, text, options = {}) {
    const old = this.map.get(key);
    if (options.onlyIf?.etagMatches && old?.etag !== options.onlyIf.etagMatches) return null;
    if (options.onlyIf?.etagDoesNotMatch === "*" && old) return null;
    const etag = `e${++this.counter}`;
    this.map.set(key, { text, etag });
    return { etag };
  }
  async list({ prefix }) {
    return {
      objects: [...this.map.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
      truncated: false,
    };
  }
}
const actor = { role: "admin", username: "test" };
const request = (path, body) =>
  new Request(
    `https://example.test/api/tech-orders${path}`,
    body ? { method: "PUT", body: JSON.stringify(body) } : {},
  );
const respond = (body, status) => Response.json(body, { status });
test("Tech Orders denies anonymous and non-admin access, including read access", async () => {
  const env = { CLIENTS_BUCKET: new Bucket() };
  assert.equal((await handleTechOrders(request(""), env, { role: "editor" }, respond)).status, 403);
  assert.equal((await worker.fetch(request(""), env, {})).status, 401);
});
test("Tech Orders validates dates, safe links, numeric inputs and unique lines", () => {
  assert.equal(validTechDate("2026-02-30"), false);
  for (const bad of [
    { ...service, priceUsd: null },
    { ...service, rate: 0 },
    { ...service, months: 0 },
    { ...service, logo: '<svg onload="alert(1)">' },
  ])
    assert.throws(() => validateTechRecord("services", bad, service.id));
  for (const bad of [
    { ...order, facebookUrl: "javascript:alert(1)" },
    { ...order, lines: [order.lines[0], order.lines[0]] },
    { ...order, lines: [{ ...order.lines[0], end: "2026-10-01" }] },
    { ...order, lines: [{ ...order.lines[0], invoiceUrl: "https://user:password@site.test" }] },
  ])
    assert.throws(() => validateTechRecord("orders", bad, order.id));
  assert.equal(
    validateTechRecord("orders", { ...order, lines: [{ ...order.lines[0], saleDzd: 0 }] }, order.id)
      .lines[0].saleDzd,
    0,
  );
});
test("Tech Orders cloud writes are isolated, versioned and conflict protected", async () => {
  const env = { CLIENTS_BUCKET: new Bucket() };
  assert.equal(
    (await handleTechOrders(request("/orders/test-order", order), env, actor, respond)).status,
    400,
  );
  let response = await handleTechOrders(
    request("/services/test-service", service),
    env,
    actor,
    respond,
  );
  assert.equal(response.status, 200);
  assert.equal(
    (await handleTechOrders(request("/orders/test-order", order), env, actor, respond)).status,
    200,
  );
  assert.equal(
    (await handleTechOrders(request("/orders/test-order", order), env, actor, respond)).status,
    409,
  );
  response = await handleTechOrders(
    request("/services/test-service", { ...service, revision: 1, priceUsd: 25 }),
    env,
    actor,
    respond,
  );
  assert.equal(response.status, 200);
  const data = await (await handleTechOrders(request(""), env, actor, respond)).json();
  assert.equal(data.services[0].priceUsd, 25);
  assert.equal(data.orders[0].lines[0].priceUsd, 20);
  assert.ok([...env.CLIENTS_BUCKET.map.keys()].every((key) => key.startsWith("tech-orders/v1/")));
  assert.ok(
    [...env.CLIENTS_BUCKET.map.keys()].some((key) => key.startsWith("tech-orders/v1/history/")),
  );
});
test("Tech Orders enforces actual body size even without a Content-Length header", async () => {
  const req = new Request("https://example.test/api/tech-orders/services/test-service", {
    method: "PUT",
    body: " ".repeat(260001),
  });
  assert.equal(
    (await handleTechOrders(req, { CLIENTS_BUCKET: new Bucket() }, actor, respond)).status,
    413,
  );
});
