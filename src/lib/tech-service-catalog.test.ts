import test from "node:test";
import assert from "node:assert/strict";
import {
  publicTechServices,
  publicTechArabicText,
  publicTechPrice,
  publicTechPeriod,
  publicTechCatalogPeriod,
  techCatalogPeriodConflict,
  techCatalogPages,
} from "./tech-service-catalog";
import { techCatalogImageHeight, wrapTechCatalogName } from "./tech-service-catalog-image";
import type { TechService } from "./tech-orders";

const service: TechService = {
  id: "fixture",
  revision: 1,
  name: "ChatGPT Plus",
  icon: "openai",
  logo: "private-logo",
  priceUsd: 20,
  rate: 260,
  saleDzd: 6200,
  months: 1,
};
test("Public catalog strictly excludes costs, rates, margins, private documents and hidden services", () => {
  const publicRows = publicTechServices([
    service,
    { ...service, id: "hidden", catalogVisible: false },
  ]);
  assert.equal(publicRows.length, 1);
  assert.deepEqual(
    Object.keys(publicRows[0]).sort(),
    ["id", "name", "priceDzd", "months", "invoiceAvailable"].sort(),
  );
  assert.equal(publicRows[0].invoiceAvailable, false);
  assert.doesNotMatch(JSON.stringify(publicRows), /priceUsd|private-logo|revision|rate|margin/);
});
test("Arabic text follows saved sale prices and durations, never claims unknown zero prices are free", () => {
  const rows = publicTechServices([
    service,
    { ...service, id: "zero", name: "Duolingo", saleDzd: 0, months: 12 },
  ]);
  const text = publicTechArabicText(rows);
  assert.match(text, /Services ZGR Tech/);
  assert.match(text, /ChatGPT Plus/);
  assert.match(text, /6.?200 دج/);
  assert.match(text, /السعر عند الطلب/);
  assert.match(text, /12 شهراً/);
  assert.match(text, /بدون كراك/);
  assert.doesNotMatch(text, /260|5.?200/);
  assert.match(text, /تجربة مجانية رسمية/);
  assert.match(text, /متى توفرت واستُوفيت شروطها/);
  assert.match(text, /أي موقع أو منصة/);
  assert.match(text, /القنوات الرسمية/);
  assert.equal(publicTechPeriod(2), "شهران");
  assert.equal(publicTechPeriod(3), "3 أشهر");
  assert.equal(publicTechPrice(rows.find((r) => r.id === "zero")!), "السعر عند الطلب");
});
test("Future service and price edits update the catalog without modifying source data or implying all invoices are confirmed", () => {
  const original = structuredClone(service);
  const before = publicTechArabicText(publicTechServices([service]));
  const after = publicTechArabicText(
    publicTechServices([
      { ...service, saleDzd: 6400, officialInvoiceAvailable: true },
      { ...service, id: "new", name: "Nouvelle offre" },
    ]),
  );
  assert.match(after, /6.?400 دج/);
  assert.match(after, /Nouvelle offre/);
  assert.match(after, /متاحة لهذه الخدمة/);
  assert.doesNotMatch(before, /متاحة لهذه الخدمة/);
  assert.deepEqual(service, original);
});
test("Future large catalogs are split into bounded images; long names wrap without being silently truncated", () => {
  const rows = Array.from({ length: 55 }, (_, i) => i);
  assert.deepEqual(
    techCatalogPages(rows).map((p) => p.length),
    [18, 18, 18, 1],
  );
  assert.equal(techCatalogPages([]).length, 0);
  assert.equal(techCatalogImageHeight(18), 1794);
  const title = "Long plan name repeated ".repeat(5).trim();
  const lines = wrapTechCatalogName(title, (s) => s.length * 10, 235);
  assert.ok(lines.every((line) => line.length <= 23));
  assert.equal(lines.join("").replace(/\s/g, ""), title.replace(/\s/g, ""));
});
test("A duration embedded in a commercial name never silently overrides the saved subscription period", () => {
  const row = publicTechServices([{ ...service, name: "Gemini Pro 18Months", months: 1 }])[0];
  assert.equal(techCatalogPeriodConflict(row), true);
  assert.equal(publicTechCatalogPeriod(row), "المدة تُؤكَّد عند الطلب");
  assert.match(publicTechArabicText([row]), /المدة تُؤكَّد عند الطلب/);
  assert.equal(row.months, 1);
  assert.equal(techCatalogPeriodConflict({ ...row, months: 18 }), false);
});
