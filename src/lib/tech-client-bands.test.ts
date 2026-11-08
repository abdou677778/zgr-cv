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
test("Spreadsheet bands alternate per client with merged identity and exact historical subtotal", () => {
  const before = structuredClone(orders);
  const first = render(false, 0),
    next = render(false, 1);
  assert.match(first, /data-client-band="base"/);
  assert.match(next, /data-client-band="alternate"/);
  assert.match(next, /bg-indigo-50\/50/);
  assert.match(first, /border-t-2 border-indigo-200/);
  assert.match(first, /hover:bg-indigo-100\/60 focus-within:bg-indigo-100\/60/);
  assert.equal((first.match(/data-service-row=/g) || []).length, 5);
  assert.equal((first.match(/data-client-subtotal/g) || []).length, 1);
  assert.match(first, /rowSpan="6"/i);
  assert.match(first, /Total client/);
  assert.deepEqual(orders, before);
});
test("Mobile collapses services with alerts; desktop exposes every service with separate columns", () => {
  for (const mobile of [true, false]) {
    const html = render(mobile);
    assert.match(html, /5 services · 5 périodes/);
    if (mobile) assert.match(html, /\+3 autres services/);
    assert.match(html, /aria-expanded="false"/);
    if (mobile) {
      assert.match(html, /1 expire ≤ 3 j/);
      assert.match(html, /1 service expiré/);
    } else {
      assert.match(html, /Expire ≤ 3 j/);
      assert.match(html, /Expiré/);
    }
    assert.match(html, /Service 0/);
    assert.match(html, /Service 1/);
    if (mobile) assert.doesNotMatch(html, /aria-label="(?:Plus d’infos — )?Service [234]"/);
    else for (const id of [2, 3, 4]) assert.match(html, new RegExp(`aria-label="Service ${id}"`));
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

test("One sale with two services keeps one payment scope and a subtotal without double counting", () => {
  const sale = {
    ...orders[0],
    lines: [orders[0].lines[0], { ...orders[1].lines[0], saleDzd: 7000 }],
  };
  const before = structuredClone(sale);
  const group = groupTechClients([sale], "2026-11-08")[0];
  const html = renderToStaticMarkup(
    createElement(TechClientHistory, {
      group,
      today: "2026-11-08",
      logo: () => null,
      menu: null,
      onContact: () => {},
      onPaymentChange: () => {},
    }),
  );
  assert.deepEqual(group.totals, { cost: 10400, sale: 13200, margin: 2800 });
  assert.match(html, /13.?200,00 DA/);
  assert.equal((html.match(/Paiement commun à cette vente/g) || []).length, 2);
  assert.equal(
    (html.match(/aria-label="Payé — Marquer TECH-ORDER-0 comme non payé"/g) || []).length,
    2,
  );
  assert.match(html, /rowSpan="3"/i);
  assert.deepEqual(sale, before);
});
