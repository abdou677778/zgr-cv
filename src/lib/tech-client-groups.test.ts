import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyTechFilters, type TechOrder } from "./tech-orders";
import { groupTechClients, filterTechClientGroups } from "./tech-client-groups";

function order(id: string, start: string, end: string, saleDzd = 1900): TechOrder {
  return {
    id,
    revision: 1,
    client: "Imad Meddahi",
    facebookUrl: "https://facebook.com/test",
    notes: "Pas encore payé",
    renewalOf: "",
    lines: [
      {
        id: `${id}-line`,
        serviceId: "go",
        name: "ChatGPT Go",
        start,
        end,
        priceUsd: 5,
        rate: 260,
        saleDzd,
        invoiceUrl: "",
        invoiceRef: "",
      },
    ],
  };
}
const old = order("old", "2026-08-22", "2026-09-22");
const next = order("next", "2026-10-24", "2026-11-24");
test("One client, chronological periods, independent prices and exact ledger totals", () => {
  const group = groupTechClients(
    [{ ...next, lines: [{ ...next.lines[0], saleDzd: 2200 }] }, old],
    "2026-10-28",
  )[0];
  assert.deepEqual(
    group.periods.map((p) => p.line.start),
    ["2026-08-22", "2026-10-24"],
  );
  assert.equal(group.state, "active");
  assert.deepEqual(group.totals, { cost: 2600, sale: 4100, margin: 1500 });
  assert.equal(old.lines[0].saleDzd, 1900);
});
test("Confirmed 1900 renewal gives 3800 revenue / 2600 cost / 1200 margin without changing unpaid notes", () => {
  const group = groupTechClients([old, next], "2026-10-28")[0];
  assert.deepEqual(group.totals, { cost: 2600, sale: 3800, margin: 1200 });
  assert.equal(group.latest.notes, "Pas encore payé");
  assert.equal(group.duplicates.size, 0);
});
test("Conflicting duplicate periods are flagged, never silently discarded from financial ledger", () => {
  const wrong = order("wrong", "2026-10-24", "2026-11-24", 2200);
  const group = groupTechClients([old, next, wrong], "2026-10-28")[0];
  assert.equal(group.duplicates.size, 2);
  assert.equal(group.orders.length, 3);
  assert.equal(group.totals.sale, 6000);
});
test("Active filter preserves full client history; inactive filter excludes an active client", () => {
  assert.equal(
    filterTechClientGroups([old, next], { ...emptyTechFilters, state: "active" }, "2026-10-28")[0]
      .periods.length,
    2,
  );
  assert.equal(
    filterTechClientGroups([old, next], { ...emptyTechFilters, state: "inactive" }, "2026-10-28")
      .length,
    0,
  );
  assert.equal(
    filterTechClientGroups([old, next], { ...emptyTechFilters, orderId: "old" }, "2026-10-28")[0]
      .orders.length,
    2,
  );
});
test("Same name with another contact is not merged, deleted orders are excluded, ending state wins", () => {
  const other = { ...next, id: "other", facebookUrl: "https://facebook.com/other" };
  assert.equal(
    groupTechClients(
      [old, next, other, { ...old, id: "deleted", deletedAt: "2026-10-28" }],
      "2026-10-28",
    ).length,
    2,
  );
  assert.equal(groupTechClients([old, next], "2026-11-22")[0].state, "ending");
});
