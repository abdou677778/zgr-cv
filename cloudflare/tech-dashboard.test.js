import test from "node:test";
import assert from "node:assert/strict";
import { readTechDashboard } from "./tech-dashboard.js";
const root = "tech-orders/v1/current/";
class Bucket {
  records = new Map();
  revision = 0;
  reads = [];
  writes = [];
  lists = 0;
  async put(key, value) {
    this.writes.push(key);
    this.records.set(key, { text: value, etag: `v${++this.revision}` });
  }
  async get(key) {
    this.reads.push(key);
    const item = this.records.get(key);
    return item ? { text: async () => item.text } : null;
  }
  async list({ prefix, cursor, limit }) {
    this.lists++;
    const records = [...this.records]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, item]) => ({ key, etag: item.etag }));
    const offset = Number(cursor || 0),
      end = offset + limit;
    return {
      objects: records.slice(offset, end),
      truncated: end < records.length,
      cursor: String(end),
    };
  }
  reset() {
    this.reads = [];
    this.writes = [];
    this.lists = 0;
  }
}
test("Warm dashboard uses one snapshot read, while checking current ETags on every request", async () => {
  const bucket = new Bucket();
  for (let i = 0; i < 120; i++)
    await bucket.put(
      `${root}orders/o-${i}.json`,
      JSON.stringify({ id: `o-${i}`, revision: 1, lines: [], saleDzd: 1900 }),
    );
  await bucket.put(root + "services/s.json", JSON.stringify({ id: "s", name: "Service" }));
  bucket.reset();
  const cold = await readTechDashboard(bucket);
  assert.equal(cold.orders.length, 120);
  assert.equal(bucket.reads.length, 122);
  assert.deepEqual(bucket.writes, ["tech-orders/v1/cache/dashboard-v1.json"]);
  bucket.reset();
  const warm = await readTechDashboard(bucket);
  assert.deepEqual(warm, cold);
  assert.equal(bucket.reads.length, 1);
  assert.equal(bucket.lists, 1);
  assert.equal(bucket.writes.length, 0);
  await bucket.put(
    root + "orders/o-0.json",
    JSON.stringify({ id: "o-0", revision: 2, deletedAt: "2026-11-04" }),
  );
  const changed = await readTechDashboard(bucket);
  assert.equal(changed.orders.length, 119);
  assert.ok(!changed.orders.some((o) => o.id === "o-0"));
  await bucket.put(root + "logos/s.json", JSON.stringify({ id: "s", dataUrl: "logo" }));
  assert.equal((await readTechDashboard(bucket)).logos.s.dataUrl, "logo");
});
test("Snapshot changes on finance, additions, removals and changes from another worker", async () => {
  const bucket = new Bucket();
  await bucket.put(
    root + "finance/main.json",
    JSON.stringify({ id: "main", revision: 1, entries: [] }),
  );
  await readTechDashboard(bucket);
  await bucket.put(
    root + "finance/main.json",
    JSON.stringify({ id: "main", revision: 2, entries: [{ amountDzd: 100 }] }),
  );
  assert.equal((await readTechDashboard(bucket)).finance.revision, 2);
  await bucket.put(root + "services/s.json", JSON.stringify({ id: "s" }));
  assert.equal((await readTechDashboard(bucket)).services.length, 1);
  bucket.records.delete(root + "services/s.json");
  assert.equal((await readTechDashboard(bucket)).services.length, 0);
});
test("Missing ETags, corrupt cache, failed cache storage and pagination preserve real data", async () => {
  const bucket = new Bucket();
  for (let i = 0; i < 510; i++)
    await bucket.put(`${root}orders/o-${i}.json`, JSON.stringify({ id: `o-${i}`, lines: [] }));
  await bucket.put("tech-orders/v1/cache/dashboard-v1.json", "broken-json");
  assert.equal((await readTechDashboard(bucket)).orders.length, 510);
  assert.equal(bucket.lists, 2);
  await bucket.put(root + "services/s.json", JSON.stringify({ id: "s" }));
  bucket.put = async () => {
    throw Error("cache unavailable");
  };
  assert.equal((await readTechDashboard(bucket)).services.length, 1);
  const originalList = bucket.list.bind(bucket);
  bucket.list = async (args) => {
    const page = await originalList(args);
    return { ...page, objects: page.objects.map(({ key }) => ({ key })) };
  };
  assert.equal((await readTechDashboard(bucket)).orders.length, 510);
});
