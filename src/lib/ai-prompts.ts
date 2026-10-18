import type { CV } from "./cv-types";
import { languageInfo, type DocumentLanguage } from "./document-language";

export type FieldAiResponse = { value: string };

export type NocPromptEntry = { code: string; title: string };

export const FIELD_AI_SYSTEM = `Tu es un rédacteur senior de CV et lettres de motivation. Tu dois améliorer uniquement le champ demandé, dans la langue demandée, sans inventer aucun fait, chiffre, employeur, compétence, diplôme ou résultat. Préserve les noms propres, dates et technologies. Réponds exclusivement en JSON strict sous la forme {"value":"..."}. Aucun Markdown.`;

export const NOC_AI_SYSTEM = `Tu es un classificateur professionnel CNP Canada. Tu dois choisir exactement un code à cinq chiffres dans la liste officielle fournie, principalement d'après les fonctions réellement exercées. Après le code, propose un intitulé professionnel canadien naturel, localisé dans la langue demandée et au singulier. Respecte le genre grammatical uniquement s'il est explicitement établi par le titre source ; ne l'infère jamais depuis le nom. N'invente jamais de code et ne réponds pas si les preuves sont insuffisantes. Réponds exclusivement en JSON strict sous la forme {"value":"73300 | Conducteur de camion de transport"} ou {"value":""}. Aucun Markdown.`;

export function nocAiPrompt(
  language: DocumentLanguage,
  jobTitle: string,
  instruction: string,
  cv: CV,
  entries: readonly NocPromptEntry[],
) {
  const evidence = {
    titre_poste: jobTitle,
    experiences: cv.experiences.map(({ titre, descriptions }) => ({
      titre,
      descriptions: descriptions.filter(Boolean),
    })),
    competences: cv.competences.filter(Boolean),
  };
  return `Langue du profil : ${languageInfo(language).name}.\nInstruction : ${instruction}.\nPreuves professionnelles : ${JSON.stringify(evidence)}\nCodes CNP 2021 v1.0 autorisés : ${JSON.stringify(entries)}\nChoisis uniquement le code dont les fonctions correspondent aux preuves. Transforme ensuite l'intitulé officiel en titre professionnel localisé, naturel et singulier. Exemple français masculin : « Chauffeur poids lourd » correspondant aux fonctions du groupe 73300 devient « Conducteur de camion de transport ». Retourne {"value":"CODE | TITRE LOCALISÉ"}; si la correspondance n'est pas suffisamment fiable, retourne {"value":""}.`;
}

export function fieldAiPrompt(
  language: DocumentLanguage,
  label: string,
  currentValue: string,
  instruction: string,
  cv: CV,
) {
  const normalizedLabel = label.toLocaleLowerCase("fr");
  const formatRule = /téléphone|telephone|phone/.test(normalizedLabel)
    ? "Règle de format impérative : retourner « (indicatif pays) numéro national », par exemple « (213) 772604280 ». Conserver tous les chiffres source et ne jamais inventer ou supprimer un chiffre."
    : /adresse|address|dirección|indirizzo|anschrift|地址|العنوان/.test(normalizedLabel)
      ? "Règle de format impérative : retourner uniquement « Code postal, Wilaya/Province, Pays » avec les éléments attestés. Exclure rue, cité, bloc, numéro, bâtiment et appartement ; ne jamais inventer un élément absent."
      : /permis|driving licence|driving license/.test(normalizedLabel)
        ? "Règle de format impérative : retourner uniquement les catégories attestées sous la forme « Catégories B et A ». Exclure numéro, date, véhicule, navire et toute explication."
        : /service national|national service|military service/.test(normalizedLabel)
          ? "Règle de format impérative : retourner un seul statut direct attesté : « Dégagé », « Dispensé », « Sursis », « Accompli » ou « En cours ». Exclure toute explication."
      : "";
  const context = {
    nom_complet: cv.nom_complet,
    titre_poste: cv.titre_poste,
    cnp: cv.cnp,
    candidature: cv.candidature,
    objectif: cv.objectif,
    competences: cv.competences.filter(Boolean),
    logiciels: cv.logiciels.filter((item) => item.label.trim()),
    experiences: cv.experiences.map(({ dates, titre, employeur, descriptions }) => ({
      dates,
      titre,
      employeur,
      descriptions: descriptions.filter(Boolean),
    })),
  };
  return `Langue de sortie : ${languageInfo(language).name} (${languageInfo(language).locale}).\nChamp : ${label}.\nValeur actuelle : ${JSON.stringify(currentValue)}.\nInstruction utilisateur : ${instruction || "Reformuler avec clarté, naturel et concision professionnelle."}\n${formatRule}\nContexte factuel autorisé : ${JSON.stringify(context)}\nRetourne uniquement {"value":"texte final"}.`;
}

export const IMPORT_AI_SYSTEM = `Tu es un moteur strict de mapping de données de CV. Transforme le JSON source, même si ses clés ou sa hiérarchie sont inconnues, vers le schéma ZGR fourni. Utilise uniquement les faits présents. N'invente rien. Une chaîne absente vaut "" et une collection absente vaut []. Trie les expériences, formations et études de la plus récente à la plus ancienne. Conserve les noms propres, coordonnées, dates et nombres. Pour adresse, ne produis jamais rue, cité, bloc, numéro, bâtiment ou appartement : utilise strictement « Code postal, Wilaya/Province, Pays » avec les éléments réellement connus. Pour telephone, utilise « (indicatif pays) numéro national », par exemple « (213) 772604280 », sans inventer ni supprimer de chiffre. Pour permis_conduire, retourne seulement « Catégories B et A » avec les catégories attestées; jamais numéro, date ou détail. Pour service_national, retourne seulement un statut attesté : « Dégagé », « Dispensé », « Sursis », « Accompli » ou « En cours ». Réponds exclusivement avec un objet JSON strict directement compatible, sans Markdown.`;

export function importAiPrompt(language: DocumentLanguage, source: unknown) {
  return `Langue du document produit : ${languageInfo(language).name}.\nJSON source :\n${JSON.stringify(source)}\n\nRègle impérative d’adresse : le champ adresse contient uniquement « Code postal, Wilaya/Province, Pays ». Exclure rue, cité, bloc, numéro, bâtiment et appartement. N’invente jamais un code postal ou un pays absent.\nRègle impérative de téléphone : utiliser « (indicatif pays) numéro national », par exemple « (213) 772604280 ». Ne jamais inventer, supprimer ou modifier un chiffre.\n\nSchéma exact obligatoire :\n${JSON.stringify(
    {
      nom_complet: "",
      titre_poste: "",
      cnp: {
        code: "",
        title: "",
        teer: "",
        version: "CNP 2021 v1.0",
        sourceUrl: "https://www.statcan.gc.ca/fr/sujets/norme/cnp/2021/indexV1",
      },
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
      logiciels: [{ id: "software-01", label: "", icon: "generic" }],
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
