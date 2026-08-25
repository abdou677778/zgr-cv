import {
  emptyCV,
  newId,
  type CV,
  type Education,
  type Experience,
  type Formation,
} from "./cv-types";
import { DOCUMENT_LANGUAGES, type DocumentLanguage } from "./document-language";
import { normalizeObjectiveFormat } from "./cv-objective-format";

export type JsonImportLanguage = "auto" | "fr" | "en";

export type CvJsonImportResult = {
  cv: CV;
  language: "fr" | "en" | "native";
  summary: string;
};

export type CvJsonSetImportResult = {
  documents: Partial<Record<DocumentLanguage, CV>>;
  languages: DocumentLanguage[];
  defaultLanguage: DocumentLanguage;
  summary: string;
};

type JsonRecord = Record<string, unknown>;

const record = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const stringList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  return Object.values(record(value)).map(text).filter(Boolean);
};

const objectList = (value: unknown) => Object.values(record(value)).map(record);

const firstText = (source: JsonRecord, ...keys: string[]) => {
  for (const key of keys) {
    const value = text(source[key]);
    if (value) return value;
  }
  return "";
};

const documentLanguage = (value: unknown): DocumentLanguage | null => {
  const code = text(value).toLowerCase();
  return DOCUMENT_LANGUAGES.some((item) => item.id === code) ? (code as DocumentLanguage) : null;
};

const summaryForCv = (cv: CV) =>
  [
    `${cv.experiences.length} expérience${cv.experiences.length > 1 ? "s" : ""}`,
    `${cv.educations.length} diplôme${cv.educations.length > 1 ? "s" : ""}`,
    `${cv.formations.length} formation${cv.formations.length > 1 ? "s" : ""}`,
    `${cv.references.length} référence${cv.references.length > 1 ? "s" : ""}`,
  ].join(" · ");

export function importCvJsonSet(value: unknown): CvJsonSetImportResult | null {
  const root = record(value);
  const documentsRoot = record(root.documents);
  const documents: Partial<Record<DocumentLanguage, CV>> = {};

  if (Object.keys(documentsRoot).length) {
    for (const language of DOCUMENT_LANGUAGES) {
      const candidate = record(documentsRoot[language.id]);
      if (!Object.keys(candidate).length) continue;
      const wrappedDocument = record(candidate.document);
      const payload = Object.keys(wrappedDocument).length ? wrappedDocument : candidate;
      documents[language.id] = importCvJson(payload, "auto").cv;
    }
  } else {
    const wrappedDocument = record(root.document);
    const language = documentLanguage(root.language);
    if (Object.keys(wrappedDocument).length && language) {
      documents[language] = importCvJson(wrappedDocument, "auto").cv;
    }
  }

  const languages = DOCUMENT_LANGUAGES.map((item) => item.id).filter(
    (language) => documents[language],
  );
  if (!languages.length) return null;

  const requestedDefault =
    documentLanguage(root.default_language) ?? documentLanguage(root.language);
  const defaultLanguage =
    requestedDefault && documents[requestedDefault] ? requestedDefault : languages[0];

  return {
    documents,
    languages,
    defaultLanguage,
    summary: summaryForCv(documents[defaultLanguage]!),
  };
}

