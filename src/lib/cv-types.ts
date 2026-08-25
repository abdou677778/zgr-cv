export type Experience = {
  id: string;
  dates: string;
  lieu: string;
  titre: string;
  employeur: string;
  descriptions: string[];
};

export type Formation = {
  id: string;
  date: string;
  lieu: string;
  titre: string;
  institution: string;
  competences: string;
};

export type Education = {
  id: string;
  date: string;
  lieu: string;
  titre: string;
  institution: string;
  option: string;
  equivalence: string;
};

export type Langues = {
  fr: string;
  en: string;
  ar: string;
  de: string;
  es: string;
  kab: string;
};

export type LettreMotivation = {
  date: string;
  objet: string;
  destinataire: string;
  salutation: string;
  paragraphes: string[];
  formule_politesse: string;
};

export type ObjectiveTextAlignment = "" | "left" | "center" | "right";

export type ObjectiveFormat = {
  /** Safe inline HTML produced by the profile editor; the plain ATS text stays in `objectif`. */
  html: string;
  alignment: ObjectiveTextAlignment;
  /** Editor reference size in pixels. PDF templates apply the same proportional scale. */
  fontSize: number;
  /** Empty keeps the original template color. */
  color: string;
};

export type CV = {
  nom_complet: string;
  titre_poste: string;
  telephone: string;
  email: string;
  adresse: string;
  statut_relocation: string;
  date_naissance: string;
  situation_familiale: string;
  permis_conduire: string;
  service_national: string;
  wilaya: string;
  pays: string;
  candidature: string;
  objectif: string;
  objectif_format?: ObjectiveFormat;
  competences: string[];
  langues: Langues;
  experiences: Experience[];
  formations: Formation[];
  educations: Education[];
  participations: string[];
  certifications: string[];
  interets: string[];
  references: string[];
  lettre_motivation: LettreMotivation;
  plan_developpement: string[];
};

export const newId = () => Math.random().toString(36).slice(2, 9);

export const emptyCV: CV = {
  nom_complet: "",
  titre_poste: "",
  telephone: "",
  email: "",
  adresse: "",
  statut_relocation: "",
  date_naissance: "",
  situation_familiale: "",
  permis_conduire: "",
  service_national: "",
  wilaya: "",
  pays: "",
  candidature: "",
  objectif: "",
  objectif_format: { html: "", alignment: "", fontSize: 15, color: "" },
  competences: ["", "", "", "", "", "", ""],
  langues: { fr: "", en: "", ar: "", de: "", es: "", kab: "" },
  experiences: [],
  formations: [],
  educations: [],
  participations: [],
  certifications: [],
  interets: [],
  references: [],
  lettre_motivation: {
    date: "",
    objet: "",
    destinataire: "",
    salutation: "",
    paragraphes: [],
    formule_politesse: "",
  },
  plan_developpement: [],
};
