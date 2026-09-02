import assert from "node:assert/strict";
import test from "node:test";

test("offers both active Arabic layouts for Arabic CVs", async () => {
  const templates = await import("./document-templates.ts");

  assert.deepEqual(
    templates.getCvTemplatesForLanguage("ar").map((template) => template.id),
    [
      "canadian-v1",
      "canadian-v2",
      "canadian-v3",
      "canadian-v4",
      "ats-a4",
      "arabic-pro-v1",
      "arabic-pro-v2",
    ],
  );
  assert.equal(
    templates.getCvTemplatesForLanguage("ar").find((template) => template.id === "arabic-pro-v1")
      ?.name,
    "CV Pro Arabe V1",
  );
  assert.equal(
    templates.getCvTemplatesForLanguage("ar").find((template) => template.id === "arabic-pro-v2")
      ?.name,
    "CV PRO Arabe V2",
  );
  assert.equal(
    templates
      .getCvTemplatesForLanguage("fr")
      .some((template) => templates.isArabicCvTemplate(template.id)),
    false,
  );
});

test("preserves active Arabic layouts and migrates removed legacy variants", async () => {
  const templates = await import("./document-templates.ts");

  assert.equal(templates.normalizeCvTemplateForLanguage("arabic-pro-v1", "ar"), "arabic-pro-v1");
  assert.equal(templates.normalizeCvTemplateForLanguage("arabic-pro-v2", "ar"), "arabic-pro-v2");
  for (const legacy of ["arabic-pro-v3", "arabic-pro-v4", "arabic-pro-v5"]) {
    assert.equal(templates.normalizeCvTemplateForLanguage(legacy, "ar"), "arabic-pro-v1");
  }
  assert.equal(templates.normalizeCvTemplateForLanguage("arabic-pro-v2", "fr"), "canadian-v1");
  assert.equal(templates.normalizeCvTemplateForLanguage("arabic-pro-v4", "fr"), "canadian-v1");
});
