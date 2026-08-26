import type { CV, Education, Experience, Formation, Langues, LettreMotivation } from "./cv-types";

export type HiddenCvElements = Record<string, true>;

export const cvElementIsVisible = (hidden: HiddenCvElements, path: string) => !hidden[path];

const hasExperienceContent = (item: Experience) =>
  Boolean(item.dates || item.lieu || item.titre || item.employeur || item.descriptions.length);

const hasFormationContent = (item: Formation) =>
  Boolean(item.date || item.lieu || item.titre || item.institution || item.competences);

const hasEducationContent = (item: Education) =>
  Boolean(
    item.date || item.lieu || item.titre || item.institution || item.option || item.equivalence,
  );

/**
 * Returns a document-only projection of the CV. Hidden values remain untouched
 * in the editor state but are removed from previews and every PDF export.
 */
export function applyCvVisibility(cv: CV, hidden: HiddenCvElements): CV {
  const visible = (path: string) => cvElementIsVisible(hidden, path);
  const sectionVisible = (id: string) => visible(`section.${id}`);
  const visibleList = (items: string[], sectionId: string, prefix: string) =>
    sectionVisible(sectionId) ? items.filter((_, index) => visible(`${prefix}.${index}`)) : [];
  const visibleListFormat = (
    items: string[],
    sectionId: string,
    prefix: string,
    format: CV["competences_format"],
  ) => {
    const filtered = visibleList(items, sectionId, prefix);
    return filtered.length === items.length ? format : format ? { ...format, html: "" } : undefined;
  };
  const scalar = <K extends keyof CV>(key: K, path = `personal.${String(key)}`): CV[K] =>
    sectionVisible("personal") && visible(path) ? cv[key] : ("" as CV[K]);

  const langues = Object.fromEntries(
    (Object.keys(cv.langues) as Array<keyof Langues>).map((key) => [
      key,
      sectionVisible("languages") && visible(`languages.${key}`) ? cv.langues[key] : "",
    ]),
  ) as Langues;

  const experiences = (sectionVisible("experience") ? cv.experiences : [])
    .map((item, itemIndex) => {
      const prefix = `experience.${itemIndex}`;
      const descriptions = item.descriptions.filter((_, index) =>
        visible(`${prefix}.description.${index}`),
      );
      const employerVisible = visible(`${prefix}.employeur`);
      const next: Experience = {
        ...item,
        dates: visible(`${prefix}.dates`) ? item.dates : "",
        lieu: visible(`${prefix}.lieu`) ? item.lieu : "",
        titre: visible(`${prefix}.titre`) ? item.titre : "",
        employeur: employerVisible ? item.employeur : "",
        logo: employerVisible ? item.logo : undefined,
        descriptions,
        descriptions_format:
          descriptions.length === item.descriptions.length
            ? item.descriptions_format
            : item.descriptions_format
              ? { ...item.descriptions_format, html: "" }
              : undefined,
      };
      return next;
    })
    .filter(hasExperienceContent);

  const formations = (sectionVisible("training") ? cv.formations : [])
    .map((item, itemIndex) => {
      const prefix = `formation.${itemIndex}`;
      const next: Formation = {
        ...item,
        date: visible(`${prefix}.date`) ? item.date : "",
        lieu: visible(`${prefix}.lieu`) ? item.lieu : "",
        titre: visible(`${prefix}.titre`) ? item.titre : "",
        institution: visible(`${prefix}.institution`) ? item.institution : "",
        competences: visible(`${prefix}.competences`) ? item.competences : "",
      };
      return next;
    })
    .filter(hasFormationContent);

  const educations = (sectionVisible("education") ? cv.educations : [])
    .map((item, itemIndex) => {
      const prefix = `education.${itemIndex}`;
      const next: Education = {
        ...item,
        date: visible(`${prefix}.date`) ? item.date : "",
        lieu: visible(`${prefix}.lieu`) ? item.lieu : "",
        titre: visible(`${prefix}.titre`) ? item.titre : "",
        institution: visible(`${prefix}.institution`) ? item.institution : "",
        option: visible(`${prefix}.option`) ? item.option : "",
        equivalence: visible(`${prefix}.equivalence`) ? item.equivalence : "",
      };
      return next;
    })
    .filter(hasEducationContent);

  const lettreMotivation: LettreMotivation = sectionVisible("letter")
    ? {
        date: visible("letter.date") ? cv.lettre_motivation.date : "",
        objet: visible("letter.objet") ? cv.lettre_motivation.objet : "",
        destinataire: visible("letter.destinataire") ? cv.lettre_motivation.destinataire : "",
        salutation: visible("letter.salutation") ? cv.lettre_motivation.salutation : "",
        paragraphes: cv.lettre_motivation.paragraphes.filter((_, index) =>
          visible(`letter.paragraphes.${index}`),
        ),
        formule_politesse: visible("letter.formule_politesse")
          ? cv.lettre_motivation.formule_politesse
          : "",
      }
    : {
        date: "",
        objet: "",
        destinataire: "",
        salutation: "",
        paragraphes: [],
        formule_politesse: "",
      };

  return {
    ...cv,
    nom_complet: scalar("nom_complet"),
    titre_poste: scalar("titre_poste"),
    telephone: scalar("telephone"),
    email: scalar("email"),
    adresse: scalar("adresse"),
    statut_relocation: scalar("statut_relocation"),
    date_naissance: scalar("date_naissance"),
    situation_familiale: scalar("situation_familiale"),
    permis_conduire: scalar("permis_conduire"),
    service_national: scalar("service_national"),
    wilaya: scalar("wilaya"),
    pays: scalar("pays"),
    candidature: scalar("candidature"),
    objectif: sectionVisible("objective") && visible("objective") ? cv.objectif : "",
    objectif_format:
      sectionVisible("objective") && visible("objective")
        ? cv.objectif_format
        : { html: "", alignment: "", fontSize: 15, color: "" },
    competences: visibleList(cv.competences, "skills", "skills"),
    competences_format: visibleListFormat(
      cv.competences,
      "skills",
      "skills",
      cv.competences_format,
    ),
    langues,
    experiences,
    formations,
    educations,
    participations: visibleList(cv.participations, "volunteering", "participations"),
    participations_format: visibleListFormat(
      cv.participations,
      "volunteering",
      "participations",
      cv.participations_format,
    ),
    certifications: visibleList(cv.certifications, "certifications", "certifications"),
    certifications_format: visibleListFormat(
      cv.certifications,
      "certifications",
      "certifications",
      cv.certifications_format,
    ),
    interets: visibleList(cv.interets, "interests", "interets"),
    interets_format: visibleListFormat(cv.interets, "interests", "interets", cv.interets_format),
    references: sectionVisible("references")
      ? cv.references.filter((_, index) => visible(`references.${index}`))
      : [],
    lettre_motivation: lettreMotivation,
    plan_developpement: sectionVisible("development")
      ? cv.plan_developpement.filter((_, index) => visible(`plan_developpement.${index}`))
      : [],
  };
}
