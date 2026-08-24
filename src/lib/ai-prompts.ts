import type { CV } from "./cv-types";
import { languageInfo, type DocumentLanguage } from "./document-language";

export type FieldAiResponse = { value: string };

export const FIELD_AI_SYSTEM = `Tu es un rédacteur senior de CV et lettres de motivation. Tu dois améliorer uniquement le champ demandé, dans la langue demandée, sans inventer aucun fait, chiffre, employeur, compétence, diplôme ou résultat. Préserve les noms propres, dates et technologies. Réponds exclusivement en JSON strict sous la forme {"value":"..."}. Aucun Markdown.`;

export function fieldAiPrompt(
  language: DocumentLanguage,
  label: string,
  currentValue: string,
  instruction: string,
  cv: CV,
) {
  const context = {
    nom_complet: cv.nom_complet,
    titre_poste: cv.titre_poste,
    candidature: cv.candidature,
    objectif: cv.objectif,
    competences: cv.competences.filter(Boolean),
    experiences: cv.experiences.map(({ dates, titre, employeur, descriptions }) => ({
      dates,
      titre,
      employeur,
      descriptions: descriptions.filter(Boolean),
    })),
  };
  return `Langue de sortie : ${languageInfo(language).name} (${languageInfo(language).locale}).\nChamp : ${label}.\nValeur actuelle : ${JSON.stringify(currentValue)}.\nInstruction utilisateur : ${instruction || "Reformuler avec clarté, naturel et concision professionnelle."}\nContexte factuel autorisé : ${JSON.stringify(context)}\nRetourne uniquement {"value":"texte final"}.`;
}

export const IMPORT_AI_SYSTEM = `Tu es un moteur strict de mapping de données de CV. Transforme le JSON source, même si ses clés ou sa hiérarchie sont inconnues, vers le schéma ZGR fourni. Utilise uniquement les faits présents. N'invente rien. Une chaîne absente vaut "" et une collection absente vaut []. Trie les expériences, formations et études de la plus récente à la plus ancienne. Conserve les noms propres, coordonnées, dates et nombres. Réponds exclusivement avec un objet JSON strict directement compatible, sans Markdown.`;

export function importAiPrompt(language: DocumentLanguage, source: unknown) {
  return `Langue du document produit : ${languageInfo(language).name}.\nJSON source :\n${JSON.stringify(source)}\n\nSchéma exact obligatoire :\n${JSON.stringify(
    {
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
      competences: [],
      langues: { fr: "", en: "", ar: "", de: "", es: "", kab: "" },
      experiences: [
        { id: "experience-01", dates: "", lieu: "", titre: "", employeur: "", descriptions: [] },
      ],
      formations: [
        { id: "formation-01", date: "", lieu: "", titre: "", institution: "", competences: "" },
      ],
      educations: [
        {
          id: "education-01",
          date: "",
          lieu: "",
          titre: "",
          institution: "",
          option: "",
          equivalence: "",
        },
      ],
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
    },
  )}\nLes objets exemples dans les tableaux définissent une forme, pas un nombre minimal : si aucune donnée réelle n'existe, retourne []. Retourne uniquement le document JSON final.`;
}

export function cvMissingFields(cv: CV) {
  const missing: string[] = [];
  if (!cv.nom_complet.trim()) missing.push("Nom complet");
  if (!cv.titre_poste.trim()) missing.push("Titre du poste");
  if (!cv.telephone.trim() && !cv.email.trim()) missing.push("Téléphone ou email");
  if (!cv.objectif.trim()) missing.push("Objectif professionnel");
  if (!cv.competences.some((item) => item.trim())) missing.push("Compétences");
  if (!cv.experiences.some((item) => item.titre.trim() || item.employeur.trim()))
    missing.push("Expérience professionnelle");
  if (!cv.educations.some((item) => item.titre.trim() || item.institution.trim()))
    missing.push("Éducation");
  if (!cv.lettre_motivation.paragraphes.some((item) => item.trim()))
    missing.push("Lettre de motivation");
  return missing;
}
