export type Experience = {
  id: string;
  dates: string;
  lieu: string;
  titre: string;
  employeur: string;
  descriptions: string[];
  descriptions_format?: ObjectiveFormat;
  logo?: CompanyLogo;
};

export type CompanyLogo = {
  /** Safe, compact raster image embedded in JSON and every generated PDF. */
  dataUrl: string;
  name: string;
  width: number;
  height: number;
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

export type EuropassCefrLevel = "" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type EuropassLanguageProfile = {
  code: string;
  label: string;
  mother_tongue: boolean;
  listening: EuropassCefrLevel;
  reading: EuropassCefrLevel;
  spoken_interaction: EuropassCefrLevel;
  spoken_production: EuropassCefrLevel;
  writing: EuropassCefrLevel;
};

export type EuropassSocialProfile = {
  platform: string;
  username: string;
  url: string;
};

export type EuropassExperienceDetails = {
  id: string;
  city: string;
  country_code: string;
  country_label: string;
  industry_code: string;
  department: string;
  website: string;
};

export type EuropassEducationDetails = {
  id: string;
  city: string;
  country_code: string;
  country_label: string;
  eqf_level: string;
  field_code: string;
  specific_field_code: string;
  website: string;
};

/** Optional factual metadata used by the current Europass Candidate XML format. */
export type EuropassProfile = {
  given_name: string;
  family_name: string;
  gender_code: string;
  nationality_code: string;
  nationality_label: string;
  birth_place: string;
  birth_country_code: string;
  address_line_1: string;
  address_line_2: string;
  postal_code: string;
  city: string;
  country_code: string;
  country_label: string;
  phone_country_code: string;
  website: string;
  instant_messaging: string;
  work_permit_countries: string[];
  driving_licences: string[];
  social_profiles: EuropassSocialProfile[];
  languages: EuropassLanguageProfile[];
  experience_details: EuropassExperienceDetails[];
  education_details: EuropassEducationDetails[];
};

export const emptyEuropassProfile: EuropassProfile = {
  given_name: "",
  family_name: "",
  gender_code: "",
  nationality_code: "",
  nationality_label: "",
  birth_place: "",
  birth_country_code: "",
  address_line_1: "",
  address_line_2: "",
  postal_code: "",
  city: "",
  country_code: "",
  country_label: "",
  phone_country_code: "",
  website: "",
  instant_messaging: "",
  work_permit_countries: [],
  driving_licences: [],
  social_profiles: [],
  languages: [],
  experience_details: [],
  education_details: [],
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
  competences_format?: ObjectiveFormat;
  langues: Langues;
  experiences: Experience[];
  formations: Formation[];
  educations: Education[];
  participations: string[];
  participations_format?: ObjectiveFormat;
  certifications: string[];
  certifications_format?: ObjectiveFormat;
  interets: string[];
  interets_format?: ObjectiveFormat;
  references: string[];
  lettre_motivation: LettreMotivation;
  plan_developpement: string[];
  europass?: EuropassProfile;
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
  competences_format: { html: "", alignment: "", fontSize: 15, color: "" },
  langues: { fr: "", en: "", ar: "", de: "", es: "", kab: "" },
  experiences: [],
  formations: [],
  educations: [],
  participations: [],
  participations_format: { html: "", alignment: "", fontSize: 15, color: "" },
  certifications: [],
  certifications_format: { html: "", alignment: "", fontSize: 15, color: "" },
  interets: [],
  interets_format: { html: "", alignment: "", fontSize: 15, color: "" },
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
  europass: { ...emptyEuropassProfile },
};
