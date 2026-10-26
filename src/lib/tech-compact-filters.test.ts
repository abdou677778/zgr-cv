import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TechOrderFilters } from "../components/tech-order-filters";
import {
  emptyTechFilters,
  filterTechOrders,
  techClients,
  techSortLabels,
  type TechOrder,
} from "./tech-orders";
const order = (
  id: string,
  client: string,
  createdAt: string,
  end: string,
  saleDzd: number,
): TechOrder => ({
  id,
  client,
  createdAt,
  revision: 1,
  facebookUrl: "",
  notes: "",
  renewalOf: "",
  lines: [
    {
      id: "line",
      serviceId: "service",
      name: "Service",
      start: "2026-10-01",
      end,
      saleDzd,
      priceUsd: 20,
      rate: 260,
      invoiceUrl: "",
      invoiceRef: "",
    },
  ],
});
const orders = [
  order("a", "Adam", "2026-10-01T10:00:00Z", "2026-10-28", 6000),
  order("b", "Zineb", "2026-10-02T10:00:00Z", "2026-11-02", 7000),
];
test("Compact filters keep one visible search, a collapsed filter/tri panel and no duplicated state select", () => {
  const html = renderToStaticMarkup(
    createElement(TechOrderFilters, {
      filters: emptyTechFilters,
      clients: techClients(orders),
      services: [],
      today: "2026-10-26",
      onChange: () => {},
    }),
  );
  assert.match(html, /aria-label="Recherche rapide"/);
  assert.match(html, /<details[^>]*id="tech-filter-controls"/);
  assert.doesNotMatch(html, /<details[^>]*\bopen(?:=|\s|>)/);
  assert.match(html, /Filtres et tri/);
  assert.doesNotMatch(html, /<option value="(?:active|inactive)"/);
  assert.doesNotMatch(html, /Tous les états|Filtrer par état/);
  assert.equal(
    (
      html.match(
        /<option value="(?:recent|oldest|ending|ending-desc|client|client-desc|sale-desc|sale-asc)"/g,
      ) || []
    ).length,
    8,
  );
});
test("Hidden filters stay visible as removable chips and preserve their exact values", () => {
  const filters = {
    ...emptyTechFilters,
    client: techClients(orders)[0].key,
    orderId: "TECH-a",
    serviceId: "service",
    from: "2026-10-01",
    to: "2026-10-31",
    sort: "sale-asc" as const,
  };
  const html = renderToStaticMarkup(
    createElement(TechOrderFilters, {
      filters,
      clients: techClients(orders),
      services: [],
      today: "2026-10-26",
      onChange: () => {},
    }),
  );
  assert.match(html, /4 filtre\(s\) avancé\(s\) actif\(s\)/);
  assert.match(html, /Retirer le filtre Client : Adam/);
  assert.match(html, /Retirer le filtre Commande : TECH-a/);
  assert.match(html, /2026-10-01 → 2026-10-31/);
  assert.match(html, /Montant croissant/);
});
test("All eight sorting choices work in both directions without changing totals or the source", () => {
  const expected = {
    recent: "b",
    oldest: "a",
    ending: "a",
    "ending-desc": "b",
    client: "a",
    "client-desc": "b",
    "sale-desc": "b",
    "sale-asc": "a",
  };
  for (const sort of Object.keys(techSortLabels) as (keyof typeof techSortLabels)[]) {
    const sorted = filterTechOrders(orders, { ...emptyTechFilters, sort }, "2026-10-26");
    assert.equal(sorted[0].id, expected[sort], sort);
    assert.equal(
      sorted.reduce((sum, order) => sum + order.lines[0].saleDzd, 0),
      13000,
    );
  }
  const expired = order("c", "Expired", "2026-10-01T10:00:00Z", "2026-10-20", 100);
  for (const sort of ["ending", "ending-desc"] as const)
    assert.equal(
      filterTechOrders([expired, ...orders], { ...emptyTechFilters, sort }, "2026-10-26").at(-1)
        ?.id,
      "c",
    );
  assert.deepEqual(
    orders.map((order) => order.id),
    ["a", "b"],
  );
});
