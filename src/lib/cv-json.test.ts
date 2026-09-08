import assert from "node:assert/strict";
import test from "node:test";

import { importCvJson } from "./cv-json";

test("keeps legacy JSON compatible when the software section is absent", () => {
  const result = importCvJson({ nom_complet: "Legacy Profile", experiences: [] }, "auto");
  assert.deepEqual(result.cv.logiciels, []);
});

test("normalizes string and structured software values with stable icons", () => {
  const result = importCvJson(
    {
      nom_complet: "Software Profile",
      experiences: [],
      logiciels: [
        "Microsoft Word",
        { id: "excel-1", label: "Microsoft Excel", icon: "excel" },
        { label: "Figma", icon: "unknown" },
      ],
    },
    "auto",
  );

  assert.equal(result.cv.logiciels.length, 3);
  assert.equal(result.cv.logiciels[0]?.icon, "word");
  assert.deepEqual(result.cv.logiciels[1], {
    id: "excel-1",
    label: "Microsoft Excel",
    icon: "excel",
  });
  assert.equal(result.cv.logiciels[2]?.icon, "generic");
});
