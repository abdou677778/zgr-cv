import type { CV } from "./cv-types";
import {
  ADVISES_TEMPLATE_ID,
  COVER_LETTER_TEMPLATES,
  CV_TEMPLATES,
  EUROPASS_TEMPLATE_ID,
  type CoverLetterTemplateId,
  type CvTemplateId,
  type PdfTemplateId,
} from "./document-templates";
import { DOCUMENT_LANGUAGES, languageInfo, type DocumentLanguage } from "./document-language";
import { DEFAULT_TEMPLATE_COLORS, type TemplateColorMap, type ThemeTemplateId } from "./pdf-theme";
import { strToU8, zipSync } from "fflate";

export type DocumentKind = "cv" | "cover-letter" | "advises";
export type { PdfTemplateId } from "./document-templates";

export function getDocumentKinds(language: DocumentLanguage) {
  const names = {
    fr: ["Curriculum vitae", "Lettre de motivation", "Conseils / Plan professionnel"],
    en: ["Résumé / CV", "Cover letter", "Professional advice / Plan"],
    es: ["Currículum vitae", "Carta de presentación", "Consejos / Plan profesional"],
    de: ["Lebenslauf", "Anschreiben", "Beratung / Beruflicher Plan"],
    it: ["Curriculum vitae", "Lettera di presentazione", "Consigli / Piano professionale"],
    zh: ["简历", "求职信", "职业建议 / 发展计划"],
    ar: ["السيرة الذاتية", "رسالة التحفيز", "النصائح / الخطة المهنية"],
  }[language];
  return [
    { id: "cv" as const, name: names[0] },
    { id: "cover-letter" as const, name: names[1] },
    { id: "advises" as const, name: names[2] },
  ];
}

export function getTemplates(kind: DocumentKind) {
  if (kind === "cover-letter") return COVER_LETTER_TEMPLATES;
  if (kind === "advises") return [{ id: ADVISES_TEMPLATE_ID, name: "Template Advises" }] as const;
  return [...CV_TEMPLATES, { id: EUROPASS_TEMPLATE_ID, name: "CV Europass" }] as const;
}

export function defaultTemplateFor(kind: DocumentKind): PdfTemplateId {
  return kind === "cover-letter"
    ? "cover-letter-v1"
    : kind === "advises"
      ? ADVISES_TEMPLATE_ID
      : "canadian-v1";
}

export async function createDocumentPdfBlob(
  cv: CV,
  kind: DocumentKind,
  templateId: PdfTemplateId,
  language: DocumentLanguage,
  accentColor?: string,
) {
  if (templateId === EUROPASS_TEMPLATE_ID) {
    throw new Error("Le modèle Europass produit un fichier XML et non un document PDF.");
  }
  if (kind === "cover-letter") {
    const { createCoverLetterPdfBlob } = await import("./letter-pdf");
    return createCoverLetterPdfBlob(cv, templateId as CoverLetterTemplateId, language, accentColor);
  }
  if (kind === "advises") {
    const { createAdvisesPdfBlob } = await import("./advises-pdf");
    return createAdvisesPdfBlob(cv, language, accentColor);
  }
  const { createCvPdfBlob } = await import("./cv-pdf");
  return createCvPdfBlob(cv, templateId as CvTemplateId, language, accentColor);
}

export interface CompletePackProgress {
  completed: number;
  total: number;
  label: string;
}

type CvByLanguage = Record<DocumentLanguage, CV>;

function packEntries(language: DocumentLanguage) {
  const languageFolder = `${language.toUpperCase()}_${safeFilename(languageInfo(language).name)}`;
  return [
    ...CV_TEMPLATES.map((template, index) => ({
      kind: "cv" as const,
      templateId: template.id as PdfTemplateId,
      folder: `${languageFolder}/CV`,
      filename: `${String(index + 1).padStart(2, "0")}_${safeFilename(template.name)}`,
      label: template.name,
    })),
    ...COVER_LETTER_TEMPLATES.map((template, index) => ({
      kind: "cover-letter" as const,
      templateId: template.id as PdfTemplateId,
      folder: `${languageFolder}/Cover_Letters`,
      filename: `${String(index + 1).padStart(2, "0")}_${safeFilename(template.name)}`,
      label: template.name,
    })),
    {
      kind: "advises" as const,
      templateId: ADVISES_TEMPLATE_ID as PdfTemplateId,
      folder: `${languageFolder}/Advises`,
      filename: `01_${safeFilename("Template Advises")}`,
      label: "Template Advises",
    },
  ];
}

