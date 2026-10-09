import assert from "node:assert/strict";
import test from "node:test";

import { importCvJson, importCvJsonSet } from "./cv-json";

test("keeps legacy JSON compatible when the software section is absent", () => {
  const result = importCvJson({ nom_complet: "Legacy Profile", experiences: [] }, "auto");
  assert.deepEqual(result.cv.logiciels, []);
});

test("normalizes string and structured software values with stable icons", () => {
  const result = importCvJson(
    {
      nom_complet: "Software Profile",
      experiences: [],
      logiciels: [
        "Microsoft Word",
        { id: "excel-1", label: "Microsoft Excel", icon: "excel" },
        { label: "Figma", icon: "unknown" },
      ],
    },
    "auto",
  );

  assert.equal(result.cv.logiciels.length, 3);
  assert.equal(result.cv.logiciels[0]?.icon, "word");
  assert.deepEqual(result.cv.logiciels[1], {
    id: "excel-1",
    label: "Microsoft Excel",
    icon: "excel",
  });
  assert.equal(result.cv.logiciels[2]?.icon, "generic");
});

test("normalizes and preserves the official Canadian NOC equivalence", () => {
  const result = importCvJson(
    {
      nom_complet: "Profil Canada",
      titre_poste: "Développeur logiciel",
      cnp: {
        code: "21232",
        title: "Développeurs/développeuses et programmeurs/programmeuses de logiciels",
      },
    },
    "auto",
  );

  assert.deepEqual(result.cv.cnp, {
    code: "21232",
    title: "Développeurs/développeuses et programmeurs/programmeuses de logiciels",
    teer: "FEER 1",
    version: "CNP 2021 v1.0",
    sourceUrl: "https://www.statcan.gc.ca/fr/sujets/norme/cnp/2021/indexV1",
  });
});

test("fills missing multilingual relocation statuses and replaces overlong legacy wording", () => {
  const result = importCvJsonSet({
    default_language: "fr",
    documents: {
      fr: { nom_complet: "Profil FR", statut_relocation: "" },
      en: { nom_complet: "Profile EN", statut_relocation: "x".repeat(80) },
    },
  });

  assert.ok(result);
  assert.equal(result.documents.fr?.statut_relocation, "Mobile géographiquement");
  assert.equal(result.documents.en?.statut_relocation, "Open to relocate");
});
