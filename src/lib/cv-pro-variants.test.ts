import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCvProPdf } from "./cv-pro-pdf";
import { buildCvProArabicV3Pdf } from "./cv-pro-ar-v3-pdf";
import { buildCvProInternationalPdf } from "./cv-pro-international-pdf";
import { importCvJsonSet } from "./cv-json";
import { DOCUMENT_LANGUAGES } from "./document-language";
import { applyPdfTheme } from "./pdf-theme";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test-data/json-multilingue/CV_TEST_GLOBAL_7_LANGUES.json", import.meta.url),
    "utf8",
  ),
);
const documents = importCvJsonSet(fixture)!.documents;
const snapshot = (value: unknown) =>
  JSON.stringify(value, (_key, item) => (typeof item === "function" ? item.toString() : item));
test("frozen Arabic V3 preserves the complete current CV PRO definition and page geometry", () => {
  const original = buildCvProPdf(documents.ar!, "ar");
  const frozen = buildCvProArabicV3Pdf(documents.ar!);
  assert.equal(snapshot(frozen), snapshot(original));
  for (const page of [1, 2, 3])
    assert.equal(
      snapshot((frozen.background as Function)(page)),
      snapshot((original.background as Function)(page)),
    );
  assert.equal(
    snapshot(applyPdfTheme(frozen, "cv-pro-ar-v3", "#123456")),
    snapshot(applyPdfTheme(original, "cv-pro", "#123456")),
  );
});
test("International changes only the contact groups, preserving the rest of each foreign layout", () => {
  assert.throws(
    () => buildCvProInternationalPdf(documents.ar!, "ar"),
    /réservé aux langues étrangères/,
  );
  for (const { id } of DOCUMENT_LANGUAGES) {
    if (id === "ar") continue;
    const original = buildCvProPdf(documents[id]!, id);
    const international = buildCvProInternationalPdf(documents[id]!, id);
    const before=JSON.parse(snapshot(original));
    const after=JSON.parse(snapshot(international));
    const rows=after.content[1].table.body[0][0].stack;
    for(const row of rows){
      assert.deepEqual(row.table.widths,['*',11,7,'auto','*'],id);
      assert.ok(row.table.body[0][1].svg,id);
      assert.equal(row.table.body[0][3].alignment,'left',id);
    }
    before.content[1].table.body[0][0].stack=[];
    after.content[1].table.body[0][0].stack=[];
    assert.deepEqual(after,before,id);
    assert.ok(snapshot(applyPdfTheme(international,'cv-pro-international','#123456')).includes('#123456'));
  }
});
