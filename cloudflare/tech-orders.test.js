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
test("Renewal contact metadata persists, accepts legacy lines and rejects invalid timestamps", () => {
  const renewalContact = { start: "2026-09-01", end: "2026-10-01", at: "2026-10-01T10:00:00.000Z" };
  const value = { ...order, lines: [{ ...order.lines[0], renewalContact }] };
  assert.deepEqual(
    validateTechRecord("orders", value, order.id).lines[0].renewalContact,
    renewalContact,
  );
  assert.equal(validateTechRecord("orders", order, order.id).lines[0].renewalContact, undefined);
  for (const contact of [
    null,
    { ...renewalContact, at: "wrong" },
    { ...renewalContact, at: "2099-01-01T00:00:00.000Z" },
    { ...renewalContact, start: "2026-02-30" },
    { ...renewalContact, end: renewalContact.start },
  ])
    assert.throws(() =>
      validateTechRecord(
        "orders",
        { ...value, lines: [{ ...value.lines[0], renewalContact: contact }] },
        order.id,
      ),
    );
  const removed = validateTechRecord(
    "orders",
    { ...value, lines: [{ ...value.lines[0], renewalContact: undefined }] },
    order.id,
  );
  assert.equal(removed.lines[0].renewalContact, undefined);
});
const actor = { role: "admin", username: "test" };
const request = (path, body) =>
  new Request(
    `https://example.test/api/tech-orders${path}`,
    body ? { method: "PUT", body: JSON.stringify(body) } : {},
  );
const respond = (body, status) => Response.json(body, { status });

test("Contact confirmation survives cloud reload, rejects stale writes, and can be undone", async () => {
  const env = { CLIENTS_BUCKET: new Bucket() };
  await handleTechOrders(request("/services/test-service", service), env, actor, respond);
  const renewalContact = {
    start: order.lines[0].start,
    end: order.lines[0].end,
    at: "2026-10-01T10:00:00.000Z",
  };
  const input = { ...order, lines: [{ ...order.lines[0], renewalContact }] };
  assert.equal(
    (await handleTechOrders(request("/orders/test-order", input), env, actor, respond)).status,
    200,
  );
  const read = await (await handleTechOrders(request(""), env, actor, respond)).json();
  assert.deepEqual(read.orders[0].lines[0].renewalContact, renewalContact);
  assert.equal(
    (await handleTechOrders(request("/orders/test-order", input), env, actor, respond)).status,
    409,
  );
  const undo = {
    ...read.orders[0],
    lines: [{ ...read.orders[0].lines[0], renewalContact: undefined }],
  };
  assert.equal(
    (await handleTechOrders(request("/orders/test-order", undo), env, actor, respond)).status,
    200,
  );
  const fresh = await (await handleTechOrders(request(""), env, actor, respond)).json();
  assert.equal(fresh.orders[0].lines[0].renewalContact, undefined);
  assert.ok([...env.CLIENTS_BUCKET.map.keys()].some((key) => key.includes("history/orders/")));
});
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
    { ...service, rate: 1e-10 },
    { ...service, priceUsd: 1.005 },
    { ...service, rate: 100000000 },
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

test("Tech cloud reads retain every record with at most eight parallel R2 reads", async () => {
  const bucket = new Bucket();
  for (let i = 0; i < 30; i++)
    await bucket.put(
      `tech-orders/v1/current/services/s-${i}.json`,
      JSON.stringify({ ...service, id: `s-${i}` }),
    );
  let live = 0,
    peak = 0;
  const read = bucket.get.bind(bucket);
  bucket.get = async (key) => {
    live++;
    peak = Math.max(peak, live);
    await new Promise((resolve) => setTimeout(resolve, 1));
    const value = await read(key);
    live--;
    return value;
  };
  const response = await handleTechOrders(request(""), { CLIENTS_BUCKET: bucket }, actor, respond);
  assert.equal((await response.json()).services.length, 30);
  assert.ok(peak > 1 && peak <= 8);
});

test("Cloud logo size limit agrees with the adaptive 150 KiB client encoder", () => {
  const logo = (size) => {
    const bytes = new Uint8Array(size);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 256);
    view.setUint32(20, 256);
    return "data:image/png;base64," + Buffer.from(bytes).toString("base64");
  };
  assert.equal(
    validateTechRecord(
      "logos",
      { id: "logo-test", revision: 0, icon: "generic", dataUrl: logo(153600) },
      "logo-test",
    ).icon,
    "generic",
  );
  assert.throws(() =>
    validateTechRecord(
      "logos",
      { id: "logo-test", revision: 0, icon: "generic", dataUrl: logo(153601) },
      "logo-test",
    ),
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

test("Tech logos persist separately even before prices are entered, with version checks and no CV writes", async () => {
  const env = { CLIENTS_BUCKET: new Bucket() };
  // Structural PNG header fixture for the existing dimension validator.
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(bytes.buffer).setUint32(16, 256);
  new DataView(bytes.buffer).setUint32(20, 256);
  const dataUrl = `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`;
  const body = { id: "new-service", revision: 0, icon: "googlegemini", dataUrl };
  let result = await handleTechOrders(request("/logos/new-service", body), env, actor, respond);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).record.revision, 1);
  const reloaded = await (await handleTechOrders(request(""), env, actor, respond)).json();
  assert.equal(reloaded.logos["new-service"].dataUrl, dataUrl);
  assert.deepEqual(reloaded.orders, []);
  assert.deepEqual(reloaded.services, []);
  assert.equal(
    (await handleTechOrders(request("/logos/new-service", body), env, actor, respond)).status,
    409,
  );
  assert.equal(
    (
      await handleTechOrders(
        request("/logos/new-service", { ...body, revision: 1, dataUrl: "data:image/svg+xml,bad" }),
        env,
        actor,
        respond,
      )
    ).status,
    400,
  );
  assert.equal(
    (await handleTechOrders(request("/logos/new-service", body), env, { role: "editor" }, respond))
      .status,
    403,
  );
  assert.ok([...env.CLIENTS_BUCKET.map.keys()].every((key) => key.startsWith("tech-orders/v1/")));
});

