import type { CV } from "./cv-types";
import { isArabicCvTemplate, isCvProLayoutTemplate } from "./document-templates";

export function supportsOrganizationLogos(templateId: string) {
  return isCvProLayoutTemplate(templateId) || isArabicCvTemplate(templateId);
}

/** Rendering projection only: switching templates must never delete saved logos. */
export function projectOrganizationLogos(cv: CV, templateId: string): CV {
  if (supportsOrganizationLogos(templateId)) return cv;
  const withoutLogo = <T extends { logo?: unknown }>(row: T): T => {
    const { logo: _logo, ...rest } = row;
    return rest as T;
  };
  return {
    ...cv,
    experiences: cv.experiences.map(withoutLogo),
    formations: cv.formations.map(withoutLogo),
    educations: cv.educations.map(withoutLogo),
  };
}
