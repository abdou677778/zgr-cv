import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import {
  addTechMonths,
  lineTotals,
  newTechLine,
  orderTotals,
  renewTechOrder,
  techLineStatus,
  type TechOrder,
  type TechService,
} from "./tech-orders";
import { buildTechOrdersXlsx } from "./tech-orders-excel";
const service: TechService = {
  id: "chatgpt",
  revision: 1,
  name: "Service test",
  icon: "openai",
  logo: "",
  priceUsd: 20,
  rate: 260,
  saleDzd: 6200,
  months: 1,
};
const order: TechOrder = {
  id: "test-order",
  revision: 1,
  client: "CLIENT FICTIF",
  facebookUrl: "",
  notes: "",
  renewalOf: "",
  lines: [
    {
      id: "line1",
      serviceId: "chatgpt",
      name: "Service test",
      start: "2026-10-25",
      end: "2026-11-25",
      priceUsd: 20,
      rate: 260,
      saleDzd: 6200,
      invoiceUrl: "",
      invoiceRef: "",
    },
  ],
};
test("Tech Orders computes the supplied 20 × 260 example and allows zero/negative margins", () => {
  assert.deepEqual(lineTotals(service), { cost: 5200, sale: 6200, margin: 1000 });
  assert.equal(lineTotals({ ...service, saleDzd: 0 }).margin, -5200);
  assert.equal(lineTotals({ priceUsd: 0.1, rate: 3, saleDzd: 0.4 }).margin, 0.1);
  assert.deepEqual(
    orderTotals({
      ...order,
      lines: [...order.lines, { ...order.lines[0], id: "line2", saleDzd: 5000 }],
    }),
    { cost: 10400, sale: 11200, margin: 800 },
  );
});
test("Tech Orders month dates clamp correctly at month ends and leap years", () => {
  assert.equal(addTechMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addTechMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addTechMonths("2026-10-25", 3), "2027-01-25");
  assert.equal(addTechMonths("", 1), "");
});
test("Tech Orders renewal keeps history and invoices isolated, with quoted catalog prices", () => {
  const snapshot = structuredClone(order);
  const renewed = renewTechOrder(order, [{ ...service, priceUsd: 25 }], 3, "2026-11-01");
  assert.deepEqual(order, snapshot);
  assert.equal(renewed.lines[0].start, "2026-11-25");
  assert.equal(renewed.lines[0].end, "2027-02-25");
  assert.equal(renewed.lines[0].priceUsd, 75);
  assert.equal(renewed.lines[0].saleDzd, 18600);
  assert.equal(renewed.revision, 0);
  assert.equal(renewed.renewalOf, order.id);
  assert.notEqual(renewed.id, order.id);
  assert.equal(renewTechOrder(order, [service], 1, "2026-12-01").lines[0].start, "2026-12-01");
  assert.equal(techLineStatus(order.lines[0], "2026-11-25"), "Expiré");
  assert.equal(techLineStatus(order.lines[0], "2026-11-23"), "Expire sous 3 jours");
  assert.equal(techLineStatus(order.lines[0], "2026-10-24"), "À venir");
});
test("Selective renewal accepts another service without changing the original sale", () => {
  const original = { ...order, lines: [...order.lines, { ...order.lines[0], id: "line2" }] };
  const snapshot = structuredClone(original);
  const draft = renewTechOrder(
    { ...original, lines: original.lines.filter((line) => line.id === "line1") },
    [service],
    1,
    "2026-11-01",
  );
  assert.equal(draft.lines.length, 1);
  const extra = newTechLine(
    { ...service, id: "gemini", name: "Gemini", saleDzd: 3200, priceUsd: 10 },
    "2026-11-01",
  );
  draft.lines.push(extra);
  assert.equal(draft.client, original.client);
  assert.equal(draft.renewalOf, original.id);
  assert.deepEqual(orderTotals(draft), { cost: 7800, sale: 9400, margin: 1600 });
  assert.notEqual(draft.lines[0].id, extra.id);
  assert.deepEqual(original, snapshot);
});

test("Excel export preserves formulas, typed dates, cached totals and literal client text", () => {
  const files = unzipSync(
    buildTechOrdersXlsx([{ ...order, client: '=HYPERLINK("https://bad.test")' }]),
  );
  const xml = strFromU8(files["xl/worksheets/sheet1.xml"]);
  assert.match(xml, /<f>ROUND\(G8\*H8,2\)<\/f><v>5200<\/v>/);
  assert.match(xml, /<f>ROUND\(J8-I8,2\)<\/f><v>1000<\/v>/);
  assert.match(xml, /<f>SUM\(J8:J8\)<\/f><v>6200<\/v>/);
  assert.match(xml, /<c r="B8" s="0" t="inlineStr">/);
  assert.ok(!xml.includes("<f>HYPERLINK"));
  assert.match(xml, /<c r="E8" s="3"><v>\d+<\/v>/);
  assert.ok(strFromU8(files["xl/workbook.xml"]).includes('fullCalcOnLoad="1"'));
  const empty = strFromU8(unzipSync(buildTechOrdersXlsx([]))["xl/worksheets/sheet1.xml"]);
  assert.match(empty, /<f>SUM\(K8:K8\)<\/f><v>0<\/v>/);
});
