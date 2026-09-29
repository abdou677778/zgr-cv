import assert from "node:assert/strict";
import test from "node:test";

import { detectEuropassLanguage } from "./europass-import";

test("detects the Europass Candidate language before the filename", () => {
  const xml = '<Candidate><CandidateProfile languageCode="en" /></Candidate>';
  assert.equal(detectEuropassLanguage("CV-FR.xml", xml, "fr"), "en");
});

test("detects a language token in an official Europass filename", () => {
  assert.equal(detectEuropassLanguage("Europass-CV-Nadia-DE.pdf", "", "fr"), "de");
  assert.equal(detectEuropassLanguage("europass_cv_english.pdf", "", "fr"), "en");
});

test("detects the document language from multilingual section headings", () => {
  assert.equal(
    detectEuropassLanguage(
      "cv.pdf",
      "WORK EXPERIENCE\nEDUCATION AND TRAINING\nLANGUAGE SKILLS\nABOUT ME",
      "fr",
    ),
    "en",
  );
  assert.equal(
    detectEuropassLanguage(
      "cv.pdf",
      "EXPÉRIENCE PROFESSIONNELLE\nFORMATION ET ÉDUCATION\nCOMPÉTENCES\nÀ PROPOS DE MOI",
      "en",
    ),
    "fr",
  );
});
