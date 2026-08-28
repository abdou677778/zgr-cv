import assert from "node:assert/strict";
import test from "node:test";

test("offers the four Arabic layouts only for Arabic CVs", async () => {
  const templates = await import("./document-templates.ts");

  assert.deepEqual(
    templates.getCvTemplatesForLanguage("ar").map((template) => template.id),
    [
      "canadian-v1",
      "canadian-v2",
      "canadian-v3",
      "canadian-v4",
      "ats-a4",
      "arabic-pro-v2",
      "arabic-pro-v3",
      "arabic-pro-v4",
      "arabic-pro-v5",
    ],
  );
  assert.equal(
    templates.getCvTemplatesForLanguage("fr").some((template) => templates.isArabicCvTemplate(template.id)),
    false,
  );
});

test("migrates the removed Arabic V1 selection safely", async () => {
  const templates = await import("./document-templates.ts");

  assert.equal(templates.normalizeCvTemplateForLanguage("arabic-pro-v1", "ar"), "arabic-pro-v2");
  assert.equal(templates.normalizeCvTemplateForLanguage("arabic-pro-v4", "fr"), "canadian-v1");
});
