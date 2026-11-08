import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TechClientHistory } from "../components/tech-client-history";
import { TechPaymentButtons } from "../components/tech-payment-buttons";
import { primaryTechPeriod } from "./tech-visible-period";
import { groupTechClients } from "./tech-client-groups";
import { type TechOrder } from "./tech-orders";
const fixture: TechOrder = {
  id: "test",
  revision: 1,
  client: "عميل طويل الاسم — Client nom très long",
  facebookUrl: "https://facebook.com/test",
  notes: "Note préservée <script>unsafe</script>",
  renewalOf: "",
  paymentStatus: "unpaid",
  lines: [
    {
      id: "line",
      serviceId: "service",
      name: "Service avec un nom très long",
      start: "2026-11-01",
      end: "2026-12-01",
      priceUsd: 99999,
      rate: 260,
      saleDzd: 1000000,
      invoiceRef: "",
      invoiceUrl: "",
    },
  ],
};
test("Spreadsheet desktop has nine aligned cells with atomic money and horizontal payment controls", () => {
  const snapshot = structuredClone(fixture),
    group = groupTechClients([fixture], "2026-11-08")[0];
  const html = renderToStaticMarkup(
    createElement(TechClientHistory, {
      group,
      today: "2026-11-08",
      logo: () => null,
      menu: null,
      onContact: () => {},
    }),
  );
  assert.equal((html.match(/<td\b/g) || []).length, 9);
  assert.match(html, /align-middle/);
  assert.match(html, /whitespace-nowrap text-right tabular-nums/);
  assert.match(html, /tabular-nums/);
  assert.match(html, /Voir la note de/);
  assert.match(html, /title="عميل طويل/);
  assert.doesNotMatch(html, /py-4|<script>/);
  assert.deepEqual(fixture, snapshot);
  for (const compact of [true, false]) {
    const buttons = renderToStaticMarkup(
      createElement(TechPaymentButtons, { order: fixture, compact, onChange: () => {} }),
    );
    assert.match(buttons, /inline-flex flex-nowrap/);
    assert.doesNotMatch(buttons, /flex-wrap/);
    assert.match(buttons, /Non payé/);
    assert.match(buttons, /bg-red-600 text-white/);
  }
});
test("Main service period selects current subscription, keeps future renewals separate and never mutates chronology", () => {
  const expired = {
    ...fixture,
    id: "expired",
    lines: [{ ...fixture.lines[0], start: "2026-09-01", end: "2026-10-01" }],
  };
  const future = {
    ...fixture,
    id: "future",
    lines: [{ ...fixture.lines[0], start: "2026-12-01", end: "2027-01-01" }],
  };
  const group = groupTechClients([future, fixture, expired], "2026-11-08")[0];
  const before = group.periods.map((p) => p.order.id);
  assert.equal(primaryTechPeriod(group.periods, "2026-11-08")?.order.id, "test");
  assert.deepEqual(
    group.periods.map((p) => p.order.id),
    before,
  );
  assert.equal(primaryTechPeriod(group.periods, "2026-08-01")?.order.id, "expired");
  assert.equal(primaryTechPeriod(group.periods, "2027-02-01")?.order.id, "future");
  assert.equal(primaryTechPeriod([], "2026-11-08"), undefined);
});