export async function createCurrentTemplateMultilingualZip(
  cvByLanguage: CvByLanguage,
  kind: DocumentKind,
  templateId: PdfTemplateId,
  onProgress?: (progress: CompletePackProgress) => void,
  accentColor?: string,
) {
  const files: Record<string, Uint8Array> = {};
  const total = DOCUMENT_LANGUAGES.length;
  for (const [index, language] of DOCUMENT_LANGUAGES.entries()) {
    onProgress?.({ completed: index, total, label: language.name });
    const blob = await createDocumentPdfBlob(
      cvByLanguage[language.id],
      kind,
      templateId,
      language.id,
      accentColor,
    );
    const folder = `${language.id.toUpperCase()}_${safeFilename(language.name)}`;
    const path = `${folder}/${safeFilename(getTemplates(kind).find((item) => item.id === templateId)?.name || "Document")}_${language.id.toUpperCase()}.pdf`;
    files[path] = new Uint8Array(await blob.arrayBuffer());
  }
  files["MANIFEST.txt"] = strToU8(
    `ZGR CV - CURRENT TEMPLATE - 7 LANGUAGES\n${Object.keys(files).join("\n")}\n`,
  );
  onProgress?.({ completed: total, total, label: "ZIP" });
  const archive = zipSync(files, { level: 6 });
  return new Blob([archive.buffer as ArrayBuffer], { type: "application/zip" });
}

export async function createCompletePackZip(
  cvByLanguage: CvByLanguage,
  onProgress?: (progress: CompletePackProgress) => void,
  templateColors: TemplateColorMap = DEFAULT_TEMPLATE_COLORS,
) {
  const entries = DOCUMENT_LANGUAGES.flatMap((language) =>
    packEntries(language.id).map((entry) => ({ ...entry, language: language.id })),
  );
  const files: Record<string, Uint8Array> = {};
  const manifestLines = ["ZGR CV COMPLETE MULTILINGUAL PACK", "7 languages - 12 templates", ""];

  for (const [index, entry] of entries.entries()) {
    onProgress?.({ completed: index, total: entries.length, label: entry.label });
    const blob = await createDocumentPdfBlob(
      cvByLanguage[entry.language],
      entry.kind,
      entry.templateId,
      entry.language,
      templateColors[entry.templateId as ThemeTemplateId],
    );
    const path = `${entry.folder}/${entry.filename}_${entry.language.toUpperCase()}.pdf`;
    files[path] = new Uint8Array(await blob.arrayBuffer());
    manifestLines.push(`${index + 1}. ${path}`);
  }

  files["MANIFEST.txt"] = strToU8(`${manifestLines.join("\n")}\n`);
  onProgress?.({ completed: entries.length, total: entries.length, label: "ZIP" });

  const archive = zipSync(files, { level: 6 });
  return new Blob([archive.buffer as ArrayBuffer], { type: "application/zip" });
}

export function downloadPdfDocument(
  blob: Blob,
  cv: CV,
  kind: DocumentKind,
  language: DocumentLanguage,
) {
  const suffix =
    kind === "cover-letter"
      ? language === "fr"
        ? "Lettre_de_motivation"
        : "Cover_Letter"
      : kind === "advises"
        ? language === "fr"
          ? "Plan_professionnel"
          : "Professional_plan"
        : "CV";
  const filename = `${safeFilename(cv.nom_complet || "document")}_${suffix}_${language.toUpperCase()}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadCompletePackArchive(blob: Blob, cv: CV) {
  downloadBlob(blob, `${safeFilename(cv.nom_complet || "ZGR_CV")}_Pack_Complet_Multilingue.zip`);
}

export function downloadCurrentMultilingualArchive(blob: Blob, cv: CV) {
  downloadBlob(blob, `${safeFilename(cv.nom_complet || "ZGR_CV")}_Modele_Actuel_7_Langues.zip`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function safeFilename(value: string) {
  return (
    value
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[<>:"/\\|?*]/g, "")
      .split("")
      .filter((character) => character.charCodeAt(0) >= 32)
      .join("")
      .replace(/\s+/g, "_") || "document"
  );
}
