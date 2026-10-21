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
  assert.match(contactRows, /"widths":\[13,"\*",13\]/);
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

test("keeps an Arabic portrait on the same circle axis as the fallback avatar", () => {
  const document = buildCvProPdf(
    {
      ...emptyCV,
      photo: {
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        name: "portrait.png",
        width: 900,
        height: 900,
        sizeBytes: 8,
        mimeType: "image/webp",
        updatedAt: "2026-10-21T00:00:00.000Z",
      },
    },
    "ar",
  );
  const background = (
    document.background as unknown as (page: number) => { stack: Array<Record<string, unknown>> }
  )(1);
  const capsule = background.stack.find((item) => typeof item.svg === "string") as { svg: string };
  const portrait = background.stack.find((item) => "image" in item) as {
    absolutePosition: { x: number; y: number };
    width: number;
    height: number;
    alignment: string;
  };
  assert.match(capsule.svg, /cx="102" cy="92" r="60\.5" fill="#E7E7E7"/);
  assert.deepEqual(portrait.absolutePosition, { x: 417.5, y: 68.5 });
  assert.equal(portrait.width, 121);
  assert.equal(portrait.height, 121);
  assert.equal(portrait.alignment, "left");
});
