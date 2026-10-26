import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { techSaleMonths, techSaleStartPatch, techSalePricePatch } from "./tech-sale-editor";
import { newTechLine, type TechLine, type TechService } from "./tech-orders";
import { TechSaleLineFields } from "../components/tech-sale-line-fields";
const line: TechLine = {
  id: "line",
  serviceId: "service",
  name: "Test",
  start: "2026-01-31",
  end: "2026-02-28",
  priceUsd: 20,
  rate: 260,
  saleDzd: 6200,
  invoiceRef: "KEEP REAL REFERENCE",
  invoiceUrl: "https://example.com/invoice",
};
test("New sales can default to one month without changing catalog prices or legacy standard durations", () => {
  const service: TechService = {
    id: "service",
    revision: 1,
    name: "Test",
    icon: "generic",
    logo: "",
    months: 3,
    priceUsd: 20,
    rate: 260,
    saleDzd: 6200,
  };
  const created = newTechLine(service, "2026-01-31", 1);
  assert.equal(created.end, "2026-02-28");
  assert.equal(created.priceUsd, 20);
  assert.equal(created.saleDzd, 6200);
  assert.equal(newTechLine(service, "2026-01-31").end, "2026-04-30");
});
test("Period follows edited starts dynamically, clamps month ends and preserves custom dates", () => {
  assert.equal(techSaleMonths(line), 1);
  assert.deepEqual(techSaleStartPatch("2028-01-31", 1), { start: "2028-01-31", end: "2028-02-29" });
  assert.deepEqual(techSaleStartPatch("2026-10-26", 12), {
    start: "2026-10-26",
    end: "2027-10-26",
  });
  assert.deepEqual(techSaleStartPatch("2026-10-26", "custom"), { start: "2026-10-26" });
  assert.equal(techSaleMonths({ ...line, end: "2026-03-04" }), "custom");
  assert.equal(techSaleStartPatch("", 1).end, "");
  const changed = { ...line, ...techSaleStartPatch("2026-10-26", 1) };
  assert.equal(changed.invoiceRef, line.invoiceRef);
  assert.equal(changed.invoiceUrl, line.invoiceUrl);
});
test("Reverse calculation tracks the full typed selling price only when purchase is missing or estimated", () => {
  const empty = { ...line, priceUsd: NaN };
  let draft = empty;
  for (const value of [6, 62, 620, 6200])
    draft = { ...draft, ...techSalePricePatch(draft, "saleDzd", value, true) };
  assert.equal(draft.priceUsd, 23.85);
  assert.equal(techSalePricePatch(empty, "saleDzd", 5200, false).priceUsd, 20);
  assert.deepEqual(techSalePricePatch(line, "saleDzd", 7000, false), { saleDzd: 7000 });
  assert.deepEqual(techSalePricePatch({ ...line, priceUsd: 0 }, "saleDzd", 7000, false), {
    saleDzd: 7000,
  });
  assert.equal(techSalePricePatch(draft, "rate", 310, true).priceUsd, 20);
  assert.ok(Number.isNaN(techSalePricePatch(empty, "rate", 0, true).priceUsd));
  assert.equal(techSalePricePatch(empty, "saleDzd", 0, true).priceUsd, 0);
  assert.deepEqual(techSalePricePatch(draft, "priceUsd", 25, true), { priceUsd: 25 });
});
test("Sale fields use compact horizontal date and price rows, highlighted sale price and no invoice inputs", () => {
  const html = renderToStaticMarkup(
    createElement(TechSaleLineFields, { line, onChange: () => {} }),
  );
  assert.match(html, /grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)_36px\]/);
  assert.match(html, /grid-cols-3/);
  assert.match(html, /Ajuster la période — 1 mois/);
  assert.match(html, /Prix d’achat/);
  assert.match(html, /Prix de vente/);
  assert.match(html, /bg-emerald-50/);
  assert.doesNotMatch(html, /KEEP REAL REFERENCE|example.com\/invoice/);
  const source = readFileSync(
    new URL("../components/tech-orders-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /newTechLine\(service, today, 1\)/);
  assert.doesNotMatch(
    source,
    /Référence facture réelle du fournisseur|Lien HTTPS vers la facture fournisseur/,
  );
});