function directCv(source: JsonRecord): CV {
  const langues = record(source.langues);
  const experiences = Array.isArray(source.experiences) ? source.experiences.map(record) : [];
  const formations = Array.isArray(source.formations) ? source.formations.map(record) : [];
  const educations = Array.isArray(source.educations) ? source.educations.map(record) : [];
  const lettre = record(source.lettre_motivation);

  return {
    ...emptyCV,
    nom_complet: text(source.nom_complet),
    titre_poste: text(source.titre_poste),
    telephone: text(source.telephone),
    email: text(source.email),
    adresse: text(source.adresse),
    statut_relocation: text(source.statut_relocation),
    date_naissance: text(source.date_naissance),
    situation_familiale: text(source.situation_familiale),
    permis_conduire: text(source.permis_conduire),
    service_national: text(source.service_national),
    wilaya: text(source.wilaya),
    pays: text(source.pays),
    candidature: text(source.candidature),
    objectif: text(source.objectif),
    objectif_format: normalizeObjectiveFormat(source.objectif_format),
    competences: stringList(source.competences),
    langues: {
      fr: text(langues.fr),
      en: text(langues.en),
      ar: text(langues.ar),
      de: text(langues.de),
      es: text(langues.es),
      kab: text(langues.kab),
    },
    experiences: experiences.map(
      (item): Experience => ({
        id: text(item.id) || newId(),
        dates: text(item.dates),
        lieu: text(item.lieu),
        titre: text(item.titre),
        employeur: text(item.employeur),
        descriptions: stringList(item.descriptions),
      }),
    ),
    formations: formations.map(
      (item): Formation => ({
        id: text(item.id) || newId(),
        date: text(item.date),
        lieu: text(item.lieu),
        titre: text(item.titre),
        institution: text(item.institution),
        competences: text(item.competences),
      }),
    ),
    educations: educations.map(
      (item): Education => ({
        id: text(item.id) || newId(),
        date: text(item.date),
        lieu: text(item.lieu),
        titre: text(item.titre),
        institution: text(item.institution),
        option: text(item.option),
        equivalence: text(item.equivalence),
      }),
    ),
    participations: stringList(source.participations),
    certifications: stringList(source.certifications),
    interets: stringList(source.interets),
    references: stringList(source.references),
    lettre_motivation: {
      date: text(lettre.date),
      objet: text(lettre.objet),
      destinataire: text(lettre.destinataire),
      salutation: text(lettre.salutation),
      paragraphes: stringList(lettre.paragraphes),
      formule_politesse: text(lettre.formule_politesse),
    },
    plan_developpement: stringList(source.plan_developpement),
  };
}

