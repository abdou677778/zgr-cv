import type { CV } from "./cv-types";
import type { DocumentLanguage } from "./document-language";
import { buildCvProPdf } from "./cv-pro-pdf";

/** LTR entry point. International improvements must not edit the frozen Arabic V3. */
export function buildCvProInternationalPdf(cv: CV, language: DocumentLanguage) {
  if (language === "ar")
    throw new Error(
      "CV PRO International est réservé aux langues étrangères. Utiliser CV PRO Arabe V3.",
    );
  return buildCvProPdf(cv, language,{inlineContacts:true, verticalSidebarLists:true});
}
