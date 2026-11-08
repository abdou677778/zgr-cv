import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TechClientHistory } from "../components/tech-client-history";
import { groupTechClients } from "./tech-client-groups";
import type { TechOrder } from "./tech-orders";
const orders: TechOrder[] = Array.from({ length: 5 }, (_, i) => ({
  id: `order-${i}`,
  revision: 1,
  client: "Client test",
  facebookUrl: "",
  notes: "",
  renewalOf: "",
  paymentStatus: i === 0 ? "paid" : "unpaid",
  lines: [
    {
      id: `line-${i}`,
      serviceId: `s-${i}`,
      name: `Service ${i}`,
      start: `2026-10-0${i + 1}`,
      end: i === 2 ? "2026-11-10" : i === 3 ? "2026-11-01" : "2026-12-01",
      priceUsd: 20,
      rate: 260,
      saleDzd: 6200,
      invoiceUrl: "",
      invoiceRef: "",
    },
  ],
}));
const render = (mobile: boolean, rowIndex = 0) =>
  renderToStaticMarkup(
    createElement(TechClientHistory, {
      group: groupTechClients(orders, "2026-11-08")[0],
      today: "2026-11-08",
      mobile,
      rowIndex,
      logo: () => null,
      menu: null,
      onContact: () => {},
    }),
  );
test("Client bands alternate across entire rows without adding service rows or changing ledger records", () => {
  const before = structuredClone(orders);
  const first = render(false, 0),
    next = render(false, 1);
  assert.match(first, /data-client-band="base"/);
  assert.match(next, /data-client-band="alternate"/);
  assert.match(next, /bg-indigo-50\/50/);
  assert.match(first, /border-t-2 border-slate-300/);
  assert.match(first, /hover:bg-indigo-100\/60 focus-within:bg-indigo-100\/60/);
  assert.equal((first.match(/<tr\b/g) || []).length, 1);
  assert.deepEqual(orders, before);
});
test("Five services collapse to two while their counts, imminent expiry and expired-service alerts remain visible", () => {
  for (const mobile of [true, false]) {
    const html = render(mobile);
    assert.match(html, /5 services · 5 périodes/);
    assert.match(html, /\+3 autres services/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /1 expire ≤ 3 j/);
    assert.match(html, /1 service expiré/);
    assert.match(html, /Service 0/);
    assert.match(html, /Service 1/);
    assert.doesNotMatch(html, /aria-label="(?:Plus d’infos — )?Service [234]"/);
    assert.match(html, /31.?000,00 DA/); // All five sales, not only displayed services.
  }
});
test("A duplicate in hidden services is still flagged and repeated renewals count as one service", () => {
  const duplicate = {
    ...orders[4],
    id: "duplicate",
    lines: [{ ...orders[4].lines[0], id: "dup-line" }],
  };
  const group = groupTechClients([...orders, duplicate], "2026-11-08")[0];
  const html = renderToStaticMarkup(
    createElement(TechClientHistory, {
      group,
      today: "2026-11-08",
      logo: () => null,
      menu: null,
      onContact: () => {},
    }),
  );
  assert.match(html, /5 services · 6 périodes/);
  assert.match(html, /Doublon à vérifier/);
  assert.match(html, /Totaux du registre non corrigés automatiquement/);
});
