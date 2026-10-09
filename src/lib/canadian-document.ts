import type { CV } from "./cv-types";
import type { DocumentLanguage } from "./document-language";
import type { DocumentKind } from "./document-catalog";
import type { PdfTemplateId } from "./document-templates";
import { defaultRelocationStatus } from "./relocation-status";

const CANADIAN_CV_TEMPLATES = new Set(["canadian-v1", "canadian-v2", "canadian-v3", "canadian-v4"]);

export function isCanadianDocument(kind: DocumentKind, templateId: PdfTemplateId) {
  return (
    (kind === "cv" && CANADIAN_CV_TEMPLATES.has(String(templateId))) ||
    (kind === "cover-letter" && templateId === "cover-letter-v1")
  );
}

export function prepareCvForDocument(
  cv: CV,
  kind: DocumentKind,
  templateId: PdfTemplateId,
  language: DocumentLanguage,
): CV {
  if (!isCanadianDocument(kind, templateId)) return cv;
  const code = cv.cnp?.code?.trim();
  const title = cv.titre_poste.trim().replace(new RegExp(`\\s*[-–—]\\s*${code || "$^"}$`), "");
  return {
    ...cv,
    titre_poste: `${title}${code && /^\d{5}$/.test(code) ? ` - ${code}` : ""}`.toLocaleUpperCase(
      language,
    ),
    statut_relocation: defaultRelocationStatus(language, "canada"),
  };
}
