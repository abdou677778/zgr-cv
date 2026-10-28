import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sortTechServicesByName } from "./tech-service-sort";

test("Tech service cards sort A–Z without mutating cloud order, prices or records", () => {
  const services = [
    "Notion",
    "Claude",
    "ChatGPT Pro X20",
    " capcut Pro",
    "ChatGPT Pro X5",
    "École",
    "alpha",
  ].map((name, i) => ({ id: String(i), name, saleDzd: i * 100 }));
  const snapshot = structuredClone(services);
  const sorted = sortTechServicesByName(services);
  assert.deepEqual(
    sorted.map((s) => s.name.trim()),
    ["alpha", "capcut Pro", "ChatGPT Pro X5", "ChatGPT Pro X20", "Claude", "École", "Notion"],
  );
  assert.deepEqual(services, snapshot);
  assert.ok(sorted.every((s) => services.includes(s)));
  assert.deepEqual(sortTechServicesByName([]), []);
  assert.equal(
    sortTechServicesByName([...services, { id: "new", name: "Canva", saleDzd: 650 }])[1].name,
    "Canva",
  );
});

test("Both private cards and new-sale choices use the same reactive sorted list", () => {
  const source = readFileSync(
    new URL("../components/tech-orders-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /useMemo\(\(\) => sortTechServicesByName\(services\), \[services\]\)/);
  assert.match(source, /\{sortedServices\s*\.filter/);
  assert.match(source, /options=\{sortedServices\.map/);
});
