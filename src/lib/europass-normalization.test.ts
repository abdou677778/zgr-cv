import assert from "node:assert/strict";
import test from "node:test";

import { cleanEuropassText, normalizeEuropassSkill, normalizeEuropassSkills } from "./europass-xml";

test("retire le HTML Europass échappé tout en conservant un texte lisible", () => {
  const source =
    "<p>Étudiante sérieuse en Master 2 Biochemie Appliquée, je recherche une mobilité <strong>Erasmus+</strong>.</p>";

  assert.equal(
    cleanEuropassText(source),
    "Étudiante sérieuse en Master 2 Biochemie Appliquée, je recherche une mobilité Erasmus+.",
  );
  assert.equal(
    cleanEuropassText("<ul><li>Première ligne</li><li>Deuxième ligne</li></ul>"),
    "Première ligne\nDeuxième ligne",
  );
});

test("normalise la casse et les marques des compétences importées", () => {
  assert.deepEqual(
    normalizeEuropassSkills([
      "centrifugation",
      "microscopie",
      "automates de biochimie",
      "Microsoft Powerpoint",
      "ZOOM",
      "microsoft excel",
      "zoom",
    ]),
    [
      "Centrifugation",
      "Microscopie",
      "Automates de biochimie",
      "Microsoft PowerPoint",
      "Zoom",
      "Microsoft Excel",
    ],
  );
  assert.equal(normalizeEuropassSkill("javascript et api rest"), "JavaScript et API rest");
});
