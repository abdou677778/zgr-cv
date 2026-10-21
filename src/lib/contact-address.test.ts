import assert from "node:assert/strict";
import test from "node:test";

import { formatImportedCvAddress, formatImportedCvPhone } from "./contact-address";

test("keeps only the useful CV address components from imported data, postal code first", () => {
  assert.equal(
    formatImportedCvAddress("Cité 5 Juillet 62, bloc 66, n° 494, Annaba, 23000, Algérie", "", ""),
    "23000, Annaba, Algérie",
  );
  assert.equal(
    formatImportedCvAddress("99 King Street, Toronto M5H 2N2", "Toronto", "Canada"),
    "M5H 2N2, Toronto, Canada",
  );
});

test("uses verified structured components without inventing missing data", () => {
  assert.equal(
    formatImportedCvAddress("Bloc 9, Quartier Nord", "Annaba", "Algérie"),
    "Annaba, Algérie",
  );
  assert.equal(formatImportedCvAddress("Cité 5 Juillet, bloc 66", "", ""), "Cité 5 Juillet, bloc 66");
});

test("lets an AI address replacement supersede stale CV location fields", () => {
  assert.equal(
    formatImportedCvAddress("H2X 1Y4, Montréal, Canada", "Annaba", "Algérie"),
    "H2X 1Y4, Montréal, Canada",
  );
  assert.equal(
    formatImportedCvAddress("كندا (مقيم مؤقت مع مشروع إقامة دائمة)", "عنابة", "الجزائر"),
    "كندا",
  );
});

test("formats automatic phone values with the verified country calling code", () => {
  assert.equal(formatImportedCvPhone("0772604280", "Algérie"), "(213) 772604280");
  assert.equal(formatImportedCvPhone("+1 514 555 0100", "Canada"), "(1) 5145550100");
  assert.equal(formatImportedCvPhone("0772604280", ""), "0772604280");
});
