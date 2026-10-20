import assert from "node:assert/strict";
import test from "node:test";

import { buildCvProPdf } from "./cv-pro-pdf";
import { emptyCV } from "./cv-types";

function firstPageGeometry(language: "ar" | "fr") {
  const document = buildCvProPdf(
    {
      ...emptyCV,
      nom_complet: language === "ar" ? "أمين بن سالم" : "Amine Bensalem",
      titre_poste: language === "ar" ? "تقني صيانة" : "Technicien de maintenance",
      telephone: "0555123456",
      email: "amine@example.com",
      adresse: language === "ar" ? "23000، عنابة، الجزائر" : "23000, Annaba, Algérie",
    },
    language,
  );
  const background = (document.background as (page: number) => unknown)(1) as {
    stack: Array<{
      absolutePosition?: { x: number; y: number };
      canvas?: Array<{ type?: string; x?: number; y?: number; r1?: number; r2?: number }>;
    }>;
  };
  const overlay = (document.content as unknown as unknown[])?.[1] as {
    table?: { widths?: number[] };
    absolutePosition?: { x: number; y: number };
  };
  return { background, overlay };
}

test("centres the Arabic CV PRO circle and contact block inside its compact card", () => {
  const { background, overlay } = firstPageGeometry("ar");
  const circle = background.stack.find((item) => item.canvas?.[0]?.type === "ellipse");
  assert.deepEqual(circle?.absolutePosition, { x: 433, y: 57 });
  assert.equal(circle?.canvas?.[0]?.r1, 53);
  // Card occupies x=393..579; the circle occupies x=433..539.
  assert.ok((circle?.absolutePosition?.x || 0) >= 393);
  assert.ok((circle?.absolutePosition?.x || 0) + 106 <= 579);
  assert.deepEqual(overlay?.table?.widths, [160]);
  assert.deepEqual(overlay?.absolutePosition, { x: 406, y: 191 });
});

test("keeps the original CV PRO geometry for non-Arabic exports", () => {
  const { background, overlay } = firstPageGeometry("fr");
  const circle = background.stack.find((item) => item.canvas?.[0]?.type === "ellipse");
  assert.deepEqual(circle?.absolutePosition, { x: 44, y: 63 });
  assert.equal(circle?.canvas?.[0]?.r1, 74);
  assert.deepEqual(overlay?.table?.widths, [184]);
  assert.deepEqual(overlay?.absolutePosition, { x: 26, y: 220 });
});
