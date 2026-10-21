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
      statut_relocation:
        language === "ar" ? "متاح للتنقل في جميع أنحاء كندا" : "Mobilité partout au Canada",
    },
    language,
  );
  const background = (document.background as (page: number) => unknown)(1) as {
    stack: Array<{
      absolutePosition?: { x: number; y: number };
      canvas?: Array<{ type?: string; x?: number; y?: number; r1?: number; r2?: number }>;
      svg?: string;
    }>;
  };
  const overlay = (document.content as unknown as unknown[])?.[1] as {
    table?: { widths?: number[]; body?: unknown[][] };
    absolutePosition?: { x: number; y: number };
  };
  return { background, overlay };
}

test("centres the Arabic CV PRO circle and contact block inside its capsule", () => {
  const { background, overlay } = firstPageGeometry("ar");
  const circle = background.stack.find((item) => item.svg?.includes("<circle"));
  assert.deepEqual(circle?.absolutePosition, { x: 376, y: 37 });
  assert.match(circle?.svg || "", /cx="102" cy="92" r="60\.5"/);
  assert.deepEqual(overlay?.table?.widths, [164]);
  assert.deepEqual(overlay?.absolutePosition, { x: 396, y: 213 });
  const contactRows = JSON.stringify(overlay?.table?.body);
  assert.match(contactRows, /23000/);
  assert.match(contactRows, /"text":"كندا"/);
  assert.match(contactRows, /stroke-linecap/);
});

test("keeps the original CV PRO geometry for non-Arabic exports", () => {
  const { background, overlay } = firstPageGeometry("fr");
  const circle = background.stack.find((item) => item.svg?.includes("<circle"));
  assert.deepEqual(circle?.absolutePosition, { x: 44, y: 63 });
  assert.match(circle?.svg || "", /cx="74" cy="74" r="73\.5"/);
  assert.deepEqual(overlay?.table?.widths, [184]);
  assert.deepEqual(overlay?.absolutePosition, { x: 26, y: 220 });
});
