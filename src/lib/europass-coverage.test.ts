import assert from "node:assert/strict";
import test from "node:test";
import { emptyCV, emptyEuropassProfile } from "./cv-types";
import { analyzeEuropassCoverage } from "./europass-coverage";

test("calcule la couverture Europass sans charger le moteur XML", () => {
  const emptyCoverage = analyzeEuropassCoverage(structuredClone(emptyCV));
  assert.equal(emptyCoverage.percent, 0);
  assert.equal(emptyCoverage.mapped.length, 0);

  const coverage = analyzeEuropassCoverage({
    ...structuredClone(emptyCV),
    nom_complet: "Nadia Exemple",
    email: "nadia@example.com",
    date_naissance: "15 JUIN 1992",
    europass: {
      ...structuredClone(emptyEuropassProfile),
      gender_code: "female",
      nationality_code: "dz",
    },
  });

  assert.ok(coverage.mapped.includes("identité"));
  assert.ok(coverage.mapped.includes("courriel"));
  assert.ok(coverage.mapped.includes("date de naissance"));
  assert.ok(coverage.mapped.includes("sexe"));
  assert.ok(coverage.mapped.includes("nationalité"));
  assert.equal(coverage.percent, 26);
});
