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
  const scalar = <K extends keyof CV>(key: K, path = `personal.${String(key)}`): CV[K] =>
    visible(path) ? cv[key] : ("" as CV[K]);

  const langues = Object.fromEntries(
    (Object.keys(cv.langues) as Array<keyof Langues>).map((key) => [
      key,
      visible(`languages.${key}`) ? cv.langues[key] : "",
    ]),
  ) as Langues;

  const experiences = cv.experiences
    .map((item, itemIndex) => {
      const prefix = `experience.${itemIndex}`;
      const next: Experience = {
        ...item,
        dates: visible(`${prefix}.dates`) ? item.dates : "",
        lieu: visible(`${prefix}.lieu`) ? item.lieu : "",
        titre: visible(`${prefix}.titre`) ? item.titre : "",
        employeur: visible(`${prefix}.employeur`) ? item.employeur : "",
        descriptions: item.descriptions.filter((_, index) =>
          visible(`${prefix}.description.${index}`),
        ),
      };
      return next;
    })
    .filter(hasExperienceContent);

  const formations = cv.formations
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

  const educations = cv.educations
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

  const lettreMotivation: LettreMotivation = {
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
    objectif: visible("objective") ? cv.objectif : "",
    competences: cv.competences.filter((_, index) => visible(`skills.${index}`)),
    langues,
    experiences,
    formations,
    educations,
    participations: cv.participations.filter((_, index) => visible(`participations.${index}`)),
    certifications: cv.certifications.filter((_, index) => visible(`certifications.${index}`)),
    interets: cv.interets.filter((_, index) => visible(`interets.${index}`)),
    references: cv.references.filter((_, index) => visible(`references.${index}`)),
    lettre_motivation: lettreMotivation,
    plan_developpement: cv.plan_developpement.filter((_, index) =>
      visible(`plan_developpement.${index}`),
    ),
  };
}
