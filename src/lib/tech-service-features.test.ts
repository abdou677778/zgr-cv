import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { techFeatureItems } from "./tech-service-features";
import { TechServiceDetails } from "../components/tech-service-details";
import {
  officialTechDetails,
  officialTechFeatures,
  TECH_OFFICIAL_SERVICE_DETAILS,
} from "../data/tech-official-service-details";
test("Features are deduplicated readable checks with separate conditions and dated sources", () => {
  const items = techFeatureItems(
    "✓ Feature A\n\n• Feature A\n2. Feature B\r\nÀ noter : limite\nSource consultée le 29/10/2026.",
  );
  assert.equal(items.length, 4);
  assert.equal(items.filter((x) => x.note).length, 2);
  assert.equal(items[0].text, "Feature A");
  const html = renderToStaticMarkup(
    createElement(TechServiceDetails, {
      service: { name: "Test", features: "✓ Feature A\nÀ noter : limite" },
    }),
  );
  assert.match(html, /<ul/);
  assert.match(html, /<li/);
  assert.doesNotMatch(html.match(/<ul[\s\S]*?<\/ul>/)![0], /À noter/);
  assert.equal(techFeatureItems().length, 0);
});
test("Official snapshots cover all current named services without importing prices or silently mapping ambiguous tiers", () => {
  assert.equal(TECH_OFFICIAL_SERVICE_DETAILS.length, 26);
  assert.equal(new Set(TECH_OFFICIAL_SERVICE_DETAILS.map((x) => x.name)).size, 26);
  for (const entry of TECH_OFFICIAL_SERVICE_DETAILS) {
    assert.equal(new URL(entry.websiteUrl).protocol, "https:");
    assert.ok(officialTechFeatures(entry).length <= 4000);
    assert.match(officialTechFeatures(entry), /29\/10\/2026/);
    assert.doesNotMatch(JSON.stringify(entry), /saleDzd|priceUsd|invoiceAvailable/);
  }
  assert.equal(officialTechDetails(" Unknown service "), undefined);
  assert.equal(officialTechDetails(" CANVA PRO ")?.name, "Canva Pro");
  assert.match(officialTechFeatures(officialTechDetails("Twitter Plus X")!), /ambigu/);
  assert.match(officialTechFeatures(officialTechDetails("ChatGPT Pro X20")!), /Confirmer/);
  assert.match(
    officialTechFeatures(officialTechDetails("Canva Pro Education")!),
    /gratuit.*éligibles/,
  );
});
