import assert from "node:assert/strict";
import test from "node:test";
import { sampleCVByLanguage } from "./sample-cv";
import { auditMultilingualDocuments } from "./multilingual-audit";

test("bundled fictional example has complete aligned multilingual rows", () => {
  assert.deepEqual(auditMultilingualDocuments(sampleCVByLanguage).errors, []);
  for (const cv of Object.values(sampleCVByLanguage)) {
    for (const section of ["experiences", "formations", "educations"] as const) {
      assert.deepEqual(cv[section].map(row => row.id), sampleCVByLanguage.fr[section].map(row => row.id));
    }
    assert.ok(cv.educations[2].option);
  }
});