const financeEntry = (kind = "sponsor", amountDzd = 300) => ({
  id: `entry-${kind}`,
  date: "2026-10-26",
  kind,
  amountDzd,
  label: "TEST TECHNIQUE",
  orderId: ["refund", "cancellation", "supplier_credit"].includes(kind) ? order.id : "",
  voided: false,
});
const financeRecord = (entries = [financeEntry()], revision = 0) => ({
  id: "main",
  revision,
  entries,
});
test("Finance rejects malformed amounts, unsupported categories, missing order links and duplicate entry IDs", () => {
  for (const entry of [
    { ...financeEntry(), id: undefined },
    { ...financeEntry(), amountDzd: -1 },
    { ...financeEntry(), amountDzd: 1.005 },
    { ...financeEntry(), date: "2026-02-30" },
    { ...financeEntry(), kind: "unknown" },
    { ...financeEntry("refund"), orderId: "" },
  ])
    assert.throws(() => validateTechRecord("finance", financeRecord([entry]), "main"));
  assert.throws(() =>
    validateTechRecord("finance", financeRecord([financeEntry(), financeEntry()]), "main"),
  );
  assert.throws(() => validateTechRecord("finance", { ...financeRecord(), id: "other" }, "other"));
  assert.throws(() =>
    validateTechRecord(
      "finance",
      financeRecord(
        Array.from({ length: 1001 }, (_, i) => ({ ...financeEntry(), id: `entry-${i}` })),
      ),
      "main",
    ),
  );
});
test("Finance storage is admin-only, versioned and never appears as an order; neutralisation is reversible without deletion", async () => {
  const env = { CLIENTS_BUCKET: new Bucket() };
  await handleTechOrders(request("/services/test-service", service), env, actor, respond);
  await handleTechOrders(request("/orders/test-order", order), env, actor, respond);
  const body = financeRecord([financeEntry(), financeEntry("refund", 200)]);
  const tooMany = financeRecord(
    Array.from({ length: 26 }, (_, i) => ({ ...financeEntry(), id: `batch-${i}` })),
  );
  assert.equal(
    (await handleTechOrders(request("/finance/main", tooMany), env, actor, respond)).status,
    400,
  );
  assert.equal(
    (await handleTechOrders(request("/finance/main", body), env, { role: "editor" }, respond))
      .status,
    403,
  );
  assert.equal((await worker.fetch(request("/finance/main", body), env, {})).status, 401);
  assert.equal(
    (await handleTechOrders(request("/finance/main", body), env, actor, respond)).status,
    200,
  );
  const list = await (await handleTechOrders(request(""), env, actor, respond)).json();
  assert.equal(list.orders.length, 1);
  assert.equal(list.finance.entries.length, 2);
  assert.equal(list.finance.revision, 1);
  assert.equal(
    (await handleTechOrders(request("/finance/main", body), env, actor, respond)).status,
    409,
  );
  assert.equal(
    (await handleTechOrders(request("/finance/main", financeRecord([], 1)), env, actor, respond))
      .status,
    400,
  );
  const neutralised = body.entries.map((entry) => ({ ...entry, voided: true }));
  assert.equal(
    (
      await handleTechOrders(
        request("/finance/main", financeRecord(neutralised, 1)),
        env,
        actor,
        respond,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handleTechOrders(
        request("/finance/main", financeRecord(body.entries, 2)),
        env,
        actor,
        respond,
      )
    ).status,
    200,
  );
  assert.ok(
    [...env.CLIENTS_BUCKET.map.keys()].some((key) =>
      key.startsWith("tech-orders/v1/history/finance/main/"),
    ),
  );
  assert.ok([...env.CLIENTS_BUCKET.map.keys()].every((key) => key.startsWith("tech-orders/v1/")));
});
test("Finance rejects unknown sales and duplicate revenue deductions, and linked adjustments protect later order edits", async () => {
  const env = { CLIENTS_BUCKET: new Bucket() };
  await handleTechOrders(request("/services/test-service", service), env, actor, respond);
  await handleTechOrders(request("/orders/test-order", order), env, actor, respond);
  for (const entries of [
    [{ ...financeEntry("refund", 100), orderId: "missing" }],
    [financeEntry("refund", 6200), financeEntry("cancellation", 1)],
    [financeEntry("supplier_credit", 5201)],
  ])
    assert.equal(
      (
        await handleTechOrders(
          request("/finance/main", financeRecord(entries)),
          env,
          actor,
          respond,
        )
      ).status,
      400,
    );
  assert.equal(
    (
      await handleTechOrders(
        request("/finance/main", financeRecord([financeEntry("refund", 100)])),
        env,
        actor,
        respond,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handleTechOrders(
        request("/orders/test-order", {
          ...order,
          revision: 1,
          lines: [{ ...order.lines[0], saleDzd: 50 }],
        }),
        env,
        actor,
        respond,
      )
    ).status,
    400,
  );
});
