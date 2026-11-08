import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TechPaymentButtons } from "../components/tech-payment-buttons";
import { TechClientHistory } from "../components/tech-client-history";
import { groupTechClients } from "./tech-client-groups";
import {
  renewTechOrder,
  newTechOrderForClient,
  orderTotals,
  techOrderState,
  type TechOrder,
} from "./tech-orders";
const order: TechOrder = {
  id: "fixture",
  revision: 1,
  client: "Test",
  facebookUrl: "",
  notes: "Pas encore payé",
  renewalOf: "",
  lines: [
    {
      id: "line",
      serviceId: "s",
      name: "Service",
      start: "2026-11-01",
      end: "2026-12-01",
      priceUsd: 20,
      rate: 260,
      saleDzd: 6200,
      invoiceUrl: "",
      invoiceRef: "",
    },
  ],
};
test("Payment controls use SVG, explicit labels and separate green/red selected states; legacy data stays unknown", () => {
  const render = (value: TechOrder) =>
    renderToStaticMarkup(createElement(TechPaymentButtons, { order: value, onChange: () => {} }));
  const unknown = render(order);
  assert.match(unknown, /À renseigner/);
  assert.equal((unknown.match(/aria-pressed="false"/g) || []).length, 2);
  const paid = render({ ...order, paymentStatus: "paid" });
  assert.match(paid, /bg-emerald-600 text-white/);
  assert.match(paid, /aria-pressed="true"/);
  assert.doesNotMatch(paid, /À renseigner/);
  const unpaid = render({ ...order, paymentStatus: "unpaid" });
  assert.match(unpaid, /bg-red-600 text-white/);
  assert.match(unpaid, /<svg/);
  assert.match(unpaid, /Non payé/);
});
test("Payment never changes totals or subscription state and cannot carry into a new sale or renewal", () => {
  const paid = { ...order, paymentStatus: "paid" as const };
  assert.deepEqual(orderTotals(paid), orderTotals(order));
  assert.equal(techOrderState(paid, "2026-11-08"), techOrderState(order, "2026-11-08"));
  assert.equal(renewTechOrder(paid, [], 1, "2026-11-08").paymentStatus, undefined);
  assert.equal(newTechOrderForClient(paid).paymentStatus, undefined);
});
test("Both surfaces expose latest-sale payment while preserving independently unpaid history", () => {
  const previous = {
    ...order,
    id: "old",
    paymentStatus: "unpaid" as const,
    lines: [{ ...order.lines[0], start: "2026-10-01", end: "2026-11-01" }],
  };
  const group = groupTechClients([previous, { ...order, paymentStatus: "paid" }], "2026-11-08")[0];
  for (const mobile of [true, false]) {
    const html = renderToStaticMarkup(
      createElement(TechClientHistory, {
        group,
        today: "2026-11-08",
        mobile,
        logo: () => null,
        menu: null,
        onContact: () => {},
        onPaymentChange: () => {},
      }),
    );
    assert.match(html, mobile ? /Dernière vente/ : /Vente de cette période/);
    assert.match(html, /Historique : 1 vente\(s\) non payée/);
    assert.match(html, /bg-emerald-600 text-white/);
  }
});
