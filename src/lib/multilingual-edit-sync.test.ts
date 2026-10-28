import test from "node:test";
import assert from "node:assert/strict";
import { emptyCV } from "./cv-types";
import { DOCUMENT_LANGUAGES } from "./document-language";
import { createMultilingualProfile, applyMultilingualEdit } from "./multilingual-profile";
import { acknowledgeTranslation } from "./multilingual-edit-sync";
import { importCvJson } from "./cv-json";
import { validateMcpJsonContract } from "./mcp-json-contract";
import { applyCvVisibility } from "./cv-visibility";

const experience = (id: string, dates: string, titre: string) => ({
  id,
  dates,
  titre,
  lieu: "Paris",
  employeur: "ACME",
  descriptions: ["Fait attesté"],
});
test("new experience is present in every language with stable ID, canonical dates and pending source text", () => {
  const current = createMultilingualProfile();
  const next = applyMultilingualEdit(current, "fr", {
    ...current.fr,
    experiences: [experience("new", "2026-05", "Technicien")],
  });
  for (const { id } of DOCUMENT_LANGUAGES) {
    assert.equal(next[id].experiences[0].id, "new");
    assert.equal(next[id].experiences[0].titre, "Technicien");
    assert.equal(next[id].experiences[0].chronology?.end, "2026-05");
    if (id !== "fr")
      assert.equal(next[id].pending_translations!["experiences.new.titre"].kind, "added");
  }
  assert.equal(current.en.experiences.length, 0);
});
test("typing into a newly copied source row updates provisional fields but protects manual translations", () => {
  let docs = createMultilingualProfile();
  docs = applyMultilingualEdit(docs, "fr", {
    ...docs.fr,
    experiences: [experience("new", "", "T")],
  });
  docs = applyMultilingualEdit(docs, "fr", {
    ...docs.fr,
    experiences: [{ ...docs.fr.experiences[0], titre: "Technicien", dates: "2026" }],
  });
  assert.equal(docs.en.experiences[0].titre, "Technicien");
  docs = applyMultilingualEdit(docs, "en", {
    ...docs.en,
    experiences: [{ ...docs.en.experiences[0], titre: "Technician" }],
  });
  docs = applyMultilingualEdit(docs, "fr", {
    ...docs.fr,
    experiences: [{ ...docs.fr.experiences[0], titre: "Technicien senior" }],
  });
  assert.equal(docs.en.experiences[0].titre, "Technician");
  assert.equal(
    docs.en.pending_translations!["experiences.new.titre"].source_value,
    "Technicien senior",
  );
});
test("existing translations stay intact when French facts change; shared chronology moves the correct ID", () => {
  const docs = createMultilingualProfile();
  for (const { id } of DOCUMENT_LANGUAGES)
    docs[id].experiences = [
      experience("a", "2020", id === "fr" ? "Technicien" : "Technician"),
      experience("b", "2025", "Other"),
    ];
  const next = applyMultilingualEdit(docs, "fr", {
    ...docs.fr,
    experiences: docs.fr.experiences.map((row) =>
      row.id === "a" ? { ...row, titre: "Chef technicien", dates: "2026" } : row,
    ),
  });
  assert.deepEqual(
    next.en.experiences.map((row) => row.id),
    ["a", "b"],
  );
  assert.equal(next.en.experiences[0].titre, "Technician");
  assert.equal(next.en.experiences[0].dates, "2020");
  assert.equal(next.en.pending_translations!["experiences.a.dates"].source_value, "2026");
  assert.equal(next.en.pending_translations!["experiences.a.titre"].source_language, "fr");
});
test("training and education additions are synchronized and sorted, and text edits in any language flag other versions", () => {
  let docs = createMultilingualProfile();
  docs = applyMultilingualEdit(docs, "ar", {
    ...docs.ar,
    formations: [
      { id: "f", date: "2026", titre: "تكوين", institution: "ACME", lieu: "", competences: "" },
    ],
    educations: [
      {
        id: "e",
        date: "2025",
        titre: "شهادة",
        institution: "UNI",
        lieu: "",
        option: "",
        equivalence: "",
      },
    ],
    objectif: "هدف",
  });
  for (const { id } of DOCUMENT_LANGUAGES) {
    assert.equal(docs[id].formations[0].id, "f");
    assert.equal(docs[id].educations[0].id, "e");
  }
  assert.equal(docs.en.pending_translations!.objectif.source_value, "هدف");
  const oldEnglish = docs.en.objectif;
  docs = applyMultilingualEdit(docs, "de", {
    ...docs.de,
    objectif: "Neues Ziel",
    lettre_motivation: { ...docs.de.lettre_motivation, objet: "Bewerbung" },
    plan_developpement: ["Plan"],
  });
  assert.equal(docs.en.objectif, oldEnglish);
  assert.equal(docs.en.pending_translations!["lettre_motivation.objet"].source_value, "Bewerbung");
  assert.deepEqual(docs.en.pending_translations!.plan_developpement.source_value, ["Plan"]);
});
test("deletions require acknowledgement in each target and pending metadata survives save/reload", () => {
  const docs = createMultilingualProfile();
  for (const { id } of DOCUMENT_LANGUAGES)
    docs[id].experiences = [experience("a", "2020", "Technicien")];
  const next = applyMultilingualEdit(docs, "fr", { ...docs.fr, experiences: [] });
  assert.equal(next.en.experiences.length, 1);
  const restored = importCvJson(JSON.parse(JSON.stringify(next.en)), "auto").cv;
  assert.equal(restored.pending_translations!["experiences.a"].kind, "deleted");
  assert.equal(acknowledgeTranslation(restored, "experiences.a").experiences.length, 0);
  assert.equal(next.en.experiences.length, 1);
});
test("MCP rejects unsorted dates and unreviewed multilingual changes", () => {
  const documents = createMultilingualProfile();
  for (const { id } of DOCUMENT_LANGUAGES)
    documents[id] = {
      ...structuredClone(emptyCV),
      nom_complet: "CLIENT",
      statut_relocation: "Mobile",
      competences: [],
      experiences: [experience("a", "2020", "Old"), experience("b", "2026", "New")],
    };
  const result = validateMcpJsonContract({ version: "1.0", default_language: "fr", documents });
  assert.ok(result.errors.some((error) => error.includes("ordre chronologique")));
  documents.fr.pending_translations = {
    objectif: { source_language: "en", source_value: "Source", kind: "modified" },
  };
  assert.ok(
    validateMcpJsonContract({ version: "1.0", default_language: "fr", documents }).errors.some(
      (error) => error.includes("pending_translations"),
    ),
  );
});

test("review annotations stay in the editable record, not the document projection", () => {
  const docs = createMultilingualProfile();
  const next = applyMultilingualEdit(docs, "fr", {
    ...docs.fr,
    experiences: [experience("new", "2026", "Technicien")],
  });
  const output = applyCvVisibility(next.en, {});
  assert.equal(output.pending_translations, undefined);
  assert.equal(output.translation_review, undefined);
  assert.ok(next.en.pending_translations);
  assert.equal(output.experiences[0].titre, "Technicien");
});
