import assert from "node:assert/strict";
import test from "node:test";

import { emptyCV } from "./cv-types";
import { applyCvVisibility } from "./cv-visibility";

test("preserves every populated CV item until the user hides it", () => {
  const cv = structuredClone(emptyCV);
  cv.experiences = Array.from({ length: 4 }, (_, index) => ({
    id: `experience-${index}`,
    dates: `${2020 + index} - ${2021 + index}`,
    lieu: "الجزائر",
    titre: `الخبرة ${index + 1}`,
    employeur: `المؤسسة ${index + 1}`,
    descriptions: [`الإنجاز ${index + 1}`],
  }));
  cv.formations = Array.from({ length: 3 }, (_, index) => ({
    id: `formation-${index}`,
    date: `${2020 + index}`,
    lieu: "الجزائر",
    titre: `التكوين ${index + 1}`,
    institution: `المؤسسة ${index + 1}`,
    competences: `المهارة ${index + 1}`,
  }));
  cv.educations = Array.from({ length: 3 }, (_, index) => ({
    id: `education-${index}`,
    date: `${2015 + index}`,
    lieu: "الجزائر",
    titre: `الشهادة ${index + 1}`,
    institution: `الجامعة ${index + 1}`,
    option: `التخصص ${index + 1}`,
    equivalence: `المعادلة ${index + 1}`,
  }));
  cv.competences = ["مهارة أولى", "مهارة ثانية", "مهارة ثالثة"];
  cv.interets = ["اهتمام أول", "اهتمام ثان"];
  cv.photo = {
    dataUrl: "data:image/webp;base64,UklGRg==",
    name: "photo-profil.webp",
    width: 600,
    height: 600,
    sizeBytes: 7,
    mimeType: "image/webp",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };

  const complete = applyCvVisibility(cv, {});
  assert.equal(complete.experiences.length, 4);
  assert.equal(complete.formations.length, 3);
  assert.equal(complete.educations.length, 3);
  assert.equal(complete.competences.length, 3);
  assert.equal(complete.interets.length, 2);
  assert.equal(complete.photo?.name, "photo-profil.webp");

  const filtered = applyCvVisibility(cv, {
    "experience.1": true,
    "formation.0": true,
    "education.2": true,
    "skills.1": true,
    "section.interests": true,
    "personal.photo": true,
  });
  assert.deepEqual(
    filtered.experiences.map((item) => item.id),
    ["experience-0", "experience-2", "experience-3"],
  );
  assert.deepEqual(
    filtered.formations.map((item) => item.id),
    ["formation-1", "formation-2"],
  );
  assert.deepEqual(
    filtered.educations.map((item) => item.id),
    ["education-0", "education-1"],
  );
  assert.deepEqual(filtered.competences, ["مهارة أولى", "مهارة ثالثة"]);
  assert.deepEqual(filtered.interets, []);
  assert.equal(filtered.photo, undefined);
  assert.equal(cv.photo?.name, "photo-profil.webp");
});
