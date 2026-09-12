import {
  ADVISES_TEMPLATE_ID,
  COVER_LETTER_TEMPLATES,
  CV_TEMPLATES,
  EUROPASS_TEMPLATE_ID,
  getCvTemplatesForLanguage,
  type PdfTemplateId,
} from "./document-templates";
import { DOCUMENT_LANGUAGES, type DocumentLanguage } from "./document-language";

export type DocumentKind = "cv" | "cover-letter" | "advises";
export type { PdfTemplateId } from "./document-templates";

export const COMPLETE_PACK_DOCUMENT_COUNT = DOCUMENT_LANGUAGES.reduce(
  (total, language) =>
    total + getCvTemplatesForLanguage(language.id).length + COVER_LETTER_TEMPLATES.length + 1,
  0,
);

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

export function getTemplates(kind: DocumentKind, language?: DocumentLanguage) {
  if (kind === "cover-letter") return COVER_LETTER_TEMPLATES;
  if (kind === "advises") return [{ id: ADVISES_TEMPLATE_ID, name: "Template Advises" }] as const;
  const cvTemplates = language ? getCvTemplatesForLanguage(language) : CV_TEMPLATES;
  return [...cvTemplates, { id: EUROPASS_TEMPLATE_ID, name: "CV Europass" }] as const;
}

export function defaultTemplateFor(kind: DocumentKind): PdfTemplateId {
  return kind === "cover-letter"
    ? "cover-letter-v1"
    : kind === "advises"
      ? ADVISES_TEMPLATE_ID
      : "canadian-v1";
}
