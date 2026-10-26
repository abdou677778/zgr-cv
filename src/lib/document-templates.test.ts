import assert from "node:assert/strict";
import test from "node:test";

test("offers three Arabic layouts without exposing International to Arabic CVs", async () => {
  const templates = await import("./document-templates.ts");

  assert.deepEqual(
    templates.getCvTemplatesForLanguage("ar").map((template) => template.id),
    [
      "canadian-v1",
      "canadian-v2",
      "canadian-v3",
      "canadian-v4",
      "ats-a4",
      "cv-pro",
      "arabic-pro-v1",
      "arabic-pro-v2",
      "cv-pro-ar-v3",
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
    templates.getCvTemplatesForLanguage("fr").some((template) => template.id === "cv-pro"),
    true,
  );
  assert.equal(
    templates
      .getCvTemplatesForLanguage("fr")
      .some((template) => templates.isArabicCvTemplate(template.id)),
    false,
  );
});

test("new CV PRO variants route by language without changing legacy saved IDs", async () => {
  const templates = await import("./document-templates");
  for (const language of ["fr", "en", "es", "de", "it", "zh"]) {
    assert.ok(
      templates
        .getCvTemplatesForLanguage(language)
        .some((template) => template.id === "cv-pro-international"),
    );
    assert.ok(
      !templates
        .getCvTemplatesForLanguage(language)
        .some((template) => template.id === "cv-pro-ar-v3"),
    );
    assert.equal(
      templates.normalizeCvTemplateForLanguage("cv-pro-ar-v3", language),
      "cv-pro-international",
    );
  }
  assert.equal(
    templates.normalizeCvTemplateForLanguage("cv-pro-international", "ar"),
    "cv-pro-ar-v3",
  );
  assert.equal(templates.normalizeCvTemplateForLanguage("cv-pro-ar-v3", "ar"), "cv-pro-ar-v3");
  assert.equal(templates.normalizeCvTemplateForLanguage("cv-pro", "ar"), "cv-pro");
  assert.equal(templates.normalizeCvTemplateForLanguage("cv-pro", "fr"), "cv-pro");
  assert.equal(templates.isArabicCvTemplate("cv-pro-ar-v3"), true);
  assert.deepEqual(
    templates.getTemplateDocumentLanguages("cv-pro-ar-v3").map((item) => item.id),
    ["ar"],
  );
  assert.deepEqual(
    templates.getTemplateDocumentLanguages("cv-pro-international").map((item) => item.id),
    ["fr", "en", "es", "de", "it", "zh"],
  );
  assert.equal(templates.getTemplateDocumentLanguages("cv-pro").length, 7);
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
