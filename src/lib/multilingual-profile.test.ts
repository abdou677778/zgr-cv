import test from "node:test";
import assert from "node:assert/strict";
import { applyMultilingualEdit, createMultilingualProfile, multilingualProfileStatus, normalizeTranslationReview } from "./multilingual-profile";
import { importCvJson } from "./cv-json";
import { sampleCVByLanguage } from "./sample-cv";
import { emptyCV } from "./cv-types";
import { readFileSync } from "node:fs";

test("partial imports start a fresh record, never another client's translations", () => {
  const previous = createMultilingualProfile(sampleCVByLanguage);
  previous.en.nom_complet = "OTHER CLIENT";
  const next = createMultilingualProfile({ fr: { ...emptyCV, nom_complet: "NEW CLIENT" } });
  assert.equal(next.fr.nom_complet, "NEW CLIENT");
  assert.deepEqual(next.en, emptyCV);
  assert.equal(previous.en.nom_complet, "OTHER CLIENT");
});

test("reset isolates every language and sample loading clones every translated version", () => {
  const reset = createMultilingualProfile();
  reset.fr.experiences.push({ id: "test", titre: "Test", employeur: "", lieu: "", dates: "", descriptions: [] });
  assert.equal(reset.en.experiences.length, 0);
  assert.equal(emptyCV.experiences.length, 0);
  const sample = createMultilingualProfile(sampleCVByLanguage);
  assert.deepEqual(sample, sampleCVByLanguage);
  assert.notEqual(sample.fr, sampleCVByLanguage.fr);
});

test("saved incomplete bundles restore absent languages as blank, with supplied data preserved", () => {
  const original = { fr: { ...emptyCV, nom_complet: "CLIENT", objectif: "Objectif modifié" } };
  const restored = createMultilingualProfile(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(restored.fr, original.fr);
  assert.deepEqual(restored.ar, emptyCV);
});

test("workspace replacement paths do not seed imports or draft restoration with stale data", () => {
  const route = readFileSync(new URL("../routes/index.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(route, /const next = \{ \.\.\.cvByLanguage/);
  assert.doesNotMatch(route, /const restored = \{ \.\.\.sampleCVByLanguage/);
  assert.match(route, /setCvByLanguage\(createMultilingualProfile\(sampleCVByLanguage\)\)/);
  assert.match(route, /setCvByLanguage\(createMultilingualProfile\(\)\)/);
});

test("content edit flags other versions without replacing their translations or mutating input", () => {
  const original = createMultilingualProfile(sampleCVByLanguage);
  const english = structuredClone(original.en);
  const next = applyMultilingualEdit(original, "fr", { ...original.fr, objectif: "Objectif modifié" });
  assert.equal(next.en.objectif, english.objectif);
  assert.deepEqual(next.en.translation_review, { source_language: "fr" });
  assert.equal(next.fr.translation_review, undefined);
  assert.equal(original.en.translation_review, undefined);
  assert.deepEqual(multilingualProfileStatus(next).stale, ["en", "es", "de", "it", "zh", "ar"]);
});

test("layout or photo changes and no-op edits do not mark translations stale", () => {
  const original = createMultilingualProfile(sampleCVByLanguage);
  const next = applyMultilingualEdit(original, "fr", {
    ...original.fr, section_order: ["experiences"], objectif_format: { html: "", color: "#123456", alignment: "", fontSize: 18 },
  });
  assert.equal(next.en.translation_review, undefined);
  assert.equal(applyMultilingualEdit(original, "fr", original.fr).en.translation_review, undefined);
});

test("review provenance survives JSON normalization and invalid values are discarded", () => {
  const cv = { ...emptyCV, nom_complet: "CLIENT", translation_review: { source_language: "fr" } };
  assert.deepEqual(importCvJson(JSON.parse(JSON.stringify(cv)), "auto").cv.translation_review, cv.translation_review);
  for (const value of [null, "fr", { source_language: "invalid" }, { source_language: "__proto__" }]) {
    assert.equal(normalizeTranslationReview(value), undefined);
  }
});

test("different clients are warned without exposing contacts or discarding saved documents", () => {
  const docs = createMultilingualProfile({
    fr: { ...emptyCV, nom_complet: "AMINE BENSALEM", email: "one@example.com" },
    en: { ...emptyCV, nom_complet: "OMRI MOHAMED KAMEL", email: "two@example.com" },
  });
  const before = JSON.stringify(docs);
  const status = multilingualProfileStatus(docs);
  assert.equal(status.conflicts.length, 2);
  assert.doesNotMatch(status.conflicts.join(" "), /one@|two@|AMINE|OMRI/);
  assert.equal(JSON.stringify(docs), before);
  assert.deepEqual(status.missing, ["es", "de", "it", "zh", "ar"]);
});

test("name order, accents and cross-script transliterations do not create a false name conflict", () => {
  const docs = createMultilingualProfile({
    fr: { ...emptyCV, nom_complet: "Amine Bénsalem", email: "CLIENT@example.com" },
    en: { ...emptyCV, nom_complet: "BENSALEM AMINE", email: "client@example.com" },
    ar: { ...emptyCV, nom_complet: "أمين بن سالم" },
    zh: { ...emptyCV, nom_complet: "阿明" },
  });
  assert.deepEqual(multilingualProfileStatus(docs).conflicts, []);
});

test("same client with missing experience is flagged even without edit provenance", () => {
  const docs = createMultilingualProfile(sampleCVByLanguage);
  docs.en.experiences = [];
  assert.ok(multilingualProfileStatus(docs).coverage.some(message => message.includes("experiences")));
});
