import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { TechMobileOrderCard } from "../components/tech-mobile-order-card";
import { formatTechMoney } from "./tech-order-display";
import type { TechOrder } from "./tech-orders";
const order: TechOrder = {
  id: "PRIVATE-ID-NOT-FOR-CARD",
  revision: 1,
  client: "CLIENT FICTIF",
  facebookUrl: "https://facebook.com/example",
  notes: "",
  renewalOf: "",
  lines: [
    {
      id: "line",
      serviceId: "test-service",
      name: "Service test",
      start: "2026-10-01",
      end: "2026-11-01",
      priceUsd: 20,
      rate: 260,
      saleDzd: 6200,
      invoiceRef: "",
      invoiceUrl: "",
    },
  ],
};
const render = (value = order, today = "2026-10-26") =>
  renderToStaticMarkup(
    createElement(TechMobileOrderCard, {
      order: value,
      today,
      renderLogo: () => createElement("span", null, "LOGO"),
      menu: createElement("button", { "aria-label": "Actions pour CLIENT FICTIF" }, "⋮"),
    }),
  );
test("Compact mobile cards retain client, logo, deadline, state and right-hand financial totals without exposing the ID", () => {
  const html = render();
  for (const value of [
    "CLIENT FICTIF",
    "LOGO",
    "Service test",
    "01/11/2026",
    "Actif",
    "Coût",
    "Total",
    "Marge",
    formatTechMoney(5200),
    formatTechMoney(6200),
    formatTechMoney(1000),
  ])
    assert.ok(html.includes(value), value);
  assert.ok(!html.includes(order.id));
  assert.ok(!html.includes("Modifier"));
  assert.match(html, /text-indigo-700/);
  assert.match(html, /bg-green-100/);
});
test("Compact status pills distinguish imminent, expired and future services and keep negative margins visible", () => {
  assert.match(render(order, "2026-10-30"), /bg-amber-100/);
  assert.match(render(order, "2026-11-01"), /Inactif/);
  assert.match(render(order, "2026-09-30"), /À venir/);
  assert.match(render({ ...order, lines: [{ ...order.lines[0], saleDzd: 1000 }] }), /text-red-700/);
});
test("Renewal messages open in a portal without scrolling the client list and restore focus without scrolling", () => {
  const source = readFileSync(
    new URL("../components/tech-orders-workspace.tsx", import.meta.url),
    "utf8",
  );
  const opener = source.slice(
    source.indexOf("const openRenewalMessage"),
    source.indexOf("const hasDraft"),
  );
  assert.ok(opener.includes("setMessageOrderId"));
  assert.ok(!opener.includes("scrollIntoView"));
  assert.match(source, /<DialogPrimitive.Portal>/);
  assert.match(source, /messageReturnFocus\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /Retour à la liste/);
});
