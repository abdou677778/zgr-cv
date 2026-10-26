import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  emptyTechFinance,
  financeMonthRange,
  techFinanceStats,
  type TechFinanceEntry,
} from "./tech-finance";
import { TechStatusTiles } from "../components/tech-status-tiles";
import { TechFinancePanel } from "../components/tech-finance-panel";
import type { TechOrder } from "./tech-orders";
const order: TechOrder = {
  id: "test-order",
  revision: 1,
  client: "CLIENT FICTIF",
  facebookUrl: "",
  notes: "",
  renewalOf: "",
  createdAt: "2026-09-30T23:30:00Z",
  lines: [
    {
      id: "line",
      serviceId: "sample",
      name: "Service",
      start: "2026-10-01",
      end: "2026-11-01",
      priceUsd: 20,
      rate: 260,
      saleDzd: 6200,
      invoiceUrl: "",
      invoiceRef: "",
    },
  ],
};
const entry = (kind: TechFinanceEntry["kind"], amountDzd: number): TechFinanceEntry => ({
  id: kind,
  date: "2026-10-26",
  kind,
  amountDzd,
  label: "TEST FICTIF",
  orderId: ["refund", "cancellation"].includes(kind) ? order.id : "",
  voided: false,
});
test("Net margin subtracts recorded fees, refunds and cancelled revenue without double-counting them as supplier costs", () => {
  const stats = techFinanceStats(
    [order],
    [
      entry("sponsor", 300),
      entry("other", 100),
      entry("cancellation_fee", 50),
      entry("refund", 200),
      entry("cancellation", 100),
      entry("supplier_credit", 150),
    ],
  );
  assert.equal(stats.sale, 6200);
  assert.equal(stats.cost, 5200);
  assert.equal(stats.margin, 1000);
  assert.equal(stats.fees, 450);
  assert.equal(stats.deductions, 750);
  assert.equal(stats.netSales, 5900);
  assert.equal(stats.netMargin, 400);
  assert.equal(stats.movements, 6);
});
test("Voided entries remain in the ledger but are excluded from net margin; cancelled sales keep real supplier costs", () => {
  const entries = [{ ...entry("sponsor", 300), voided: true }, entry("cancellation", 6200)];
  assert.equal(techFinanceStats([order], entries).netMargin, -5200);
  assert.equal(
    techFinanceStats([order], [...entries, entry("supplier_credit", 5200)]).netMargin,
    0,
  );
  assert.equal(entries.length, 2);
});
test("Finance periods use the Algerian creation date and each adjustment's own date", () => {
  const stats = techFinanceStats([order], [entry("refund", 200)], "2026-10-01", "2026-10-31");
  assert.equal(stats.orders, 1);
  assert.equal(stats.netMargin, 800);
  assert.equal(
    techFinanceStats(
      [order],
      [{ ...entry("refund", 200), date: "2026-11-05" }],
      "2026-11-01",
      "2026-11-30",
    ).netMargin,
    -200,
  );
  assert.equal(
    techFinanceStats([{ ...order, createdAt: undefined }], [], "2026-10-01", "2026-10-31")
      .undatedOrders,
    1,
  );
  assert.equal(techFinanceStats([{ ...order, createdAt: undefined }], []).orders, 1);
  assert.equal(techFinanceStats([order], [], "2026-11-01", "2026-10-01").invalid, true);
  assert.deepEqual(financeMonthRange("2028-02"), { from: "2028-02-01", to: "2028-02-29" });
  assert.deepEqual(financeMonthRange("2026-13"), { from: "", to: "" });
  assert.deepEqual(financeMonthRange("0000-02"), { from: "", to: "" });
});
test("Mobile status squares always share a three-column row and retain their labels and counts", () => {
  const html = renderToStaticMarkup(
    createElement(TechStatusTiles, {
      counts: { active: 12, ending: 2, inactive: 3 },
      selected: "active",
      onSelect: () => {},
    }),
  );
  assert.equal((html.match(/<button/g) || []).length, 3);
  assert.match(html, /grid-cols-3/);
  assert.match(html, /aspect-square/);
  for (const label of ["Actifs", "Inactifs", "Expire sous 3 jours"])
    assert.ok(html.includes(label));
  assert.match(html, /aria-pressed="true"/);
});
test("Statistics present net margin without adding an unwanted target or claiming verified bank payments", () => {
  const html = renderToStaticMarkup(
    createElement(TechFinancePanel, {
      view: "stats",
      finance: { ...emptyTechFinance(), entries: [entry("sponsor", 300)] },
      orders: [order],
      today: "2026-10-26",
      busy: false,
      onSave: async () => {},
      onReload: async () => {},
      onClose: () => {},
      onDirtyChange: () => {},
    }),
  );
  assert.match(html, /Marge nette calculée/);
  assert.ok(!html.toLowerCase().includes("objectif"));
  assert.match(html, /paiement bancaire/);
});
