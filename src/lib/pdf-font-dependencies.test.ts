import assert from "node:assert/strict";
import test from "node:test";
import { explicitPdfFonts } from "./pdf-font-dependencies";
test("finds fonts in nested mixed runs and styles, without duplicates or cycles", () => {
  const document: Record<string, unknown> = {
    defaultStyle: { font: "Calibri" },
    content: [
      {
        table: {
          body: [[{ text: [{ text: "جامعة", font: "NotoSansArabic" }, { text: "USTHB" }] }]],
        },
      },
    ],
    styles: { custom: { font: "Cambria" }, duplicate: { font: "Calibri" } },
  };
  document.self = document;
  assert.deepEqual(explicitPdfFonts(document), ["Calibri", "NotoSansArabic", "Cambria"]);
});
