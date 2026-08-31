export type CvTemplateId =
  | "canadian-v1"
  | "canadian-v2"
  | "canadian-v3"
  | "canadian-v4"
  | "ats-a4"
  | "arabic-pro-v1";

export const CV_TEMPLATES: ReadonlyArray<{ id: CvTemplateId; name: string }> = [
  { id: "canadian-v1", name: "CV Canadien V1" },
  { id: "canadian-v2", name: "CV Canadien V2" },
  { id: "canadian-v3", name: "CV Canadien V3" },
  { id: "canadian-v4", name: "CV Canadien V4" },
  { id: "ats-a4", name: "CV ATS Format A4" },
  { id: "arabic-pro-v1", name: "CV Pro Arabe V1" },
];

export const isArabicCvTemplate = (templateId: string) =>
  /^arabic-pro-v[1-5]$/.test(templateId);

/** Arabic designs are intentionally available only with Arabic source data. */
export function getCvTemplatesForLanguage(language: string) {
  return language === "ar"
    ? CV_TEMPLATES
    : CV_TEMPLATES.filter((template) => !isArabicCvTemplate(template.id));
}

/** Routes every former Arabic layout to the single retained V1 design. */
export function normalizeCvTemplateForLanguage(templateId: string, language: string): CvTemplateId {
  const migrated = isArabicCvTemplate(templateId) ? "arabic-pro-v1" : templateId;
  const available = getCvTemplatesForLanguage(language);
  return (available.some((template) => template.id === migrated) ? migrated : "canadian-v1") as CvTemplateId;
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
export const EUROPASS_TEMPLATE_ID = "europass" as const;

export type PdfTemplateId =
  | CvTemplateId
  | CoverLetterTemplateId
  | typeof ADVISES_TEMPLATE_ID
  | typeof EUROPASS_TEMPLATE_ID;
