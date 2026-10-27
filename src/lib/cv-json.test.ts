import assert from "node:assert/strict";
import test from "node:test";

import { importCvJson, importCvJsonSet } from "./cv-json";

test("language logos survive JSON reload and reject external or oversized images", () => {
  const customIconDataUrl = "data:image/png;base64,iVBORw0KGgo=";
  const result = importCvJson({ nom_complet: "Test", language_logos: {
    fr: { icon: "en", customIconDataUrl },
    en: { icon: "invalid", customIconDataUrl: "https://external.test/logo.png" },
    ar: { customIconDataUrl: `data:image/png;base64,${"A".repeat(210001)}` },
    unknown: { icon: "fr" },
  } }, "auto");
  assert.deepEqual(result.cv.language_logos, { fr: { icon: "en", customIconDataUrl } });
  const reloaded = importCvJson(JSON.parse(JSON.stringify(result.cv)), "auto");
  assert.deepEqual(reloaded.cv.language_logos, result.cv.language_logos);
});

test("keeps legacy JSON compatible when the software section is absent", () => {
  const result = importCvJson({ nom_complet: "Legacy Profile", experiences: [] }, "auto");
  assert.deepEqual(result.cv.logiciels, []);
});

test("preserves shared institution logos in training and education JSON", () => {
  const logo={catalogId:"dz-61",dataUrl:"data:image/png;base64,iVBORw0KGgo=",name:"school.png",width:256,height:256};
  const result=importCvJson({nom_complet:"Test",formations:[{titre:"Formation",institution:"École",logo}],educations:[{titre:"Diplôme",institution:"Université",logo}]},"auto");
  assert.equal(result.cv.formations[0]?.logo?.catalogId,"dz-61");
  assert.equal(result.cv.educations[0]?.logo?.dataUrl,logo.dataUrl);
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
  assert.equal(result.cv.logiciels[0]?.icon, "microsoftword");
  assert.deepEqual(result.cv.logiciels[1], {
    id: "excel-1",
    label: "Microsoft Excel",
    icon: "microsoftexcel",
  });
  assert.equal(result.cv.logiciels[2]?.icon, "figma");
});

test("preserves a local software logo across JSON reload and infers catalog names", () => {
  const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
  const result = importCvJson({ nom_complet: "Software Profile", experiences: [], logiciels: [
    { label: "Canva", icon: "canva", customIconDataUrl: dataUrl },
    "Zoom",
    { label: "Canva", icon: "generic" },
  ] }, "auto");
  assert.equal(result.cv.logiciels[0]?.customIconDataUrl, dataUrl);
  assert.equal(result.cv.logiciels[0]?.icon, "canva");
  assert.equal(result.cv.logiciels[1]?.icon, "zoom");
  assert.equal(result.cv.logiciels[2]?.icon, "canva");
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
