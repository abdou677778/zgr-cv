import assert from "node:assert/strict";
import test from "node:test";
import { emptyCV } from "./cv-types";
import {
  emptyOpportunityPlan,
  inferCandidateCountry,
  profileSearchQuery,
  safeApplicationUrl,
} from "./profile-opportunities";

test("infers Tunisia without exposing profile contact data", () => {
  const cv = {
    ...emptyCV,
    pays: "Tunisie",
    titre_poste: "Éducatrice petite enfance",
    email: "private@example.com",
  };
  assert.equal(inferCandidateCountry(cv), "TN");
  assert.equal(profileSearchQuery(cv), "Éducatrice petite enfance");
  assert.equal(profileSearchQuery(cv).includes(cv.email), false);
});

test("uses Algeria as the safe default and includes the selected NOC title", () => {
  const cv = {
    ...emptyCV,
    pays: "Algérie",
    titre_poste: "Soudeur",
    cnp: {
      code: "72106",
      title: "Soudeurs/soudeuses",
      teer: "2",
      version: "CNP 2021 v1.0" as const,
      sourceUrl: "https://noc.esdc.gc.ca/",
    },
  };
  assert.equal(inferCandidateCountry(cv), "DZ");
  assert.equal(profileSearchQuery(cv), "Soudeur Soudeurs/soudeuses");
  assert.equal(emptyOpportunityPlan(cv).noc?.code, "72106");
});

test("accepts only clickable web and email protocols", () => {
  assert.equal(safeApplicationUrl("https://example.com/apply"), "https://example.com/apply");
  assert.equal(safeApplicationUrl("mailto:jobs@example.com"), "mailto:jobs@example.com");
  assert.equal(safeApplicationUrl("javascript:alert(1)"), "");
  assert.equal(safeApplicationUrl("data:text/html,test"), "");
});