function structuredCv(root: JsonRecord, language: "fr" | "en"): CV {
  const french = language === "fr";
  const content = record(root[french ? "CONTENU_FRANCAIS" : "CONTENU_ANGLAIS"]);
  const personal = record(content[french ? "INFORMATIONS PERSONNELLES" : "PERSONAL INFORMATION"]);
  const objective = record(content[french ? "OBJECTIF PROFESSIONNEL" : "PROFESSIONAL OBJECTIVE"]);
  const languages = record(content[french ? "LANGUES" : "LANGUAGES"]);
  const experienceSource =
    content[french ? "EXPÉRIENCE PROFESSIONNELLE" : "PROFESSIONAL EXPERIENCE"];
  const educationSource = content[french ? "ÉDUCATION" : "EDUCATION"];
  const trainingSource = content[french ? "FORMATION" : "TRAINING"];
  const cover = record(content[french ? "LETTRE DE MOTIVATION" : "COVER LETTER"]);
  const advised = record(root.CONTENU_ADVISES);
  const application = record(advised.INFORMATIONS_CANDIDATURE);
  const plan = advised.PLAN_DE_DEVELOPPEMENT;

  const experiences = objectList(experienceSource).map(
    (item): Experience => ({
      id: newId(),
      dates: firstText(item, "Dates"),
      lieu: firstText(item, french ? "Lieu" : "Location"),
      titre: firstText(item, french ? "Titre du poste" : "Job Title"),
      employeur: firstText(item, french ? "Entreprise" : "Company"),
      descriptions: stringList(item.Description),
    }),
  );

  const formations = objectList(trainingSource).map(
    (item): Formation => ({
      id: newId(),
      date: firstText(item, "Date"),
      lieu: firstText(item, french ? "Lieu" : "Location"),
      titre: firstText(item, french ? "Titre de la formation" : "Training Title"),
      institution: firstText(item, "Institution"),
      competences: firstText(item, french ? "Compétences acquises" : "Skills Acquired"),
    }),
  );

  const educations = objectList(educationSource).map(
    (item): Education => ({
      id: newId(),
      date: firstText(item, "Date"),
      lieu: firstText(item, french ? "Lieu" : "Location"),
      titre: firstText(item, french ? "Titre du diplôme" : "Diploma Title"),
      institution: firstText(item, "Institution"),
      option: firstText(item, "Option"),
      equivalence: firstText(item, french ? "Équivalence" : "Equivalence"),
    }),
  );

  const paragraphs = Object.entries(cover)
    .filter(([key]) => /^(Paragraphe|Paragraph)/i.test(key))
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([, value]) => text(value))
    .filter(Boolean);

  const references = stringList(content[french ? "RÉFÉRENCES" : "REFERENCES"]);
  const position = french
    ? firstText(application, "Poste") || firstText(personal, "Poste")
    : firstText(personal, "Position") || firstText(application, "Poste");
  const frenchPlan = stringList(plan);
  const englishPlan = [
    "Deepen professional English proficiency, especially spoken communication, to support effective international collaboration",
    "Strengthen software architecture and microservices design capabilities",
    "Continue developing expertise in DevOps practices and application observability",
    "Contribute regularly to open-source projects to expand both the professional portfolio and network",
    "Tailor the résumé and cover letters to Canadian market expectations and local recruitment practices",
  ];
  const letterDate = new Intl.DateTimeFormat(french ? "fr-CA" : "en-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return {
    ...emptyCV,
    nom_complet: firstText(personal, french ? "Nom complet" : "Full name"),
    titre_poste: firstText(personal, french ? "Poste" : "Position"),
    telephone: firstText(personal, french ? "Téléphone" : "Phone"),
    email: firstText(personal, "Email"),
    adresse: firstText(personal, french ? "Adresse" : "Address"),
    statut_relocation: firstText(personal, french ? "Statut de relocation" : "Relocation Status"),
    date_naissance: firstText(personal, french ? "Date de naissance" : "Birthday"),
    situation_familiale: firstText(personal, french ? "Situation Familialle" : "Marital status"),
    permis_conduire: firstText(personal, french ? "Permis de conduire" : "driving licence"),
    service_national: firstText(personal, french ? "Service National" : "Military Service Status"),
    wilaya: firstText(personal, "Wilaya"),
    pays: firstText(personal, french ? "Pays" : "Country"),
    candidature: french
      ? firstText(application, "Candidature")
      : `Application for a ${position} opportunity in Canada`,
    objectif: firstText(objective, french ? "Texte de l'objectif" : "Objective Text"),
    competences: stringList(content[french ? "COMPÉTENCES CLÉS" : "KEY SKILLS"]),
    langues: {
      fr: firstText(languages, french ? "Français" : "French"),
      en: firstText(languages, french ? "Anglais" : "English"),
      ar: firstText(languages, french ? "Arabe" : "Arabic"),
      de: firstText(languages, french ? "Allemand" : "German"),
      es: firstText(languages, french ? "Espagnol" : "Spanish"),
      kab: firstText(languages, "Kabyle"),
    },
    experiences,
    formations,
    educations,
    participations: stringList(content.PARTICIPATION),
    certifications: stringList(content.CERTIFICATIONS),
    interets: stringList(content[french ? "CENTRES D'INTÉRÊT" : "INTERESTS"]),
    references,
    lettre_motivation: {
      date: letterDate,
      objet: french
        ? `Candidature au poste de ${position}`
        : `Application for the position of ${position}`,
      destinataire: "",
      salutation: firstText(cover, "Salutation"),
      paragraphes: paragraphs,
      formule_politesse: firstText(cover, french ? "Formule de politesse" : "Closing"),
    },
    plan_developpement: french ? frenchPlan : frenchPlan.length ? englishPlan : [],
  };
}

export function importCvJson(
  value: unknown,
  preferredLanguage: JsonImportLanguage,
): CvJsonImportResult {
  const root = record(value);
  if (Object.keys(root).length === 0) throw new Error("Le fichier JSON est vide ou invalide.");

  let language: "fr" | "en" | "native";
  let cv: CV;
  if (root.CONTENU_FRANCAIS || root.CONTENU_ANGLAIS) {
    const selected =
      preferredLanguage === "fr" && root.CONTENU_FRANCAIS
        ? "fr"
        : preferredLanguage === "en" && root.CONTENU_ANGLAIS
          ? "en"
          : root.CONTENU_FRANCAIS
            ? "fr"
            : "en";
    language = selected;
    cv = structuredCv(root, selected);
  } else if ("nom_complet" in root || "experiences" in root) {
    language = "native";
    cv = directCv(root);
  } else {
    throw new Error("Structure JSON non reconnue. Aucun contenu CV compatible n’a été trouvé.");
  }

  const summary = summaryForCv(cv);

  return { cv, language, summary };
}
