import assert from "node:assert/strict";
import test from "node:test";

import { emptyCV } from "./cv-types";
import { prepareCvForDocument } from "./canadian-document";

const driver = {
  ...emptyCV,
  titre_poste: "Conducteur de camion de transport",
  statut_relocation: "Open to relocate",
  cnp: {
    code: "73300",
    title: "Conducteurs/conductrices de camions de transport",
    teer: "FEER 3",
    version: "CNP 2021 v1.0" as const,
    sourceUrl: "https://noc.esdc.gc.ca/Structure/NOCProfile?code=73300&version=2021.0",
  },
};

test("adds the verified NOC code only to Canadian documents", () => {
  const canada = prepareCvForDocument(driver, "cv", "canadian-v1", "fr");
  assert.equal(canada.titre_poste, "CONDUCTEUR DE CAMION DE TRANSPORT - 73300");
  assert.equal(canada.statut_relocation, "Mobile partout au Canada");
  assert.equal(driver.titre_poste, "Conducteur de camion de transport");

  const europass = prepareCvForDocument(driver, "cv", "europass", "fr");
  assert.equal(europass, driver);
});

test("uses the short Canadian relocation wording for the Canadian cover letter", () => {
  const letter = prepareCvForDocument(driver, "cover-letter", "cover-letter-v1", "en");
  assert.equal(letter.titre_poste, "CONDUCTEUR DE CAMION DE TRANSPORT - 73300");
  assert.equal(letter.statut_relocation, "Open to relocate to Canada");
});
