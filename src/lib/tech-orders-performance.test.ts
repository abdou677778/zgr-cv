import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { TechHistoryDisclosure } from "../components/tech-client-history";
import { emptyTechFilters, type TechOrder, techOrdersTotals } from "./tech-orders";
import { filterTechClientGroups, groupTechClients } from "./tech-client-groups";
import { formatTechMoney } from "./tech-order-display";
test("Large synthetic ledger reuses indexed groups and keeps complete totals across page boundaries", () => {
  const orders: TechOrder[] = Array.from({ length: 10000 }, (_, i) => ({
    id: `o-${i}`,
    revision: 1,
    client: `Client ${Math.floor(i / 5)}`,
    facebookUrl: "",
    notes: "",
    renewalOf: "",
    createdAt: "2026-10-24T10:00:00Z",
    lines: [
      {
        id: `l-${i}`,
        serviceId: "s",
        name: "Service",
        start: "2026-10-24",
        end: "2026-11-24",
        priceUsd: 20,
        rate: 260,
        saleDzd: 6200,
        invoiceUrl: "",
        invoiceRef: "",
      },
    ],
  }));
  const groups = groupTechClients(orders, "2026-11-04");
  const filtered = filterTechClientGroups(
    orders,
    { ...emptyTechFilters, state: "active" },
    "2026-11-04",
    groups,
  );
  assert.equal(filtered.length, 2000);
  assert.ok(filtered.every((g) => groups.includes(g)));
  assert.equal(filtered.slice(25, 50).length, 25);
  assert.equal(techOrdersTotals(filtered.flatMap((g) => g.orders)).sale, 62000000);
  assert.equal(orders[0].lines[0].saleDzd, 6200);
  const query = {
    ...emptyTechFilters,
    query: "Client 100",
    from: "2026-01-01",
    dateBasis: "created" as const,
  };
  assert.deepEqual(
    filterTechClientGroups(orders, query, "2026-11-04", groups),
    filterTechClientGroups(orders, query, "2026-11-04"),
  );
});
test("Closed history never invokes financial details and monetary formatting stays identical", () => {
  let invoked = 0;
  const html = renderToStaticMarkup(
    createElement(TechHistoryDisclosure, {
      children: () => {
        invoked++;
        return "Financial details";
      },
    }),
  );
  assert.equal(invoked, 0);
  assert.doesNotMatch(html, /Financial details/);
  assert.match(html, /Plus d’infos/);
  const expected = new Intl.NumberFormat("fr-DZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  for (const amount of [0, 1.25, -1000, 6200, 1e8])
    assert.equal(formatTechMoney(amount), expected.format(amount) + " DA");
  assert.equal(formatTechMoney(NaN), "À saisir");
});
test("Only one responsive history is mounted and rendering is capped to 25 clients per page", () => {
  const source = readFileSync(
    new URL("../components/tech-orders-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /mobileLayout &&/);
  assert.match(source, /!mobileLayout &&/);
  assert.match(source, /groups.slice\(pageIndex \* 25, pageIndex \* 25 \+ 25\)/);
  assert.match(source, /useDeferredValue\(filters\)/);
  assert.doesNotMatch(source, /loadSharedSoftwareLogos\(true\)/);
  assert.match(source, /loadTechSoftwareLogos/);
});
