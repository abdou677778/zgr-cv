import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { techContactAt, renewTechOrder, type TechOrder, type TechLine } from "./tech-orders";
import { TechContactBadge } from "../components/tech-contact-badge";
const line: TechLine = {
  id: "line",
  serviceId: "service",
  name: "Test",
  start: "2026-09-01",
  end: "2026-10-01",
  priceUsd: 20,
  rate: 260,
  saleDzd: 6200,
  invoiceUrl: "",
  invoiceRef: "",
};
const confirmed: TechLine = {
  ...line,
  renewalContact: { start: line.start, end: line.end, at: "2026-10-26T10:00:00.000Z" },
};
test("Contact is explicit, tied to its period, and never inherited by renewals", () => {
  assert.equal(techContactAt(line), undefined);
  assert.equal(techContactAt(confirmed), "2026-10-26T10:00:00.000Z");
  assert.equal(techContactAt({ ...confirmed, end: "2026-11-01" }), undefined);
  assert.equal(techContactAt({ ...confirmed, start: "2026-09-02" }), undefined);
  const order: TechOrder = {
    id: "order",
    revision: 1,
    client: "Test",
    facebookUrl: "",
    notes: "",
    renewalOf: "",
    lines: [confirmed],
  };
  assert.equal(renewTechOrder(order, [], 1, "2026-10-26").lines[0].renewalContact, undefined);
});
test("Contact badge distinguishes unconfirmed and manually confirmed contact with Algiers time", () => {
  const render = (line: TechLine) =>
    renderToStaticMarkup(createElement(TechContactBadge, { line }));
  assert.match(render(line), /À contacter/);
  assert.doesNotMatch(render(line), /Contacté/);
  assert.match(render(confirmed), /Contacté/);
  assert.match(render(confirmed), /26\/10\/2026/);
  assert.match(render(confirmed), /11:00/);
});
