import { emptyEuropassProfile, type CV } from "./cv-types";

export type EuropassCoverage = {
  percent: number;
  mapped: string[];
  missing: string[];
};

export function analyzeEuropassCoverage(cv: CV): EuropassCoverage {
  const profile = cv.europass || emptyEuropassProfile;
  const checks: Array<[string, boolean]> = [
    ["identité", Boolean(cv.nom_complet)],
    ["titre/profil", Boolean(cv.titre_poste || cv.objectif)],
    ["courriel", Boolean(cv.email)],
    ["téléphone", Boolean(cv.telephone)],
    ["adresse", Boolean(cv.adresse || profile.address_line_1)],
    ["date de naissance", /\b(?:19|20)\d{2}\b/.test(cv.date_naissance)],
    ["sexe", /^(male|female|other|notSpecified)$/.test(profile.gender_code.trim())],
    ["nationalité", /^[a-z]{2}$/i.test(profile.nationality_code.trim())],
    ["lieu de naissance", Boolean(profile.birth_place)],
    ["photo", Boolean(cv.photo?.dataUrl)],
    ["expériences", cv.experiences.length > 0],
    ["études et formations", cv.educations.length + cv.formations.length > 0],
    ["compétences", cv.competences.some((item) => item.trim().length > 0)],
    [
      "langues CECRL",
      profile.languages.some((item) => !item.mother_tongue && Boolean(item.listening)),
    ],
    ["certifications", cv.certifications.length > 0],
    ["permis de conduire", Boolean(profile.driving_licences.length || cv.permis_conduire)],
    ["centres d’intérêt", cv.interets.length > 0],
    ["métadonnées employeurs", profile.experience_details.length > 0],
    ["métadonnées études", profile.education_details.length > 0],
  ];
  const mapped = checks.filter(([, present]) => present).map(([label]) => label);
  const missing = checks.filter(([, present]) => !present).map(([label]) => label);
  return { percent: Math.round((mapped.length / checks.length) * 100), mapped, missing };
}
