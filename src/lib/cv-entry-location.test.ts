import assert from "node:assert/strict";
import test from "node:test";
import { cvEntryLocation } from "./cv-entry-location";

test("strips boundary punctuation without deleting internal Arabic separators", () => {
  assert.equal(cvEntryLocation("، TechNova Solutions,", ", الجزائر، كندا،", true), "TechNova Solutions، الجزائر، كندا");
  assert.equal(cvEntryLocation("", ",، الجزائر،", true), "الجزائر");
});

test("deduplicates legacy employer/location components without dropping distinct places", () => {
  assert.equal(cvEntryLocation("TechNova Solutions, Montréal", "Montréal, Québec, Canada"), "TechNova Solutions, Montréal, Québec, Canada");
  assert.equal(cvEntryLocation("TechNova Solutions", "مونتريال، كيبيك، كندا، كندا", true), "TechNova Solutions، مونتريال، كيبيك، كندا");
  assert.equal(cvEntryLocation("Acme", "Québec (ville), Québec (province), Canada"), "Acme, Québec (ville), Québec (province), Canada");
});
