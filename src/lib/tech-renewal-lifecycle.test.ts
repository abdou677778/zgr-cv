import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  renewTechOrder,
  filterTechOrders,
  emptyTechFilters,
  techOrderState,
  techOrderIsRenewalHistory,
  techRenewedLineIds,
  techOrdersTotals,
  type TechOrder,
} from "./tech-orders";
const source: TechOrder = {
  id: "parent",
  revision: 1,
  client: "CLIENT FICTIF",
  facebookUrl: "",
  notes: "",
  renewalOf: "",
  lines: [
    {
      id: "old-line",
      serviceId: "service",
      name: "Test",
      start: "2026-08-22",
      end: "2026-09-22",
      priceUsd: 5,
      rate: 260,
      saleDzd: 1900,
      invoiceUrl: "",
      invoiceRef: "",
    },
  ],
};
test("Late renewal accepts the real resumption date instead of forcing today or the previous expiry", () => {
  const next = renewTechOrder(source, [], 1, "2026-09-28", "2026-09-24");
  assert.equal(next.lines[0].start, "2026-09-24");
  assert.equal(next.lines[0].end, "2026-10-24");
  assert.equal(techOrderState(next, "2026-09-28"), "active");
  assert.equal(techOrderState(next, "2026-10-27"), "inactive");
  assert.equal(renewTechOrder(source, [], 1, "2026-09-28").lines[0].start, "2026-09-28");
  assert.equal(source.lines[0].end, "2026-09-22");
});
test("Saved effective renewal removes the previous period from inactive filters without removing its financial history", () => {
  const child = renewTechOrder(source, [], 1, "2026-09-28", "2026-09-24");
  const orders = [source, child];
  assert.equal(techOrderIsRenewalHistory(source, orders, "2026-09-28"), true);
  assert.equal(
    filterTechOrders(orders, { ...emptyTechFilters, state: "inactive" }, "2026-09-28").length,
    0,
  );
  assert.equal(
    filterTechOrders(orders, { ...emptyTechFilters, state: "active" }, "2026-09-28")[0].id,
    child.id,
  );
  assert.equal(filterTechOrders(orders, emptyTechFilters, "2026-09-28").length, 2);
  assert.equal(techOrdersTotals(orders).sale, 3800);
  assert.equal(
    filterTechOrders([source], { ...emptyTechFilters, state: "inactive" }, "2026-09-28")[0].id,
    source.id,
  );
});
test("Future and partial renewals cannot mark an unrelated or not-yet-resumed service as renewed", () => {
  const child = renewTechOrder(source, [], 1, "2026-09-24", "2026-10-01");
  assert.equal(techOrderIsRenewalHistory(source, [source, child], "2026-09-24"), false);
  assert.equal(techOrderState(child, "2026-09-24"), "inactive");
  const partial = {
    ...source,
    lines: [...source.lines, { ...source.lines[0], id: "second", serviceId: "other" }],
  };
  const effective = { ...child, lines: [{ ...child.lines[0], start: "2026-09-24" }] };
  assert.equal(techOrderIsRenewalHistory(partial, [partial, effective], "2026-09-28"), false);
  assert.deepEqual(
    [...techRenewedLineIds(partial, [partial, effective], "2026-09-28")],
    ["old-line"],
  );
  assert.equal(techOrderState(partial, "2026-09-28", [partial, effective]), "inactive");
  assert.equal(
    techOrderIsRenewalHistory(
      source,
      [source, { ...effective, client: "OTHER CLIENT" }],
      "2026-09-28",
    ),
    false,
  );
});
test("Renewal preparation includes an explicit date and is guarded as an unsaved draft; removal is available in shared menu", () => {
  const code = readFileSync(
    new URL("../components/tech-orders-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(code, /Début réel du nouveau renouvellement/);
  assert.match(code, /renewContinuity \? undefined : renewStart/);
  assert.match(code, /financeDirty \|\| renewSource/);
  assert.match(code, /Supprimer la vente/);
  assert.match(code, /Confirmation de suppression/);
  assert.match(code, /deleteConfirmation.trim\(\) !== label/);
  assert.doesNotMatch(code, /window.prompt/);
  assert.match(code, /method: "DELETE"/);
});
