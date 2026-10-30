import assert from "node:assert/strict";
import test from "node:test";
import { emptyCV } from "./cv-types";
import { projectOrganizationLogos } from "./organization-logo-policy";

test("standard templates omit organization artwork without changing source data or text", () => {
  const logo = { dataUrl: "data:image/png;base64,test", name: "test.png", width: 1, height: 1 };
  const cv = {
    ...emptyCV,
    experiences: [
      {
        id: "e",
        titre: "Poste",
        employeur: "Entreprise",
        dates: "2025",
        lieu: "Alger",
        descriptions: [],
        logo,
      },
    ],
    formations: [
      {
        id: "f",
        titre: "Formation",
        institution: "Institut",
        date: "2024",
        lieu: "",
        competences: "",
        logo,
      },
    ],
    educations: [
      {
        id: "d",
        titre: "Diplôme",
        institution: "Université",
        date: "2023",
        lieu: "",
        option: "",
        equivalence: "",
        logo,
      },
    ],
  };
  const before = structuredClone(cv);
  for (const template of [
    "canadian-v1",
    "canadian-v2",
    "canadian-v3",
    "canadian-v4",
    "ats-a4",
    "europass",
  ]) {
    const rendered = projectOrganizationLogos(cv, template);
    for (const section of ["experiences", "formations", "educations"] as const) {
      assert.equal(rendered[section][0].logo, undefined);
      assert.equal(rendered[section][0].titre, cv[section][0].titre);
      assert.equal(rendered[section][0].id, cv[section][0].id);
    }
  }
  assert.deepEqual(cv, before);
  for (const template of [
    "cv-pro-international",
    "cv-pro-ar-v3",
    "cv-pro",
    "arabic-pro-v1",
    "arabic-pro-v2",
  ]) {
    assert.equal(projectOrganizationLogos(cv, template), cv);
  }
});
