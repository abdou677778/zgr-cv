// Synthetic PDF QA only. No private client, external source or cloud write.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import pdfMake from "pdfmake/build/pdfmake";
import { buildCvProPdf } from "../src/lib/cv-pro-pdf";
import { buildCvProArabicV3Pdf } from "../src/lib/cv-pro-ar-v3-pdf";
import { buildCvProInternationalPdf } from "../src/lib/cv-pro-international-pdf";
import { importCvJsonSet } from "../src/lib/cv-json";
import { applyCvVisibility } from "../src/lib/cv-visibility";
import { emptyCV } from "../src/lib/cv-types";

const root = new URL("../", import.meta.url);
const pack = JSON.parse(
  await readFile(new URL("test-data/json-multilingue/CV_TEST_GLOBAL_7_LANGUES.json", root), "utf8"),
);
const documents = importCvJsonSet(pack)!.documents;
const fonts = {
  Calibri: {
    normal: "CalibriLatin-Regular.ttf",
    bold: "CalibriLatin-Bold.ttf",
    italics: "CalibriLatin-Italic.ttf",
    bolditalics: "CalibriLatin-BoldItalic.ttf",
  },
  NotoSansArabic: {
    normal: "ArialArabic-Regular.ttf",
    bold: "ArialArabic-Bold.ttf",
    italics: "ArialArabic-Italic.ttf",
    bolditalics: "ArialArabic-BoldItalic.ttf",
  },
};
const vfs: Record<string, string> = {};
for (const name of new Set(Object.values(fonts).flatMap((family) => Object.values(family))))
  vfs[name] = (await readFile(new URL(`src/assets/fonts/${name}`, root))).toString("base64");
pdfMake.addFonts(fonts);
pdfMake.addVirtualFileSystem(vfs);
const output = new URL("output/pdf/cv-pro-variants/", root);
await mkdir(output, { recursive: true });
const variants = [
  ["international-arabic-institution", buildCvProInternationalPdf({
    ...documents.fr!,
    educations: [{ id: "usthb", titre: "Licence en informatique", date: "2012 – 2015",
      institution: "جامعة هواري بومدين للعلوم والتكنولوجيا (USTHB)", lieu: "Alger, Algérie", option: "", equivalence: "" }],
  }, "fr")],
  ["arabic-before", buildCvProPdf(documents.ar!, "ar")],
  ["arabic-v3", buildCvProArabicV3Pdf(documents.ar!)],
  ["french-before", buildCvProPdf(documents.fr!, "fr")],
  ["international-fr", buildCvProInternationalPdf(documents.fr!, "fr")],
  [
    "international-without-status",
    buildCvProInternationalPdf({ ...documents.fr!, statut_relocation: "" }, "fr"),
  ],
  [
    "international-hidden-address",
    buildCvProInternationalPdf(
      applyCvVisibility(documents.fr!, { "personal.adresse": true }),
      "fr",
    ),
  ],
  [
    "international-only-phone",
    buildCvProInternationalPdf(
      { ...emptyCV, nom_complet: "Test", telephone: "0555 123 456" },
      "fr",
    ),
  ],
  [
    "international-no-contacts",
    buildCvProInternationalPdf({ ...emptyCV, nom_complet: "Test" }, "fr"),
  ],
] as const;
for (const [name, definition] of variants) {
  const blob = await pdfMake.createPdf(definition).getBlob();
  await writeFile(new URL(`${name}.pdf`, output), new Uint8Array(await blob.arrayBuffer()));
  console.log(`${name}.pdf: ${blob.size} bytes`);
}
