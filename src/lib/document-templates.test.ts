import assert from "node:assert/strict";
import test from "node:test";

test("offers only the retained Arabic V1 layout for Arabic CVs", async () => {
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
    ],
  );
  assert.equal(
    templates.getCvTemplatesForLanguage("ar").find((template) => template.id === "arabic-pro-v1")?.name,
    "CV Pro Arabe V1",
  );
  assert.equal(
    templates.getCvTemplatesForLanguage("fr").some((template) => templates.isArabicCvTemplate(template.id)),
    false,
  );
});

test("migrates every former Arabic layout to the retained V1", async () => {
  const templates = await import("./document-templates.ts");

  for (const legacy of ["arabic-pro-v1", "arabic-pro-v2", "arabic-pro-v3", "arabic-pro-v4", "arabic-pro-v5"]) {
    assert.equal(templates.normalizeCvTemplateForLanguage(legacy, "ar"), "arabic-pro-v1");
  }
  assert.equal(templates.normalizeCvTemplateForLanguage("arabic-pro-v4", "fr"), "canadian-v1");
});
