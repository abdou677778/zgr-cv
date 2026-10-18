import assert from "node:assert/strict";
import test from "node:test";

import { formatImportedCvAddress } from "./contact-address";

test("keeps only the useful CV address components from imported data", () => {
  assert.equal(
    formatImportedCvAddress("Cité 5 Juillet 62, bloc 66, n° 494, Annaba, 23000, Algérie", "", ""),
    "Annaba, 23000, Algérie",
  );
  assert.equal(
    formatImportedCvAddress("99 King Street, Toronto M5H 2N2", "Toronto", "Canada"),
    "Toronto, M5H 2N2, Canada",
  );
});

test("uses verified structured components without inventing missing data", () => {
  assert.equal(
    formatImportedCvAddress("Bloc 9, Quartier Nord", "Annaba", "Algérie"),
    "Annaba, Algérie",
  );
  assert.equal(formatImportedCvAddress("Cité 5 Juillet, bloc 66", "", ""), "Cité 5 Juillet, bloc 66");
});
