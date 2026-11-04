import test from "node:test";
import assert from "node:assert/strict";
import { createTechDashboardMemory, type TechDashboard } from "./tech-dashboard-memory";
import { readFileSync } from "node:fs";
const data: TechDashboard = {
  services: [],
  orders: [],
  logos: {},
  finance: { id: "main", revision: 0, entries: [] },
};
test("Financial memory cache is session-scoped, expires, and is never persisted to browser storage", () => {
  let now = 1000;
  const cache = createTechDashboardMemory(() => now);
  cache.put("session-a", data);
  assert.equal(cache.read("session-a"), data);
  assert.equal(cache.read("session-b"), undefined);
  assert.equal(cache.read("session-a"), undefined);
  cache.put("session-a", data);
  now += 300001;
  assert.equal(cache.read("session-a"), undefined);
  cache.put("", data);
  assert.equal(cache.read(""), undefined);
  cache.put("session-a", data);
  cache.clear();
  assert.equal(cache.read("session-a"), undefined);
  const source = readFileSync(new URL("./tech-dashboard-memory.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /localStorage\.|sessionStorage\.|indexedDB\./);
});
test("A saved change replaces the session snapshot without mutating the old ledger", () => {
  const cache = createTechDashboardMemory();
  cache.put("session", data);
  const updated = { ...data, finance: { ...data.finance, revision: 1 } };
  cache.put("session", updated);
  assert.equal(cache.read("session")?.finance.revision, 1);
  assert.equal(data.finance.revision, 0);
});
