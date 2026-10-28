import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateMcpJsonContract } from "./mcp-json-contract";
const fixture = () =>
  JSON.parse(
    readFileSync(
      new URL("../../test-data/json-multilingue/CV_TEST_GLOBAL_7_LANGUES.json", import.meta.url),
      "utf8",
    ),
  );

test("complete seven-language fixture passes strict MCP contract without semantic certification", () => {
  const result = validateMcpJsonContract(fixture());
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
  assert.equal(result.semanticReviewRequired, true);
});

test("MCP rejects missing languages, mixed identities, malformed fields, empty bullets, stale reviews and changed years", () => {
  const mutations = [
    (pack: ReturnType<typeof fixture>) => {
      delete pack.documents.en;
    },
    (pack: ReturnType<typeof fixture>) => {
      pack.documents.en.nom_complet = "ANOTHER CLIENT";
    },
    (pack: ReturnType<typeof fixture>) => {
      pack.documents.en.email = "other@example.com";
    },
    (pack: ReturnType<typeof fixture>) => {
      pack.documents.en.telephone = "9999999";
    },
    (pack: ReturnType<typeof fixture>) => {
      pack.documents.en.experiences = {};
    },
    (pack: ReturnType<typeof fixture>) => {
      pack.documents.en.competences = "not an array";
    },
    (pack: ReturnType<typeof fixture>) => {
      pack.documents.en.competences.push("");
    },
    (pack: ReturnType<typeof fixture>) => {
      pack.documents.en.lettre_motivation.paragraphes = [null];
    },
    (pack: ReturnType<typeof fixture>) => {
      pack.documents.en.translation_review = { source_language: "fr" };
    },
    (pack: ReturnType<typeof fixture>) => {
      pack.documents.en.experiences[0].dates = "2020 – 2021";
    },
    (pack: ReturnType<typeof fixture>) => {
      pack.documents.en.date_naissance = "15 March 1993";
    },
    (pack: ReturnType<typeof fixture>) => {
      pack.documents.en.custom_sections[0].items.pop();
    },
    (pack: ReturnType<typeof fixture>) => {
      pack.documents.zz = pack.documents.fr;
    },
    (pack: ReturnType<typeof fixture>) => {
      pack.default_language = "zz";
    },
  ];
  for (const mutate of mutations) {
    const pack = fixture();
    mutate(pack);
    const before = JSON.stringify(pack);
    const result = validateMcpJsonContract(pack);
    assert.equal(result.valid, false);
    assert.equal(JSON.stringify(pack), before);
    assert.doesNotMatch(result.errors.join(" "), /other@|ANOTHER CLIENT|9999999/);
  }
});

test("formatted phone, name order, accents and non-Latin transliterations are allowed", () => {
  const pack = fixture();
  pack.documents.en.nom_complet = "BENSALEM AMINE";
  pack.documents.fr.nom_complet = "Amine Bénsalem";
  pack.documents.en.telephone = "+14385551842";
  assert.deepEqual(validateMcpJsonContract(pack).errors, []);
});

test("additional languages cannot disappear or change identity in one translation", () => {
  const pack = fixture();
  for (const document of Object.values(pack.documents)) {
    (document as Record<string, unknown>).additional_languages = [
      { id: "pt", code: "pt", name: "Português", level: "B2" },
    ];
  }
  assert.equal(validateMcpJsonContract(pack).valid, true);
  pack.documents.en.additional_languages[0].id = "different";
  assert.equal(validateMcpJsonContract(pack).valid, false);
  delete pack.documents.en.additional_languages;
  assert.equal(validateMcpJsonContract(pack).valid, false);
});

test("both prompt copies are identical and persistence validates MCP before normalization or storage", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const prompt = read("../../PROMPT_MAITRE_CV_JSON_7_LANGUES.txt");
  assert.equal(
    prompt,
    read("../../cv-pro-team-clients/assets/PROMPT_MAITRE_CV_JSON_7_LANGUES.txt"),
  );
  assert.match(prompt, /Version 1.8/);
  assert.match(prompt, /UNE COMMANDE, UN CLIENT/);
  const service = read("../../cv-pro-team-clients/lib/json-version-service.ts");
  assert.ok(
    service.indexOf("validateCandidateJson(options.parsed") <
      service.indexOf("const normalized = normalizeCandidateJson(options.parsed)"),
  );
  assert.ok(
    service.indexOf("validateCandidateJson(options.parsed") < service.indexOf(".FILES.put("),
  );
});
