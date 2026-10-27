import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCvProPdf } from "./cv-pro-pdf";
import { buildCvProArabicV3Pdf } from "./cv-pro-ar-v3-pdf";
import { buildCvProInternationalPdf } from "./cv-pro-international-pdf";
import { importCvJsonSet } from "./cv-json";
import { DOCUMENT_LANGUAGES } from "./document-language";
import { applyPdfTheme } from "./pdf-theme";
import {
  internationalContactLayout,
  INTERNATIONAL_CONTACT_ROW_HEIGHT,
  INTERNATIONAL_CONTACT_GAP,
} from "./cv-pro-international-contact-layout";
import { applyCvVisibility } from "./cv-visibility";
import { emptyCV } from "./cv-types";
import { languageName } from './language-catalog';

const fixture = JSON.parse(
  readFileSync(
    new URL("../../test-data/json-multilingue/CV_TEST_GLOBAL_7_LANGUES.json", import.meta.url),
    "utf8",
  ),
);
const documents = importCvJsonSet(fixture)!.documents;
const snapshot = (value: unknown) =>
  JSON.stringify(value, (_key, item) => (typeof item === "function" ? item.toString() : item));

test('additional languages render after existing languages with the same icon geometry',()=>{
  const cv={...documents.fr!,additional_languages:[{id:'it',code:'it',name:languageName('it'),level:'B2',icon:'country-it'}]};
  const doc=JSON.parse(snapshot(buildCvProInternationalPdf(cv,'en')));
  const rows=doc.content[3].columns[0].stack.find((item:any)=>item.zgrSectionId==='languages').stack.slice(1);
  assert.equal(rows.length,7);
  assert.equal(rows.at(-2).margin[3],7);
  assert.equal(rows.at(-1).columns[1].text[0].text,'Italian  ');
  assert.equal(rows.at(-1).margin[3],0);
  const arabic=JSON.parse(snapshot(buildCvProArabicV3Pdf({...documents.ar!,additional_languages:cv.additional_languages})));
  const arabicSection=arabic.content[3].columns[1].stack.find((item:any)=>item.zgrSectionId==='languages');
  assert.equal(arabicSection.stack.length,8);
  assert.equal(arabicSection.stack.at(-1).columns[0].alignment,'right');
});

test("International software rows match languages and preserve full names and prepared logos", () => {
  for (const { id } of DOCUMENT_LANGUAGES) {
    if (id === "ar") continue;
    const cv = { ...documents[id]!, logiciels: [
      { id: "word", label: "Microsoft Word avec un nom très long", icon: "microsoftword", customIconDataUrl: "data:image/png;base64,fixture" },
      { id: "empty", label: "   ", icon: "generic" },
      { id: "canva", label: "Canva", icon: "canva" },
    ] };
    const doc = JSON.parse(snapshot(buildCvProInternationalPdf(cv, id)));
    const sections = doc.content[3].columns[0].stack;
    const software = sections.find((section: any) => section.zgrSectionId === "software").stack[1].stack;
    const languages = sections.find((section: any) => section.zgrSectionId === "languages").stack.slice(1);
    assert.equal(software.length, 2);
    assert.equal(software[0].columns[1].text, cv.logiciels[0].label);
    assert.equal(software[1].columns[1].text, "Canva");
    assert.equal(software[0].columns[0].image, cv.logiciels[0].customIconDataUrl);
    for (const row of [...software, ...languages]) {
      assert.equal(row.columns[0].width, 18);
      assert.deepEqual(row.columns[0].fit, software.includes(row) ? [14, 9.3] : [9.3, 9.3]);
      assert.equal(row.columns[1].fontSize, 8.2);
      assert.equal(row.columnGap, 4);
      assert.equal(row.unbreakable, true);
      assert.deepEqual(row.columns[0].margin, [0, -1.5, 0, 0]);
    }
    assert.equal(software[0].margin[3], 7);
    assert.equal(languages[0].margin[3], 7);
    assert.equal(software.at(-1).margin[3], 0);
    assert.equal(languages.at(-1).margin[3], 0);
  }
  const empty = JSON.parse(snapshot(buildCvProInternationalPdf(emptyCV, "fr")));
  assert.ok(!snapshot(empty.content[3]).includes('"zgrSectionId":"software"'));
  assert.ok(!snapshot(empty.content[3]).includes('"zgrSectionId":"languages"'));
});

