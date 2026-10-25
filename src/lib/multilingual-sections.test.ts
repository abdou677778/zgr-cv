import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { auditMultilingualDocuments } from "./multilingual-audit";
import {
  localizedCustomTitle,
  validateSectionTranslations,
  synchronizeSoftwareEdit,
} from "./multilingual-sections";
import { importCvJsonSet } from "./cv-json";
import { DOCUMENT_LANGUAGES } from "./document-language";
import { FORM_COPY } from "./interface-copy";
import { importAiPrompt } from "./ai-prompts";

const fixture = () =>
  JSON.parse(
    readFileSync(
      new URL("../../test-data/json-multilingue/CV_TEST_GLOBAL_7_LANGUES.json", import.meta.url),
      "utf8",
    ),
  );
test("seven-language fixtures include translated custom sections and unchanged brands without omissions", () => {
  const pack = fixture();
  const audit = auditMultilingualDocuments(pack.documents);
  assert.deepEqual(audit.errors, []);
  assert.deepEqual(audit.warnings, []);
  for (const { id } of DOCUMENT_LANGUAGES) {
    const doc = pack.documents[id];
    assert.equal(doc.logiciels.length, 3);
    assert.equal(doc.logiciels[0].label, "Microsoft Word");
    assert.equal(doc.custom_sections[0].title, localizedCustomTitle("Projets", id));
    const imported = importCvJsonSet(pack)!.documents[id]!;
    assert.equal(imported.custom_sections[0].items.length, 2);
    assert.equal(imported.logiciels.length, 3);
  }
});
test("audit rejects missing languages, dropped software, changed ids and empty localized content", () => {
  const pack = fixture();
  delete pack.documents.de;
  pack.documents.ar.logiciels = [];
  pack.documents.zh.custom_sections[0].title = "";
  pack.documents.it.custom_sections[0].items.pop();
  pack.documents.en.experiences[0].id = "changed";
  pack.documents.es.objectif = "";
  const audit = auditMultilingualDocuments(pack.documents);
  for (const text of ["documents.de", "logiciels", "title", "puces", "identifiants", "objectif"])
    assert.ok(
      audit.errors.some((error) => error.includes(text)),
      text,
    );
});
test("unknown information absent in all languages stays empty without inventing a section", () => {
  const documents = Object.fromEntries(
    DOCUMENT_LANGUAGES.map(({ id }) => [
      id,
      {
        logiciels: [],
        custom_sections: [],
        experiences: [],
        educations: [],
        formations: [],
        objectif: "",
        langues: { fr: "" },
      },
    ]),
  );
  assert.deepEqual(auditMultilingualDocuments(documents).errors, []);
});
test("coverage detects artificial empty entries, duplicate ids and inconsistent logo slugs", () => {
  const pack = fixture();
  pack.documents.fr.custom_sections.push({ id: "custom-projects", title: "", items: [""] });
  pack.documents.it.logiciels[0].icon = "other";
  const audit = auditMultilingualDocuments(pack.documents);
  for (const text of ["dupliqués", "title", "puce vide", "logo différents"])
    assert.ok(
      audit.errors.some((error) => error.includes(text)),
      text,
    );
});
test("localized title suggestions cover all seven languages and preserve unknown proper titles", () => {
  for (const { id } of DOCUMENT_LANGUAGES) assert.ok(localizedCustomTitle("Réalisations", id));
  assert.equal(localizedCustomTitle("Projets", "ar"), "المشاريع");
  assert.equal(localizedCustomTitle("Association Alpha", "zh"), "Association Alpha");
});
test("AI section proposals preserve brands and reject missing languages, omitted bullets and changed numbers", () => {
  const documents = fixture().documents;
  const source = {
    logiciels: documents.fr.logiciels,
    custom_sections: documents.fr.custom_sections,
  };
  assert.ok(validateSectionTranslations({ documents }, source).ar);
  const missing = structuredClone(documents);
  delete missing.it;
  assert.throws(
    () => validateSectionTranslations({ documents: missing }, source),
    /sections manquantes/,
  );
  const changed = structuredClone(documents);
  changed.ar.logiciels[0].label = "Word traduit";
  assert.throws(
    () => validateSectionTranslations({ documents: changed }, source),
    /marque modifiée/,
  );
  const numbers = structuredClone(documents);
  numbers.ar.custom_sections[0].items[0] = "2026";
  assert.throws(
    () => validateSectionTranslations({ documents: numbers }, source),
    /nombres modifiés/,
  );
});
test("editing a shared logo does not overwrite a descriptive translated software label", () => {
  const original = [
    { id: "word", label: "Microsoft Word — traitement de texte", icon: "microsoftword" },
  ];
  const english = [{ ...original[0], label: "Microsoft Word — word processing" }];
  assert.equal(
    synchronizeSoftwareEdit(original, [{ ...original[0], icon: "generic" }], english, false)[0]
      .label,
    english[0].label,
  );
  assert.equal(
    synchronizeSoftwareEdit(
      original,
      [{ ...original[0], label: "Canva", icon: "canva" }],
      english,
      false,
    )[0].label,
    "Canva",
  );
});
test("every form label is nonempty in all seven dictionaries including software", () => {
  for (const { id } of DOCUMENT_LANGUAGES) {
    for (const key of Object.keys(FORM_COPY.fr))
      assert.ok((FORM_COPY[id] as unknown as Record<string, string>)[key]?.trim(), `${id}.${key}`);
  }
  assert.equal(FORM_COPY.ar.software, "البرامج");
  assert.equal(FORM_COPY.zh.software, "软件");
});
test("both master prompt copies cover custom sections and the seven language audit", () => {
  const root = readFileSync(
    new URL("../../PROMPT_MAITRE_CV_JSON_7_LANGUES.txt", import.meta.url),
    "utf8",
  );
  const server = readFileSync(
    new URL(
      "../../cv-pro-team-clients/assets/PROMPT_MAITRE_CV_JSON_7_LANGUES.txt",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(root, server);
  assert.ok(root.includes('"custom_sections"'));
  assert.ok(root.includes("CONTRÔLE OBLIGATOIRE — LOGICIELS"));
});
test("the AI importer explicitly preserves and localizes custom sections in every language", () => {
  for (const { id } of DOCUMENT_LANGUAGES) {
    const prompt = importAiPrompt(id, {});
    assert.ok(prompt.includes('"custom_sections"'));
    assert.ok(prompt.includes("Les marques et icon restent inchangés"));
  }
});
