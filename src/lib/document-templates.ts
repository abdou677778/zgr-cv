import { DOCUMENT_LANGUAGES } from "./document-language";
export type CvTemplateId =
  | "canadian-v1"
  | "canadian-v2"
  | "canadian-v3"
  | "canadian-v4"
  | "ats-a4"
  | "cv-pro"
  | "cv-pro-ar-v3"
  | "cv-pro-international"
  | "arabic-pro-v1"
  | "arabic-pro-v2";

export const CV_TEMPLATES: ReadonlyArray<{ id: CvTemplateId; name: string }> = [
  { id: "canadian-v1", name: "CV Canadien V1" },
  { id: "canadian-v2", name: "CV Canadien V2" },
  { id: "canadian-v3", name: "CV Canadien V3" },
  { id: "canadian-v4", name: "CV Canadien V4" },
  { id: "ats-a4", name: "CV ATS Format A4" },
  { id: "cv-pro", name: "CV PRO (historique)" },
  { id: "cv-pro-international", name: "CV PRO International" },
  { id: "arabic-pro-v1", name: "CV Pro Arabe V1" },
  { id: "arabic-pro-v2", name: "CV PRO Arabe V2" },
  { id: "cv-pro-ar-v3", name: "CV PRO Arabe V3" },
];

export const isArabicCvTemplate = (templateId: string) =>
  templateId === "cv-pro-ar-v3" || /^arabic-pro-v[1-5]$/.test(templateId);
export const isCvProLayoutTemplate = (templateId: string) =>
  ["cv-pro", "cv-pro-ar-v3", "cv-pro-international"].includes(templateId);
export function getTemplateDocumentLanguages(templateId: string) {
  return DOCUMENT_LANGUAGES.filter((language) =>
    isArabicCvTemplate(templateId)
      ? language.id === "ar"
      : templateId === "cv-pro-international"
        ? language.id !== "ar"
        : true,
  );
}

/** Arabic designs are intentionally available only with Arabic source data. */
export function getCvTemplatesForLanguage(language: string) {
  return language === "ar"
    ? CV_TEMPLATES.filter((template) => template.id !== "cv-pro-international")
    : CV_TEMPLATES.filter((template) => !isArabicCvTemplate(template.id));
}

/** Keeps the active Arabic designs and routes removed legacy variants to V1. */
export function normalizeCvTemplateForLanguage(templateId: string, language: string): CvTemplateId {
  const migrated =
    templateId === "cv-pro-ar-v3" || templateId === "cv-pro-international"
      ? language === "ar"
        ? "cv-pro-ar-v3"
        : "cv-pro-international"
      : templateId === "arabic-pro-v1" || templateId === "arabic-pro-v2"
        ? templateId
        : isArabicCvTemplate(templateId)
          ? "arabic-pro-v1"
          : templateId;
  const available = getCvTemplatesForLanguage(language);
  return (
    available.some((template) => template.id === migrated) ? migrated : "canadian-v1"
  ) as CvTemplateId;
}

export type CoverLetterTemplateId =
  | "cover-letter-v1"
  | "cover-letter-v2"
  | "cover-letter-v3"
  | "cover-letter-v4"
  | "cover-letter-v5";

export const COVER_LETTER_TEMPLATES: ReadonlyArray<{
  id: CoverLetterTemplateId;
  name: string;
}> = [
  { id: "cover-letter-v1", name: "Cover Letter V1 Canada" },
  { id: "cover-letter-v2", name: "Cover Letter V2" },
  { id: "cover-letter-v3", name: "Cover Letter V3" },
  { id: "cover-letter-v4", name: "Cover Letter V4" },
  { id: "cover-letter-v5", name: "Cover Letter V5 Europass" },
];

export const ADVISES_TEMPLATE_ID = "advises-v1" as const;
export const OPPORTUNITY_PLAN_TEMPLATE_ID = "opportunity-plan-v1" as const;
export const EUROPASS_TEMPLATE_ID = "europass" as const;

export type PdfTemplateId =
  | CvTemplateId
  | CoverLetterTemplateId
  | typeof ADVISES_TEMPLATE_ID
  | typeof OPPORTUNITY_PLAN_TEMPLATE_ID
  | typeof EUROPASS_TEMPLATE_ID;
