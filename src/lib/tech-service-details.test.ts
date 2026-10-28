import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { TechServiceDetails } from "../components/tech-service-details";
import { techServiceError } from "./tech-orders-validation";
import type { TechService } from "./tech-orders";
const fixture: TechService = {
  id: "s",
  revision: 0,
  name: "Abonnement",
  icon: "generic",
  logo: "",
  priceUsd: 10,
  rate: 260,
  saleDzd: 3600,
  months: 1,
};
test("Service detail fields validate optional HTTPS and bounded bilingual plain text", () => {
  assert.equal(techServiceError(fixture), "");
  assert.equal(
    techServiceError({ ...fixture, websiteUrl: "https://example.com", features: "ميزة\nFeature" }),
    "",
  );
  assert.ok(techServiceError({ ...fixture, websiteUrl: "javascript:alert(1)" }));
  assert.ok(techServiceError({ ...fixture, websiteUrl: "https://user:secret@example.com" }));
  assert.ok(techServiceError({ ...fixture, features: "x".repeat(4001) }));
});
test("Characteristics collapse by default, escape user text and reject unsafe links", () => {
  const html = renderToStaticMarkup(
    createElement(TechServiceDetails, {
      service: {
        name: "Test",
        websiteUrl: "https://example.com",
        features: "<script>alert(1)</script>\nميزة",
      },
    }),
  );
  assert.match(html, /Afficher les caractéristiques/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /noopener noreferrer/);
  assert.doesNotMatch(html, /<script>| open=""/);
  const unsafe = renderToStaticMarkup(
    createElement(TechServiceDetails, {
      service: { name: "Legacy", websiteUrl: "javascript:alert(1)" },
    }),
  );
  assert.doesNotMatch(unsafe, /href=/);
  assert.match(unsafe, /Aucune caractéristique/);
});
test("Yellow catalogue options removed; details remain separate from edit buttons on web and mobile", () => {
  const source = readFileSync(
    new URL("../components/tech-orders-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /Présentation dans le catalogue client|border-amber-200 bg-amber-50/);
  assert.match(source, /Lien du site \(facultatif\)/);
  assert.match(source, /<TechServiceDetails service=\{s\}/);
  assert.match(source, /md:grid-cols-2/);
});
