import assert from "node:assert/strict";
import test from "node:test";
import { formatDrivingLicence, formatNationalService } from "./cv-concise-status";

test("keeps only driving licence categories", () => {
  assert.equal(formatDrivingLicence("Catégories B et A (navires marins)"), "Catégories B et A");
  assert.equal(formatDrivingLicence("Permis de conduire CE, B"), "Catégories CE et B");
  assert.equal(formatDrivingLicence("Permis n° 12345"), "");
});

test("uses a direct national-service status", () => {
  assert.equal(formatNationalService("Titulaire de la carte jaune"), "Dégagé");
  assert.equal(formatNationalService("Service national accompli en 2019"), "Accompli");
  assert.equal(formatNationalService("information non vérifiée"), "");
});