test("International accepts a language logo override without modifying Arabic V3", () => {
  const language_logos = { fr: { icon: "en" as const, customIconDataUrl: "data:image/png;base64,fixture" } };
  const cv = { ...documents.fr!, language_logos };
  const document = JSON.parse(snapshot(buildCvProInternationalPdf(cv, "fr")));
  const section = document.content[3].columns[0].stack.find((item: any) => item.zgrSectionId === "languages");
  assert.equal(section.stack[1].columns[0].image, language_logos.fr.customIconDataUrl);
  assert.equal(snapshot(buildCvProArabicV3Pdf({ ...documents.ar!, language_logos })), snapshot(buildCvProArabicV3Pdf(documents.ar!)));
});
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
test("International changes only contacts and sidebar lists, preserving the rest of each foreign layout", () => {
  assert.throws(
    () => buildCvProInternationalPdf(documents.ar!, "ar"),
    /réservé aux langues étrangères/,
  );
  for (const { id } of DOCUMENT_LANGUAGES) {
    if (id === "ar") continue;
    const original = buildCvProPdf(documents[id]!, id);
    const international = buildCvProInternationalPdf(documents[id]!, id);
    const before = JSON.parse(snapshot(original));
    const after = JSON.parse(snapshot(international));
    const rows = after.content[1].table.body[0][0].stack;
    for (const row of rows) {
      assert.deepEqual(row.table.widths, ["*", 11, 7, "auto", "*"], id);
      assert.ok(row.table.body[0][1].svg, id);
      assert.equal(row.table.body[0][3].alignment, "left", id);
    }
    before.content[1].table.body[0][0].stack = [];
    after.content[1].table.body[0][0].stack = [];
    before.content[1].absolutePosition.y = after.content[1].absolutePosition.y;
    for (const definition of [before, after]) {
      const sidebar = definition.content[3].columns[0];
      sidebar.stack = sidebar.stack.filter((section: any) => !["software", "languages"].includes(section.zgrSectionId));
    }
    assert.deepEqual(after, before, id);
    assert.ok(
      snapshot(applyPdfTheme(international, "cv-pro-international", "#123456")).includes("#123456"),
    );
  }
});

test("International dynamically balances margins for every visible subset and portrait state", () => {
  const groups = [
    ["telephone"],
    ["email"],
    ["date_naissance", "situation_familiale"],
    ["permis_conduire"],
    ["service_national"],
    ["adresse"],
    ["statut_relocation"],
  ];
  for (const hasPhoto of [false, true])
    for (let mask = 0; mask < 128; mask++) {
      const hidden: Record<string, true> = {};
      groups.forEach((fields, index) => {
        if (!(mask & (1 << index))) for (const field of fields) hidden[`personal.${field}`] = true;
      });
      const source = {
        ...documents.fr!,
        photo: hasPhoto
          ? {
              dataUrl: "data:image/png;base64,fixture",
              name: "fixture",
              width: 140,
              height: 140,
              sizeBytes: 1,
              mimeType: "image/webp" as const,
              updatedAt: "2026-10-27",
            }
          : undefined,
      };
      const visible = applyCvVisibility(source, hidden);
      const document = JSON.parse(snapshot(buildCvProInternationalPdf(visible, "fr")));
      const block = document.content[1];
      const rows = block.table.body[0][0].stack;
      const count = groups.filter((_group, index) => mask & (1 << index)).length;
      assert.equal(rows.length, count, `mask ${mask}`);
      const geometry = internationalContactLayout(count, hasPhoto);
      assert.equal(
        block.absolutePosition.y - geometry.photoBottom,
        geometry.ovalBottom - (block.absolutePosition.y + geometry.height),
      );
      assert.ok(geometry.margin > 0);
      rows.forEach((row: any, index: number) => {
        assert.equal(row.table.heights, INTERNATIONAL_CONTACT_ROW_HEIGHT);
        assert.equal(row.margin[3], index === count - 1 ? 0 : INTERNATIONAL_CONTACT_GAP);
      });
    }
});
test("Whitespace-only contacts and a hidden address never leave phantom rows", () => {
  const cv = {
    ...emptyCV,
    telephone: "  ",
    email: " ",
    permis_conduire: " ",
    service_national: " ",
    wilaya: "Alger",
    pays: "Algérie",
  };
  const document = JSON.parse(snapshot(buildCvProInternationalPdf(cv, "fr")));
  assert.equal(document.content[1].table.body[0][0].stack.length, 0);
});
