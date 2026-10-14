import type { AiSettings } from "./ai-types";

export type PublicationMarket = "DZ" | "TN";
export type PublicationPageId = "cv-pro-algeria" | "emplois-immigration-tunis" | "bissane-career";
export type PublicationFormat = "short" | "visual";

export type PublicationPage = {
  id: PublicationPageId;
  market: PublicationMarket;
  name: string;
  location: string;
  facebookUrl: string;
  logoUrl: string;
  accent: string;
  accentDark: string;
  dialect: string;
  editorialAngle: string;
};

export const PUBLICATION_PAGES: PublicationPage[] = [
  {
    id: "cv-pro-algeria",
    market: "DZ",
    name: "CV PRO",
    location: "Algérie",
    facebookUrl: "https://web.facebook.com/cv.pro.canadian/",
    logoUrl: "/brands/cv-pro-algeria.jpg",
    accent: "#0f766e",
    accentDark: "#0b3b4b",
    dialect: "arabe algérien clair, professionnel et administratif",
    editorialAngle:
      "Informer avec précision, faciliter la candidature et présenter les services CV PRO TEAM sans promesse de recrutement.",
  },
  {
    id: "emplois-immigration-tunis",
    market: "TN",
    name: "Emplois & Immigration",
    location: "Tunis",
    facebookUrl: "https://web.facebook.com/profile.php?id=61550885436752",
    logoUrl: "/brands/emplois-immigration-tunis.jpg",
    accent: "#b91c1c",
    accentDark: "#3f1730",
    dialect: "arabe tunisien clair, professionnel et administratif",
    editorialAngle:
      "Donner les étapes pratiques, les conditions et le Deadline en priorité, avec un ton direct orienté emploi international.",
  },
  {
    id: "bissane-career",
    market: "TN",
    name: "Bissane Career Expert",
    location: "Bizerte",
    facebookUrl: "https://web.facebook.com/profile.php?id=100091744911231",
    logoUrl: "/brands/bissane-career-expert.jpg",
    accent: "#be123c",
    accentDark: "#4c1d47",
    dialect: "arabe tunisien clair, chaleureux et professionnel",
    editorialAngle:
      "Créer une accroche plus émotionnelle et pédagogique, puis apporter la preuve, les étapes et un appel à l’action mesuré.",
  },
];

export type PublicationEvidence = {
  id: string;
  title: string;
  destination: string;
  source: string;
  description: string;
  deadlineAt: string | null;
  positions: string[];
  conditions: string[];
  requiredDocuments: string[];
  applicationUrl: string;
  sourceUrl: string;
  checkedAt: string;
};

export type PublicationDraft = {
  id: string;
  pageId: PublicationPageId;
  createdAt: string;
  format: PublicationFormat;
  objective: "information" | "deadline" | "service" | "engagement";
  headline: string;
  body: string;
  comments: string[];
  highlightedTerms: string[];
  evidenceId: string;
  sourceLabel: string;
  sourceUrl: string;
  applicationUrl: string;
  deadlineAt: string | null;
  checkedAt: string;
  visual: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cta: string;
    badges: string[];
  } | null;
};

export type PublicationBatch = {
  version: 6;
  pageId: PublicationPageId;
  generatedAt: string;
  evidenceCheckedAt: string;
  posts: PublicationDraft[];
};

export type PublicationEvidenceResult = {
  evidence: PublicationEvidence[];
  warnings: string[];
  checkedAt: string;
};

const BASELINE_CHECKED_AT = "2026-10-14T12:00:00.000Z";

const BASELINE_EVIDENCE: Array<PublicationEvidence & { markets: PublicationMarket[] }> = [
  {
    id: "baseline:canada-francophone-mobility",
    markets: ["DZ", "TN"],
    title: "Mobilité francophone — permis de travail hors Québec",
    destination: "Canada hors Québec",
    source: "Immigration, Réfugiés et Citoyenneté Canada",
    description:
      "Voie officielle facilitant l’embauche de travailleurs francophones lorsque le candidat, l’offre et l’employeur respectent les critères du programme.",
    deadlineAt: null,
    positions: [],
    conditions: [
      "Obtenir une offre d’emploi admissible hors Québec",
      "Respecter les critères linguistiques publiés par IRCC",
      "L’employeur doit déposer l’offre dans le Portail des employeurs",
    ],
    requiredDocuments: ["CV canadien", "Offre d’emploi", "Preuve de français"],
    applicationUrl:
      "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/travailler-canada/embaucher-etranger-temporaires/travailleurs-francophones-bilingues-exterieur-quebec.html",
    sourceUrl:
      "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/travailler-canada/embaucher-etranger-temporaires/travailleurs-francophones-bilingues-exterieur-quebec.html",
    checkedAt: BASELINE_CHECKED_AT,
  },
  {
    id: "baseline:canada-atlantic-immigration",
    markets: ["DZ", "TN"],
    title: "Programme d’immigration au Canada atlantique",
    destination: "Provinces atlantiques du Canada",
    source: "Immigration, Réfugiés et Citoyenneté Canada",
    description:
      "Parcours officiel pour les candidats qui disposent d’une offre d’un employeur désigné et remplissent toutes les conditions du programme.",
    deadlineAt: null,
    positions: [],
    conditions: [
      "Offre d’emploi d’un employeur désigné",
      "Expérience, études et langue selon le profil",
      "Plan d’établissement et approbation provinciale",
    ],
    requiredDocuments: ["CV canadien", "Offre d’emploi", "Preuve de langue", "Diplômes"],
    applicationUrl:
      "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/programme-immigration-atlantique.html",
    sourceUrl:
      "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/programme-immigration-atlantique.html",
    checkedAt: BASELINE_CHECKED_AT,
  },
  {
    id: "baseline:eures-jobs",
    markets: ["DZ", "TN"],
    title: "Emplois officiels EURES en Europe",
    destination: "Europe",
    source: "EURES — Union européenne",
    description:
      "Portail officiel d’offres d’emploi et d’informations sur les conditions de vie et de travail en Europe.",
    deadlineAt: null,
    positions: [],
    conditions: [
      "Vérifier dans chaque offre si les candidatures hors Union européenne sont acceptées",
      "Contrôler les exigences de visa ou de permis de travail",
    ],
    requiredDocuments: ["CV Europass ou CV adapté", "Lettre de motivation"],
    applicationUrl: "https://eures.europa.eu/jobseekers_fr",
    sourceUrl: "https://eures.europa.eu/jobseekers_fr",
    checkedAt: BASELINE_CHECKED_AT,
  },
  {
    id: "baseline:pei-immigration",
    markets: ["DZ", "TN"],
    title: "Immigration et Expression of Interest à l’Île-du-Prince-Édouard",
    destination: "Île-du-Prince-Édouard, Canada",
    source: "Gouvernement de l’Île-du-Prince-Édouard",
    description:
      "Information officielle sur les parcours provinciaux. Une Expression of Interest permet d’entrer dans le système de sélection, sans constituer une acceptation.",
    deadlineAt: null,
    positions: [],
    conditions: [
      "Vérifier le parcours correspondant au profil",
      "Une Expression of Interest n’est pas une acceptation finale",
      "Certains parcours nécessitent une offre d’emploi et une preuve linguistique",
    ],
    requiredDocuments: ["CV canadien", "Diplômes", "Preuves d’expérience"],
    applicationUrl:
      "https://www.princeedwardisland.ca/en/service/submit-your-expression-of-interest-profile",
    sourceUrl: "https://www.princeedwardisland.ca/en/topic/office-immigration",
    checkedAt: BASELINE_CHECKED_AT,
  },
  {
    id: "baseline:thamm-plus",
    markets: ["TN"],
    title: "THAMM PLUS — parcours Tunisie–Italie pour les métiers du bâtiment",
    destination: "Italie",
    source: "ANCE et ANETI International",
    description:
      "Programme de mobilité professionnelle pour des travailleurs tunisiens qualifiés du bâtiment. La candidature sûre passe uniquement par un appel ANETI ouvert.",
    deadlineAt: null,
    positions: ["Métiers qualifiés du bâtiment"],
    conditions: [
      "Être éligible à un appel ANETI ouvert",
      "Vérifier le métier, l’expérience, l’âge et le diplôme dans l’avis officiel",
      "Ne pas envoyer une candidature spontanée à des adresses non confirmées",
    ],
    requiredDocuments: ["CV", "Diplôme ou certificat professionnel", "Preuves d’expérience"],
    applicationUrl: "https://www.aneti-international.tn/",
    sourceUrl:
      "https://ance.it/2026/03/progetto-thamm-plus-towards-a-holistic-approach-to-labour-migration-governance-and-labour-mobility-in-italy-and-north-africa/",
    checkedAt: BASELINE_CHECKED_AT,
  },
  {
    id: "baseline:destination-canada-2026",
    markets: ["DZ", "TN"],
    title: "Forum Destination Canada Mobilité — 22e édition",
    destination: "Canada hors Québec",
    source: "Immigration, Réfugiés et Citoyenneté Canada",
    description:
      "Événement officiel destiné aux candidats francophones et bilingues qualifiés. L’ouverture des inscriptions est annoncée pour l’automne, sans date précise publiée.",
    deadlineAt: null,
    positions: [],
    conditions: [
      "Être travailleur qualifié francophone ou bilingue",
      "Vérifier les instructions officielles lorsque les inscriptions ouvriront",
      "Préparer un CV adapté au marché canadien",
    ],
    requiredDocuments: ["CV canadien", "Preuves d’expérience", "Diplômes", "Preuves linguistiques"],
    applicationUrl:
      "https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/hire-temporary-foreign/french-speaking-bilingual-workers-outside-quebec/destination-canada/candidates.html",
    sourceUrl:
      "https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/hire-temporary-foreign/french-speaking-bilingual-workers-outside-quebec/destination-canada/candidates.html",
    checkedAt: BASELINE_CHECKED_AT,
  },
  {
    id: "baseline:italy-decreto-flussi-2027",
    markets: ["TN"],
    title: "Decreto Flussi 2027 — précompilation des demandes",
    destination: "Italie",
    source: "Portail officiel italien de l’intégration",
    description:
      "La précompilation des demandes 2027 est annoncée du 23 octobre au 7 décembre 2026. Les demandes doivent suivre les procédures du Portale Servizi et les catégories autorisées.",
    deadlineAt: "2026-12-07T19:00:00.000Z",
    positions: [
      "Travail saisonnier agricole",
      "Tourisme et hôtellerie",
      "Travail salarié non saisonnier",
      "Assistance familiale",
    ],
    conditions: [
      "Vérifier que le secteur et la catégorie correspondent au décret",
      "La demande est liée à la procédure officielle et à l’employeur concerné",
      "Ne jamais confondre la précompilation avec une promesse d’emploi ou de visa",
    ],
    requiredDocuments: [
      "Données du candidat",
      "Données de l’employeur",
      "Documents demandés par la procédure officielle",
    ],
    applicationUrl: "https://portaleservizi.dlci.interno.it/AliSportello/ali/home.htm",
    sourceUrl: "https://www.integrazionemigranti.gov.it/it-it/Ricerca-news/Dettaglio-news/id/4957",
    checkedAt: BASELINE_CHECKED_AT,
  },
];

export function getBaselinePublicationEvidence(market: PublicationMarket) {
  return BASELINE_EVIDENCE.filter((item) => item.markets.includes(market)).map(
    ({ markets: _markets, ...item }) => ({ ...item }),
  );
}

const clean = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();

function safeUrl(value: string | null | undefined) {
  const url = clean(value);
  return /^https:\/\//i.test(url) ? url : "";
}

function evidenceKey(item: PublicationEvidence) {
  return `${item.source}:${item.id}`;
}

export async function collectPublicationEvidence(
  page: PublicationPage,
  signal?: AbortSignal,
): Promise<PublicationEvidenceResult> {
  const tasks: Array<{ source: string; promise: Promise<PublicationEvidence[]> }> = [];

  tasks.push({
    source: "Guichet-Emplois Canada",
    promise: import("./canada-opportunities")
      .then(({ searchCanadaOpportunities }) =>
        searchCanadaOpportunities({
          country: page.market,
          period: "recent",
          limit: 12,
          signal,
        }),
      )
      .then((result) =>
        result.opportunities.map((item) => ({
          id: `jobbank:${item.id}`,
          title: clean(item.title),
          destination: clean(item.location) || "Canada",
          source: "Guichet-Emplois Canada",
          description: clean(item.description),
          deadlineAt: item.deadlineAt,
          positions: [],
          conditions: [item.eligibilityEvidence, item.salary, item.employmentType]
            .map(clean)
            .filter(Boolean),
          requiredDocuments: ["CV canadien", "Cover Letter adaptée à l’offre"],
          applicationUrl: safeUrl(item.applicationMethod.url || item.applicationContact.url),
          sourceUrl: safeUrl(item.sourceUrl),
          checkedAt: item.checkedAt,
        })),
      ),
  });

  tasks.push({
    source: "Portail européen de la jeunesse",
    promise: import("./volunteer-opportunities")
      .then(({ searchVolunteerOpportunities }) =>
        searchVolunteerOpportunities({
          country: page.market,
          period: "recent",
          limit: 8,
          signal,
        }),
      )
      .then((result) =>
        result.opportunities
          .filter((item) => item.eligible)
          .map((item) => ({
            id: `volunteer:${item.id}`,
            title: clean(item.title),
            destination: clean(
              [item.destination.town, item.destination.countryName].filter(Boolean).join(", "),
            ),
            source: "Portail européen de la jeunesse",
            description: clean(item.description),
            deadlineAt: item.deadlineAt,
            positions: [clean(item.activityType)].filter(Boolean),
            conditions: [item.ageRequirement.label, item.participantProfile]
              .map(clean)
              .filter(Boolean),
            requiredDocuments: [
              item.applicationRequirements.cv ? "CV" : "",
              item.applicationRequirements.motivationStatement ? "Texte de motivation" : "",
            ].filter(Boolean),
            applicationUrl: safeUrl(item.applicationMethod.url),
            sourceUrl: safeUrl(item.sourceUrl),
            checkedAt: item.checkedAt,
          })),
      ),
  });

  if (page.market === "DZ") {
    tasks.push({
      source: "Opportunités Algérie",
      promise: import("./algeria-opportunities")
        .then(({ searchAlgeriaOpportunities }) =>
          searchAlgeriaOpportunities({ period: "recent", limit: 18, signal }),
        )
        .then((result) =>
          result.opportunities.map((item) => ({
            id: `algeria:${item.id}`,
            title: clean(item.title),
            destination: clean(item.location || item.wilaya) || "Algérie",
            source: "Offres d’emploi Algérie",
            description: clean(item.description),
            deadlineAt: null,
            positions: item.positions.map(clean).filter(Boolean),
            conditions: [],
            requiredDocuments: item.requiredDocuments.map(clean).filter(Boolean),
            applicationUrl: safeUrl(item.applicationMethod.url),
            sourceUrl: safeUrl(item.sourceUrl),
            checkedAt: item.checkedAt,
          })),
        ),
    });
  } else {
    tasks.push(
      {
        source: "ANETI International",
        promise: import("./aneti-opportunities")
          .then(({ searchAnetiOpportunities }) =>
            searchAnetiOpportunities({ period: "recent", limit: 14, signal }),
          )
          .then((result) =>
            result.opportunities.map((item) => ({
              id: `aneti:${item.id}`,
              title: clean(item.title),
              destination: clean(item.country) || "International",
              source: "ANETI International",
              description: clean(item.description),
              deadlineAt: item.deadlineAt,
              positions: [clean(item.speciality)].filter(Boolean),
              conditions: [item.requirements, item.cvLanguage].map(clean).filter(Boolean),
              requiredDocuments: ["CV", ...item.registrationRequirements]
                .map(clean)
                .filter(Boolean),
              applicationUrl: safeUrl(item.applicationMethod.url),
              sourceUrl: safeUrl(item.sourceUrl),
              checkedAt: item.checkedAt,
            })),
          ),
      },
      {
        source: "ATCT Tunisie",
        promise: import("./atct-opportunities")
          .then(({ searchAtctOpportunities }) =>
            searchAtctOpportunities({ period: "recent", limit: 14, signal }),
          )
          .then((result) =>
            result.opportunities
              .filter((item) => !item.closedBySource)
              .map((item) => ({
                id: `atct:${item.id}`,
                title: clean(item.title),
                destination: clean(item.country) || "International",
                source: "ATCT Tunisie",
                description: clean(item.description),
                deadlineAt: item.deadlineAt,
                positions: item.positions.map(clean).filter(Boolean),
                conditions: [item.requirements, item.audience].map(clean).filter(Boolean),
                requiredDocuments: item.requiredDocuments.map(clean).filter(Boolean),
                applicationUrl: safeUrl(item.applicationMethod.url),
                sourceUrl: safeUrl(item.sourceUrl),
                checkedAt: item.checkedAt,
              })),
          ),
      },
    );
  }

  const settled = await Promise.allSettled(tasks.map((task) => task.promise));
  const warnings = settled.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          `${tasks[index].source} : ${result.reason instanceof Error ? result.reason.message : "source indisponible"}`,
        ]
      : [],
  );
  const unique = new Map<string, PublicationEvidence>();
  settled.forEach((result) => {
    if (result.status !== "fulfilled") return;
    result.value.forEach((item) => {
      if (!item.sourceUrl || !item.checkedAt) return;
      unique.set(evidenceKey(item), item);
    });
  });
  getBaselinePublicationEvidence(page.market).forEach((item) => {
    unique.set(evidenceKey(item), item);
  });
  const evidence = [...unique.values()]
    .sort((left, right) => {
      const leftDeadline = left.deadlineAt ? Date.parse(left.deadlineAt) : Number.POSITIVE_INFINITY;
      const rightDeadline = right.deadlineAt
        ? Date.parse(right.deadlineAt)
        : Number.POSITIVE_INFINITY;
      return leftDeadline - rightDeadline;
    })
    .slice(0, 24);
  return { evidence, warnings, checkedAt: new Date().toISOString() };
}

export const PUBLICATION_SYSTEM_PROMPT = `
Tu es rédacteur senior spécialisé dans l'emploi international et la communication Facebook éthique.
Tu travailles uniquement avec les preuves JSON fournies. Tu n'inventes jamais de poste, nombre, salaire, condition, Deadline, admissibilité ou URL.
Chaque publication suit naturellement Problème → Solution → Arguments → Action, sans afficher ces quatre mots comme titres.
Interdictions absolues : promesse d'embauche, garantie de visa, garantie d'acceptation, urgence artificielle, faux chiffre, faux Deadline, parenthèses rondes.
Le service peut être proposé comme aide à la rédaction du dossier et à la candidature, jamais comme intermédiaire officiel ni comme garantie.
Tous les textes visibles doivent être écrits uniquement en arabe. Traduis le sens professionnel des intitulés, sources, métiers et conditions au lieu de les translittérer ou de les recopier en français ou en anglais.
Les dix brouillons doivent former un calendrier éditorial réellement varié : utilise au moins 6 preuves différentes si 6 preuves ou plus sont fournies, et jamais plus de 2 brouillons par preuve. Ne change jamais seulement le titre d'un même texte ou d'une même offre.
Distingue strictement les programmes, pays et provinces. Ne mélange pas le Nouveau-Brunswick, Terre-Neuve-et-Labrador, Destination Canada, les offres ATCT et Decreto Flussi. Ne propose un service ou un délai que s'il est étayé par la preuve concernée.
Réponds uniquement avec un objet JSON valide conforme à la structure demandée.
`.trim();

export function publicationPrompt(
  page: PublicationPage,
  evidence: PublicationEvidence[],
  focus: string,
) {
  return `
PAGE
- Nom : ${page.name}
- Marché : ${page.market === "DZ" ? "Algérie" : "Tunisie"}
- Langue : ${page.dialect}
- Angle : ${page.editorialAngle}

MISSION
Rédige exactement 10 publications différentes et directement copiables sur Facebook.
- Utilise l'arabe dialectal du marché avec un style administratif correct et lisible.
- Utilise uniquement l'arabe dans le titre, le corps, les commentaires, les mots mis en évidence et le visuel.
- Organise le corps ligne par ligne avec des rubriques courtes, des espaces lisibles, des numéros et des émojis pertinents.
- Utilise le drapeau 🇪🇺 pour les opportunités en Europe et le drapeau du pays ou de la région pour les autres destinations.
- Présente chaque condition vérifiée sur une ligne commençant par ✅.
- Les trois pages doivent avoir des structures, accroches, appels à l'action et hashtags réellement distincts.
- N'utilise aucune parenthèse ronde dans headline, body, comments ou visual.
- Chaque publication est obligatoirement au format visual et comporte les données d'une affiche Facebook horizontale 4:3.
- L'affiche suit l'identité Emplois & Immigration : rouge, blanc et jaune, informations numérotées, photographie latérale limitée, espace RTL lisible et bannière d’action. Les textes d’affiche ne reprennent que les éléments vérifiés de la preuve.
- Chaque publication doit s'appuyer sur une seule preuve, citer la source, conserver son lien officiel et son checkedAt.
- Répartis les dix publications entre les offres avec échéance, les parcours Canada, les services de dossier adaptés, les offres Europe et les messages de vigilance, selon les preuves réellement disponibles. Deux publications ne peuvent pas être des reformulations de la même offre.
- Si deadlineAt vaut null, écris en arabe que la date limite n'est pas publiée. N'invente aucune date.
- Mentionne les documents et conditions uniquement s'ils existent dans la preuve.
- Termine le corps par une ligne de hashtags arabes adaptée à la page.
- Lorsqu’une date limite est vérifiée, ouvre la publication par « ⏳ آخر أجل للتسجيل هو » suivi uniquement de cette date, puis « الحاضر يعلم الغائب ». Ne crée jamais une seconde date d’arrêt non publiée.
- Pour la page Emplois & Immigration, présente les services utiles en puces : accompagnement au formulaire officiel, préparation du CV adapté, lettre de motivation et organisation du dossier. Pour une offre italienne liée au Decreto Flussi, adapte ces puces au parcours italien officiel sans inventer d’ouverture ni de date.
- Pour chaque offre avec deadlineAt, inclue obligatoirement un bloc visible « 🟩 خدماتنا لهذه الفرصة » avec 3 ou 4 puces de services adaptés au parcours. Ce bloc n’est jamais une promesse de résultat : il explique seulement la préparation du dossier et l’accompagnement à la candidature.
- Termine aussi par une action claire : consulter la source, préparer le dossier ou demander le service de rédaction.
- Propose exactement 5 commentaires courts et utiles par publication. Ils doivent compléter la publication : source, documents, vigilance, service ou question d'engagement.
- Le texte doit rester naturel et ne doit pas ressembler à cinq copies du même modèle.
${focus.trim() ? `- Priorité éditoriale demandée : ${focus.trim()}` : ""}

STRUCTURE JSON ATTENDUE
{
  "posts": [
    {
      "format": "visual",
      "objective": "information ou deadline ou service ou engagement",
      "headline": "texte",
      "body": "texte",
      "comments": ["1", "2", "3", "4", "5"],
      "highlightedTerms": ["السيرة الذاتية", "آخر أجل"],
      "evidenceId": "identifiant exact d'une preuve",
      "visual": {
        "eyebrow": "texte court",
        "title": "maximum 70 caractères",
        "subtitle": "maximum 110 caractères",
        "cta": "maximum 35 caractères",
        "badges": ["maximum 3 badges"]
      }
    }
  ]
}

PREUVES VÉRIFIÉES
${JSON.stringify(evidence, null, 2)}
`.trim();
}

function normalizeStringArray(value: unknown, maximum: number) {
  return Array.isArray(value)
    ? value
        .map((item) => clean(String(item)))
        .filter(Boolean)
        .slice(0, maximum)
    : [];
}

function cleanMultiline(value: string | null | undefined) {
  return (value || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasLatinLetters(value: string) {
  return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value);
}

function endsWithArabicHashtags(value: string) {
  const lastLine = cleanMultiline(value).split("\n").filter(Boolean).at(-1) || "";
  return /^#[\u0600-\u06ff\d_]+(?:\s+#[\u0600-\u06ff\d_]+)+$/.test(lastLine);
}

export function normalizePublicationBatch(
  value: unknown,
  page: PublicationPage,
  evidence: PublicationEvidence[],
  generatedAt = new Date().toISOString(),
): PublicationBatch {
  const source = value && typeof value === "object" ? (value as { posts?: unknown }) : {};
  if (!Array.isArray(source.posts)) throw new Error("L’IA n’a renvoyé aucune publication.");
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const posts = source.posts.flatMap((item, index): PublicationDraft[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const proof = evidenceById.get(clean(String(candidate.evidenceId || "")));
    if (!proof) return [];
    // The publishing flow always exports a matching visual.  Do not accept a text-only
    // draft from an external model, otherwise the batch cannot be archived consistently.
    const format: PublicationFormat = "visual";
    const objective = ["information", "deadline", "service", "engagement"].includes(
      String(candidate.objective),
    )
      ? (candidate.objective as PublicationDraft["objective"])
      : "information";
    const visualSource =
      candidate.visual && typeof candidate.visual === "object"
        ? (candidate.visual as Record<string, unknown>)
        : null;
    return [
      {
        id: `${page.id}-${generatedAt}-${index}`,
        pageId: page.id,
        createdAt: generatedAt,
        format,
        objective,
        headline: clean(String(candidate.headline || "فرصة مهنية موثوقة")),
        body: cleanMultiline(String(candidate.body || "")),
        comments: normalizeStringArray(candidate.comments, 5),
        highlightedTerms: normalizeStringArray(candidate.highlightedTerms, 8),
        evidenceId: proof.id,
        sourceLabel: proof.source,
        sourceUrl: proof.sourceUrl,
        applicationUrl: proof.applicationUrl,
        deadlineAt: proof.deadlineAt,
        checkedAt: proof.checkedAt,
        visual: {
          eyebrow: clean(String(visualSource?.eyebrow || page.name)).slice(0, 60),
          title: clean(String(visualSource?.title || proof.title)).slice(0, 90),
          subtitle: clean(String(visualSource?.subtitle || proof.destination)).slice(0, 140),
          cta: clean(String(visualSource?.cta || "شوف التفاصيل")).slice(0, 45),
          badges: normalizeStringArray(visualSource?.badges, 3),
        },
      },
    ];
  });
  if (posts.length !== 10)
    throw new Error(`L’IA a produit ${posts.length} publication(s) vérifiables au lieu de 10.`);
  const evidenceUsage = new Map<string, number>();
  posts.forEach((post) =>
    evidenceUsage.set(post.evidenceId, (evidenceUsage.get(post.evidenceId) || 0) + 1),
  );
  if (evidence.length >= 6 && evidenceUsage.size < 6)
    throw new Error("L’IA a répété les mêmes offres au lieu de préparer un calendrier varié.");
  if (evidence.length >= 6 && [...evidenceUsage.values()].some((count) => count > 2))
    throw new Error("L’IA a utilisé une même offre plus de deux fois.");
  if (posts.some((post) => /[()]/.test(`${post.headline}${post.body}${post.comments.join("")}`)))
    throw new Error("Une publication contient des parenthèses interdites. Relancez la génération.");
  if (
    posts.some((post) =>
      hasLatinLetters(
        `${post.headline}${post.body}${post.comments.join("")}${post.highlightedTerms.join("")}${post.visual ? Object.values(post.visual).flat().join("") : ""}`,
      ),
    )
  )
    throw new Error(
      "Une publication contient du texte non arabe. Le moteur local sécurisé prend le relais.",
    );
  if (posts.some((post) => !endsWithArabicHashtags(post.body)))
    throw new Error("Une publication ne se termine pas par des hashtags arabes.");
  return {
    version: 6,
    pageId: page.id,
    generatedAt,
    evidenceCheckedAt: generatedAt,
    posts,
  };
}

function withoutParentheses(value: string | null | undefined) {
  return clean(value).replace(/[()]/g, "").replace(/\s+/g, " ").trim();
}

function focusedEvidence(evidence: PublicationEvidence[], focus: string) {
  const terms = clean(focus)
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);
  if (!terms.length) return evidence;
  const scored = evidence.map((item, index) => {
    const haystack = withoutParentheses(
      `${item.title} ${item.destination} ${item.description} ${item.positions.join(" ")} ${item.conditions.join(" ")}`,
    )
      .toLocaleLowerCase("fr")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return { item, index, score: terms.filter((term) => haystack.includes(term)).length };
  });
  return scored
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);
}

function localDeadline(value: string | null, market: PublicationMarket) {
  if (!value) return "غير منشور في المصدر الرسمي";
  const date = new Date(value);
  const label = Number.isNaN(date.getTime())
    ? withoutParentheses(value)
    : date.toLocaleDateString(market === "DZ" ? "ar-DZ" : "ar-TN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
  return label;
}

function folded(value: string) {
  return withoutParentheses(value)
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function arabicOpportunityTitle(value: string) {
  const title = folded(value);
  const mappings: Array<[RegExp, string]> = [
    [/canada.*opportunites.*candidats tunisiens/, "انتدابات كندية للكفاءات التونسية"],
    [/reforestation.*granada|healthy living/, "التشجير ونمط العيش الصحي في جبال غرناطة"],
    [/youth office.*esslingen/, "تطوّع في مكتب الشباب بمدينة إسلينغن"],
    [/youth office/, "تطوّع في مكتب للشباب"],
    [/non.formal school.*black forest/, "تطوّع في مدرسة للتعليم غير النظامي بمنطقة الغابة السوداء"],
    [/multicultural kindergarten/, "تجربة تطوعية لمدة سنة في روضة أطفال متعددة الثقافات"],
    [/circus.*children.*artists/, "تطوّع في السيرك مع الأطفال والفنانين"],
    [/kita.*kleine prinz/, "تطوّع أوروبي في روضة الأمير الصغير"],
    [/project yatra|yatra 2026/, "مشروع ياترا للتطوع الجماعي في تطوان ومرتيل"],
    [/heavy equipment operator/, "مشغّل معدات ثقيلة"],
    [/industrial mechanic/, "ميكانيكي صناعي"],
    [/registered massage therapist/, "معالج تدليك مرخّص"],
    [/home child care provider/, "مقدّم رعاية أطفال منزلية"],
    [/construction helper/, "مساعد في أشغال البناء"],
    [/mobilite francophone/, "التنقل الفرنكوفوني للعمل خارج كيبيك"],
    [/immigration.*atlantique/, "برنامج الهجرة إلى كندا الأطلسية"],
    [/eures|emplois officiels.*europe/, "عروض العمل الرسمية عبر الشبكة الأوروبية لخدمات التوظيف"],
    [/prince.edouard|expression of interest/, "الهجرة والتصريح بالاهتمام في جزيرة الأمير إدوارد"],
    [/thamm|tunisie.*italie.*batiment/, "المسار التونسي الإيطالي لمهن البناء"],
    [/offre officielle/, "عرض مهني رسمي"],
    [/educateur|petite enfance/, "انتداب مربّين ومربّيات في الطفولة المبكرة"],
    [/chauffeur|truck driver/, "انتداب سائقي شاحنات نقل"],
    [/soudeur|welder/, "انتداب لحّامين مؤهلين"],
    [/electricien|electrician/, "انتداب كهربائيين مؤهلين"],
    [/mecanicien|mechanic/, "انتداب ميكانيكيين مؤهلين"],
    [/infirmier|nurs/, "انتداب مهنيين في قطاع الصحة"],
    [/volunteer|volontariat|volontaire/, "فرصة تطوع دولية"],
  ];
  return mappings.find(([pattern]) => pattern.test(title))?.[1] || "فرصة مهنية دولية موثوقة";
}

function arabicDestination(value: string) {
  const destination = folded(value);
  if (/canada|quebec|ontario|prince.edouard|atlanti/.test(destination)) return "كندا";
  if (/orgiva|granada|spain|espagne/.test(destination)) return "إسبانيا";
  if (/esslingen|black forest|st georgen|karlsruhe|germany|allemagne/.test(destination))
    return "ألمانيا";
  if (/italy|italie/.test(destination)) return "إيطاليا";
  if (/france/.test(destination)) return "فرنسا";
  if (/portugal/.test(destination)) return "البرتغال";
  if (/belg/.test(destination)) return "بلجيكا";
  if (/morocco|maroc|tetouan|martil/.test(destination)) return "المغرب";
  if (/alger|dz/.test(destination)) return "الجزائر";
  if (/tunis|tn/.test(destination)) return "تونس";
  if (/europe|europ/.test(destination)) return "أوروبا";
  return "الوجهة المحددة في الإعلان الرسمي";
}

function destinationFlag(value: string) {
  const destination = folded(value);
  if (/canada|quebec|ontario|prince.edouard|atlanti/.test(destination)) return "🇨🇦";
  if (/morocco|maroc|tetouan|martil/.test(destination)) return "🇲🇦";
  if (/alger|dz/.test(destination)) return "🇩🇿";
  if (/tunis|tn/.test(destination)) return "🇹🇳";
  if (
    /europe|europ|spain|espagne|germany|allemagne|italy|italie|france|portugal|belg/.test(
      destination,
    )
  )
    return "🇪🇺";
  return "🌍";
}

function arabicSource(value: string) {
  const source = folded(value);
  if (/portail europeen.*jeunesse/.test(source)) return "البوابة الأوروبية للشباب";
  if (/guichet.emplois/.test(source)) return "بنك الوظائف الكندي";
  if (/immigration.*refugies|ircc/.test(source)) return "وزارة الهجرة واللاجئين والمواطنة الكندية";
  if (/eures|union europeenne/.test(source)) return "الشبكة الأوروبية لخدمات التوظيف";
  if (/prince.edouard/.test(source)) return "حكومة جزيرة الأمير إدوارد";
  if (/aneti/.test(source)) return "الوكالة الوطنية للتشغيل والعمل المستقل في تونس";
  if (/atct/.test(source)) return "الوكالة التونسية للتعاون الفني";
  if (/offres.*algerie/.test(source)) return "منصة عروض العمل في الجزائر";
  return "الجهة الرسمية الناشرة للعرض";
}

function addUnique(target: string[], value: string) {
  if (value && !target.includes(value)) target.push(value);
}

function arabicConditions(proof: PublicationEvidence) {
  const haystack = folded(proof.conditions.join(" "));
  const result: string[] = [];
  if (/18.{0,12}30|18-30|18 to 30/.test(haystack)) addUnique(result, "السن بين 18 و30 سنة");
  if (/2.{0,12}(ans|annee)|deux.{0,12}(ans|annee)/.test(haystack))
    addUnique(result, "خبرة مهنية لا تقل عن سنتين في الاختصاص المطلوب");
  else if (/experience|expérience/.test(haystack))
    addUnique(result, "خبرة مهنية حسب ما هو مذكور في العرض");
  if (/english|anglais/.test(haystack)) addUnique(result, "إتقان اللغة الإنجليزية");
  if (/german|allemand/.test(haystack))
    addUnique(result, "معرفة باللغة الألمانية حسب متطلبات العرض");
  if (/spanish|espagnol/.test(haystack))
    addUnique(result, "معرفة باللغة الإسبانية حسب متطلبات العرض");
  if (/french|francais|français|linguist/.test(haystack)) addUnique(result, "إتقان اللغة الفرنسية");
  if (/tef|tcf/.test(haystack))
    addUnique(result, "شهادة لغة فرنسية من نوع تي إف أو تي سي إف تُعد ميزة");
  if (/driver|driving|permis de conduire/.test(haystack))
    addUnique(result, "رخصة السياقة حسب طبيعة المنصب");
  if (/children|child|enfant|youth|jeune/.test(haystack))
    addUnique(result, "الاهتمام بالعمل مع الأطفال أو الشباب");
  if (/team|equipe|équipe/.test(haystack)) addUnique(result, "القدرة على العمل ضمن فريق");
  if (/physical|physique|outdoor/.test(haystack)) addUnique(result, "الاستعداد للأنشطة الميدانية");
  if (/designated employer|employeur designe|employeur désigné/.test(haystack))
    addUnique(result, "الحصول على عرض عمل من مشغّل معتمد");
  if (/job offer|offre d.emploi/.test(haystack))
    addUnique(result, "الحصول على عرض عمل مستوف للشروط");
  if (/diplom|education|etude|étude|formation/.test(haystack))
    addUnique(result, "مؤهل دراسي أو تكوين مناسب حسب العرض");
  if (!result.length) addUnique(result, "مراجعة الشروط التفصيلية المنشورة في المصدر الرسمي");
  return result.slice(0, 4);
}

function arabicDocuments(values: string[]) {
  const result: string[] = [];
  values.forEach((value) => {
    const document = folded(value);
    if (/cv|curriculum/.test(document)) addUnique(result, "سيرة ذاتية مكيّفة مع العرض");
    else if (/cover letter|lettre|motivation/.test(document))
      addUnique(result, "رسالة تحفيزية مخصصة");
    else if (/langue|language|francais|français/.test(document))
      addUnique(result, "إثبات المستوى اللغوي المطلوب");
    else if (/diplom|certificat|formation/.test(document))
      addUnique(result, "الشهادات والمؤهلات المهنية");
    else if (/experience|travail/.test(document)) addUnique(result, "شهادات الخبرة والعمل");
    else if (/offre d.emploi|job offer/.test(document))
      addUnique(result, "عرض العمل عند طلبه في المسار");
  });
  return result.slice(0, 4);
}

function opportunityScope(values: string[]) {
  const joined = folded(values.join(" "));
  if (!joined) return null;
  if (
    /soins.*sante|aide.infirmier|enseignant|educateur|charpentier|briqueteur|mecanicien/.test(
      joined,
    )
  ) {
    return {
      label: "💼 الاختصاصات المطلوبة",
      value:
        "الصحة والرعاية، التعليم والطفولة المبكرة، البناء والنجارة، والميكانيك والمعدات الثقيلة",
    };
  }
  if (/team/.test(joined)) return { label: "🤝 نوع المشاركة", value: "تطوّع ضمن فريق" };
  if (/individual/.test(joined)) return { label: "🤝 نوع المشاركة", value: "تطوّع فردي" };
  if (/batiment|construction/.test(joined))
    return { label: "💼 المجال أو الاختصاص", value: "مهن البناء والأشغال" };
  if (/child|enfant|education/.test(joined))
    return { label: "💼 المجال أو الاختصاص", value: "الطفولة المبكرة والعمل التربوي" };
  if (/mecan|mechan/.test(joined))
    return { label: "💼 المجال أو الاختصاص", value: "الميكانيك والصيانة الصناعية" };
  if (/health|sante|santé/.test(joined))
    return { label: "💼 المجال أو الاختصاص", value: "الصحة والرعاية" };
  return null;
}

function linesWith(prefix: string, values: string[]) {
  return values.map((value) => `${prefix} ${value}`).join("\n");
}

function registrationServices(proof: PublicationEvidence) {
  const searchable = folded(`${proof.title} ${proof.destination} ${proof.description}`);
  if (/italie|italy|flussi/.test(searchable)) {
    return [
      "توجيه نحو المسار الإيطالي الرسمي المتاح",
      "ترتيب الوثائق المطلوبة لملف الترشح",
      "سيرة ذاتية ورسالة تحفيزية مكيّفتان مع العرض",
      "مراجعة بيانات الملف قبل الإرسال",
    ];
  }
  return [
    "مرافقة في استعمال الاستمارة الرسمية المنشورة",
    "إعداد سيرة ذاتية مكيّفة مع العرض",
    "إعداد رسالة تحفيزية حسب الاختصاص",
    "ترتيب ملف الترشح قبل الإرسال",
  ];
}

function serviceCampaign(proof: PublicationEvidence, index: number) {
  const searchable = folded(`${proof.id} ${proof.title} ${proof.destination} ${proof.description}`);
  if (/flussi|italie|italy/.test(searchable)) {
    return {
      headline: [
        "التحضير للمسار الإيطالي الرسمي يبدأ بالتثبت",
        "لا تخلط بين المسار الإيطالي والعروض غير الموثقة",
        "ملفك الإيطالي يحتاج إجراءات واضحة قبل الإرسال",
      ][index % 3],
      label: "🧾 خدمات التحضير للمسار الإيطالي",
      items: [
        "تثبيت الفئة والقطاع قبل إدخال الطلب",
        "ترتيب معطيات الملف حسب الإجراء الرسمي",
        "إعداد سيرة ذاتية ورسالة تحفيزية مكيّفتين",
        "مراجعة الملف قبل الإرسال من المنصة الرسمية",
      ],
    };
  }
  if (/destination canada/.test(searchable)) {
    return {
      headline: [
        "حضّر ملفك قبل فتح التسجيلات الكندية",
        "منتدى كندا يبدأ بملف مهني مكيّف",
        "التسجيل الكندي القادم يحتاج وثائق مرتبة",
      ][index % 3],
      label: "🧾 خدمات التحضير لمنتدى كندا",
      items: [
        "سيرة ذاتية كندية حديثة حسب المهنة",
        "ترتيب الخبرة والشهادات بطريقة واضحة",
        "رسالة تحفيزية مكيّفة مع المجال",
        "مراجعة ملفك قبل فتح التسجيلات الرسمية",
      ],
    };
  }
  if (/atct|cooperation technique/.test(searchable)) {
    return {
      headline: [
        "عروض كندا عبر الجهة التونسية الرسمية",
        "اقرأ شروط العرض الكندي قبل تعبئة الاستمارة",
        "ملفك المكيّف يقوّي ترشحك للعروض المنشورة",
      ][index % 3],
      label: "🧾 خدمات الترشح للعروض المنشورة",
      items: [
        "قراءة شروط العرض قبل تعبئة الاستمارة",
        "سيرة ذاتية مكيّفة مع الاختصاص المطلوب",
        "رسالة تحفيزية توضّح الخبرة المهنية",
        "ترتيب الملف قبل الإرسال عبر الرابط الرسمي",
      ],
    };
  }
  if (/canada|canad/.test(searchable)) {
    return {
      headline: [
        "التقديم الكندي يبدأ من مهنة مطابقة لخبرتك",
        "ابحث عن العرض الكندي حسب اختصاصك وخبرتك",
        "السيرة الكندية الحديثة جزء أساسي من الترشح",
      ][index % 3],
      label: "🧾 خدمات الملف الكندي",
      items: [
        "تحديد رمز التصنيف المهني الكندي المناسب",
        "البحث في عروض ملائمة للاختصاص والخبرة",
        "سيرة ذاتية كندية بالصيغة الحديثة المطلوبة",
        "رسالة تحفيزية مخصّصة لكل عرض",
      ],
    };
  }
  if (/europe|eures|allemagne|germany/.test(searchable)) {
    return {
      headline: [
        "فرص أوروبا تحتاج ملفا حديثا ومكيّفا",
        "لكل فرصة أوروبية شروط وملف مختلف",
        "تثبّت من العرض الأوروبي قبل إرسال وثائقك",
      ][index % 3],
      label: "🧾 خدمات الترشح للفرص الأوروبية",
      items: [
        "سيرة ذاتية أوروبية واضحة ومحدّثة",
        "رسالة تحفيزية حسب البلد والاختصاص",
        "مراجعة شروط الإقامة والعمل في العرض",
        "تنظيم وثائق الترشح قبل الإرسال",
      ],
    };
  }
  const alternatives = [
    "ملفك الحديث يفتح لك فرصا أكثر",
    "التقديم المنظم يبدأ من عرض موثوق",
    "كل مهنة تستحق ملف ترشح مكيّفا",
  ];
  return {
    headline: alternatives[index % alternatives.length],
    label: "🧾 خدمات إعداد ملف الترشح",
    items: registrationServices(proof),
  };
}

function opportunityServiceLines(proof: PublicationEvidence, index: number) {
  const campaign = serviceCampaign(proof, index);
  const searchable = folded(`${proof.id} ${proof.title} ${proof.destination} ${proof.description}`);
  if (/atct|cooperation technique/.test(searchable)) {
    return [
      "مرافقة في تعبئة استمارة العرض المنشور",
      "إعداد سيرة ذاتية كندية حسب المهنة المطلوبة",
      "رسالة تحفيزية توضّح الخبرة والاختصاص",
      "ترتيب الملف ومراجعته قبل الإرسال الرسمي",
    ];
  }
  if (/destination canada/.test(searchable)) {
    return [
      "تحضير الملف الكامل قبل فتح التسجيلات",
      "إعداد السيرة الذاتية الكندية الحديثة",
      "تنظيم الخبرة والشهادات وإثباتات اللغة",
      "مراجعة استمارة الترشح عند توفرها رسميا",
    ];
  }
  if (/flussi|italie|italy/.test(searchable)) {
    return [
      "تثبيت المسار الإيطالي والفئة المناسبة",
      "تنظيم معطيات الملف حسب الإجراء الرسمي",
      "سيرة ذاتية ورسالة تحفيزية مكيّفتان",
      "مراجعة الوثائق قبل الإرسال عبر المنصة الرسمية",
    ];
  }
  if (/europe|eures|allemagne|germany/.test(searchable)) {
    return [
      "تحديد العرض الأوروبي المناسب للاختصاص",
      "إعداد سيرة ذاتية أوروبية حديثة",
      "رسالة تحفيزية حسب البلد والوظيفة",
      "مراجعة شروط العمل والإقامة قبل الترشح",
    ];
  }
  return campaign.items;
}

function diverseEvidence(evidence: PublicationEvidence[], count: number) {
  const buckets = new Map<string, PublicationEvidence[]>();
  evidence.forEach((item) => {
    const key = `${folded(item.destination)}:${folded(item.source)}`;
    const bucket = buckets.get(key) || [];
    bucket.push(item);
    buckets.set(key, bucket);
  });
  const result: PublicationEvidence[] = [];
  const cursors = new Map<string, number>();
  while (result.length < count) {
    let added = false;
    for (const [key, bucket] of buckets) {
      const cursor = cursors.get(key) || 0;
      if (cursor >= bucket.length) continue;
      result.push(bucket[cursor]);
      cursors.set(key, cursor + 1);
      added = true;
      if (result.length === count) break;
    }
    if (!added) break;
  }
  return result.length ? result : evidence.slice(0, count);
}

const LOCAL_HEADLINES: Record<PublicationPageId, string[]> = {
  "cv-pro-algeria": [
    "فرصة موثوقة للجزائريين وخطوات التقديم واضحة",
    "ما تفوّتش آخر أجل بسبب ملف ناقص",
    "حضّر ترشحك على أساس الشروط الرسمية",
    "قبل ما تبعث ملفك تأكد من كل التفاصيل",
    "فرصة رسمية تستاهل ملف منظم ومخصص",
    "التفاصيل الرسمية هي البداية الصحيحة لترشحك",
    "خلي خبرتك تظهر بوضوح في ملف الترشح",
    "فرصة دولية تتطلب ملفا مخصصا وليس نسخة عامة",
    "التقديم من المصدر الرسمي يحميك من المعلومات الخاطئة",
    "رتب ملفك اليوم وخلي قرارك مبني على معلومات موثوقة",
  ],
  "emplois-immigration-tunis": [
    "فرصة دولية للتونسيين وشروط الترشح واضحة",
    "ثبّت آخر أجل قبل ما تبعث مطلبك",
    "الترشح الصحيح يبدأ من البلاغ الرسمي",
    "حضّر ملفك حسب العرض موش بطريقة عامة",
    "عرض جديد يلزمو وثائق مرتبة ومعلومات صحيحة",
    "معلومة موثوقة وفرصة تستحق ملف ترشح مضبوط",
    "كي تكون الشروط واضحة الترشح يولي أسهل",
    "خطوات بسيطة تنجم تقربك من فرصة دولية",
    "ما تراهنش على إشاعة وخذ المعلومة من مصدرها",
    "ملفك هو أول فرصة باش تبرز خبرتك بطريقة صحيحة",
  ],
  "bissane-career": [
    "فرصتك تنجم تبدأ بملف مرتب ومعلومة صحيحة",
    "ما تخليش آخر أجل يفوتك بسبب ملف ناقص",
    "سيرة ذاتية قوية ومصدر رسمي وخطوات واضحة",
    "قبل الترشح تأكد إن العرض يناسب بروفايلك",
    "خطوة صغيرة اليوم تنجم تقربك لفرصة أحسن",
    "المعلومة الصحيحة والملف المرتب يصنعوا الفرق",
    "كل فرصة عندها شروطها وملفك لازم يحكي عليها",
    "وقت الترشح المنظم هو الوقت المناسب باش تبرز",
    "عرض موثوق وخطوة عملية نحو مسارك المهني",
    "خلّي ملفك جاهز قبل ما يوصل آخر أجل",
  ],
};

const PAGE_HASHTAGS: Record<PublicationPageId, string> = {
  "cv-pro-algeria": "#فرص_للجزائريين #فرص_موثوقة #سيرة_ذاتية #رسالة_تحفيزية #تقديم_وظائف",
  "emplois-immigration-tunis": "#انتداب_دولي #فرص_للتونسيين #خدمة_بالخارج #ملف_ترشح #عروض_موثوقة",
  "bissane-career": "#فرصتك_تبدأ_من_هنا #مسارك_المهني #تونس #ترشح_ناجح #معلومة_موثوقة",
};

function localBody(
  page: PublicationPage,
  proof: PublicationEvidence,
  objective: PublicationDraft["objective"],
  index: number,
) {
  const title = arabicOpportunityTitle(proof.title);
  const destination = arabicDestination(proof.destination);
  const flag = destinationFlag(proof.destination);
  const source = arabicSource(proof.source);
  const scope = opportunityScope(proof.positions);
  const conditions = arabicConditions(proof);
  const documents = arabicDocuments(proof.requiredDocuments);
  const deadline = localDeadline(proof.deadlineAt, page.market);
  const campaign = serviceCampaign(proof, index);
  const services = opportunityServiceLines(proof, index);

  if (page.id === "cv-pro-algeria") {
    const opening =
      objective === "deadline"
        ? "⏰ الوقت مهم والملف الكامل يصنع الفرق"
        : "📢 فرصة منشورة من مصدر رسمي";
    return [
      `${flag} ${opening}`,
      `📌 الفرصة المتاحة\n${title}`,
      `📍 الوجهة\n${destination}`,
      `🏛️ الجهة الرسمية\n${source}`,
      `⏳ آخر أجل للتقديم\n${deadline}`,
      `✅ الشروط الأساسية\n${linesWith("✅", conditions)}`,
      documents.length ? `📄 الوثائق المطلوبة\n${linesWith("▪️", documents)}` : "",
      scope ? `${scope.label}\n${scope.value}` : "",
      [
        "🧭 خطوات التقديم",
        "1️⃣ قارن الشروط مع خبرتك ومؤهلاتك",
        "2️⃣ حضّر سيرة ذاتية ورسالة تحفيزية مخصصتين",
        "3️⃣ قدّم عبر الرابط الرسمي الموجود أسفل المنشور",
      ].join("\n"),
      `${campaign.label}\n${linesWith("🟩", services)}`,
      "⚠️ الخدمة ما تعنيش ضمان التوظيف أو التأشيرة والقرار يرجع للجهة الرسمية",
      PAGE_HASHTAGS[page.id],
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (page.id === "emplois-immigration-tunis") {
    return [
      proof.deadlineAt
        ? `⏳ آخر أجل للتسجيل هو ${deadline}`
        : `${flag} 📢 فرصة دولية موجهة للتونسيين`,
      proof.deadlineAt ? "📣 الحاضر يعلم الغائب" : "",
      proof.deadlineAt ? "⚠️ سارعوا في التقديم قبل غلق التسجيلات الرسمية" : "",
      `${flag} 📢 ${campaign.headline}`,
      `🔹 شنوّة الفرصة\n${title}`,
      [
        "📋 المعطيات الأساسية",
        `▪️ الوجهة: ${destination}`,
        scope ? `▪️ ${scope.label.replace(/^..\s/, "")}: ${scope.value}` : "",
        `▪️ الجهة الناشرة: ${source}`,
        `▪️ آخر أجل: ${deadline}`,
      ].join("\n"),
      `✅ شنوّة يلزمك\n${linesWith("✅", conditions)}`,
      documents.length ? `📑 حضّر الوثائق هاذي\n${linesWith("▪️", documents)}` : "",
      `🟩 خدماتنا لهذه الفرصة\n${linesWith("✅", services)}`,
      [
        "📝 كيفاش تترشح",
        "1️⃣ اقرأ البلاغ الرسمي للآخر",
        "2️⃣ كيّف سيرتك الذاتية ورسالة التحفيز مع العرض",
        "3️⃣ ابعث الترشح من الرابط الرسمي فقط",
      ].join("\n"),
      "🤝 ننجمو نعاونوك في إعداد ملف ترشح واضح ومنظم",
      "⚠️ ما فماش ضمان تشغيل أو تأشيرة والقرار النهائي للجهة المنتدبة",
      PAGE_HASHTAGS[page.id],
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return [
    "🌟 فرصتك الجاية تبدأ بمعلومة صحيحة وملف يحكي على قيمتك",
    `${flag} ${title}\n📍 ${destination}`,
    [
      "💡 علاش الفرصة تستحق الاهتمام",
      `▪️ منشورة عن طريق ${source}`,
      scope ? `▪️ ${scope.label.replace(/^..\s/, "")}: ${scope.value}` : "",
      `▪️ آخر أجل هو ${deadline}`,
    ]
      .filter(Boolean)
      .join("\n"),
    `🎯 شكون ينجم يترشح\n${linesWith("✅", conditions)}`,
    documents.length ? `🧰 حضّر ملفك\n${linesWith("✨", documents)}` : "",
    [
      "🚀 خطوتك توا",
      "1️⃣ تأكد إن الشروط تناسب خبرتك ومؤهلاتك",
      "2️⃣ حضّر ترشح مخصص يبرز نقاط قوتك",
      "3️⃣ استعمل الرابط الرسمي الموجود مع المنشور",
    ].join("\n"),
    `🟩 كيف نرافقوك في هالفرصة\n${linesWith("✅", services)}`,
    "🛡️ نرافقوك باحتراف أما القبول والتأشيرة يبقاو من صلاحيات الجهات الرسمية",
    PAGE_HASHTAGS[page.id],
  ]
    .filter(Boolean)
    .join("\n\n");
}

function localComments(page: PublicationPage, proof: PublicationEvidence) {
  const source = arabicSource(proof.source);
  const documents = arabicDocuments(proof.requiredDocuments).join("، ");
  const deadline = localDeadline(proof.deadlineAt, page.market);
  if (page.id === "cv-pro-algeria") {
    return [
      `🔗 المصدر الرسمي هو ${source} والرابط تلقاه مع المنشور`,
      `⏳ آخر أجل المعلن: ${deadline}`,
      documents ? `📄 حضّر من الآن: ${documents}` : "📄 راجع الوثائق المطلوبة في الاستمارة الرسمية",
      "⚠️ ما تبعث حتى وثيقة حساسة خارج القنوات الرسمية",
      "💬 قولولنا المجال اللي حابين نركزو عليه في المنشورات الجاية",
    ].map(withoutParentheses);
  }
  if (page.id === "emplois-immigration-tunis") {
    return [
      `📌 البلاغ صادر عن ${source}`,
      `⏰ آخر أجل المعلن: ${deadline}`,
      documents ? `📑 الوثائق الأساسية: ${documents}` : "📑 راجع الوثائق المطلوبة في البلاغ الرسمي",
      "🔐 قدّم كان عبر الرابط الرسمي وما تدفع حتى معلوم لجهة مجهولة",
      "🗨️ شنوة الاختصاص اللي تحبوا نبحثولكم على فرص فيه",
    ].map(withoutParentheses);
  }
  return [
    `✅ المعلومة متثبت منها عبر ${source}`,
    `🕰️ تاريخ غلق الترشحات: ${deadline}`,
    documents
      ? `✨ باش تبدأ حضّر: ${documents}`
      : "✨ باش تبدأ راجع الوثائق المطلوبة في المصدر الرسمي",
    "💡 الملف المخصص للعرض أقوى من نفس السيرة الذاتية لكل الفرص",
    "🤍 ابعث المنشور لشخص تنجم تهمو الفرصة",
  ].map(withoutParentheses);
}

export function buildLocalPublicationBatch(options: {
  page: PublicationPage;
  evidence: PublicationEvidence[];
  focus?: string;
  generatedAt?: string;
}): PublicationBatch {
  if (!options.evidence.length)
    throw new Error("Aucune opportunité vérifiée n’est disponible pour la génération locale.");
  const generatedAt = options.generatedAt || new Date().toISOString();
  const ranked = focusedEvidence(options.evidence, options.focus || "");
  // A calendar must never be ten cosmetic rewrites of the same notice. Round-robin by
  // destination and publisher first, then only repeat evidence when the source set is small.
  const selectedEvidence = diverseEvidence(ranked, 10);
  const objectives: PublicationDraft["objective"][] = [
    "information",
    "deadline",
    "service",
    "engagement",
    "information",
    "deadline",
    "service",
    "engagement",
    "information",
    "deadline",
  ];
  const posts = Array.from({ length: 10 }, (_, index): PublicationDraft => {
    const proof = selectedEvidence[index % selectedEvidence.length];
    const format: PublicationFormat = "visual";
    const title = arabicOpportunityTitle(proof.title);
    const destination = arabicDestination(proof.destination);
    return {
      id: `${options.page.id}-${generatedAt}-local-${index}`,
      pageId: options.page.id,
      createdAt: generatedAt,
      format,
      objective: objectives[index],
      headline:
        options.page.id === "emplois-immigration-tunis"
          ? serviceCampaign(proof, index).headline
          : options.page.id === "bissane-career"
            ? `خطوتك العملية تبدأ بملف مرتب — ${serviceCampaign(proof, index).headline}`
            : LOCAL_HEADLINES[options.page.id][index],
      body: localBody(options.page, proof, objectives[index], index),
      comments: localComments(options.page, proof),
      highlightedTerms: ["السيرة الذاتية", "رسالة تحفيزية", "آخر أجل", "التقديم"],
      evidenceId: proof.id,
      sourceLabel: proof.source,
      sourceUrl: proof.sourceUrl,
      applicationUrl: proof.applicationUrl,
      deadlineAt: proof.deadlineAt,
      checkedAt: proof.checkedAt,
      visual:
        format === "visual"
          ? {
              eyebrow:
                options.page.id === "cv-pro-algeria"
                  ? "فرصة موثوقة للجزائريين"
                  : options.page.id === "emplois-immigration-tunis"
                    ? "انتداب دولي للتونسيين"
                    : "خطوتك المهنية الجاية",
              title,
              subtitle:
                `${destinationFlag(proof.destination)} الوجهة: ${destination} · آخر أجل: ${localDeadline(proof.deadlineAt, options.page.market)}`.slice(
                  0,
                  140,
                ),
              cta:
                options.page.id === "cv-pro-algeria"
                  ? "راجع المصدر وقدّم"
                  : options.page.id === "emplois-immigration-tunis"
                    ? "ثبّت الشروط وترشّح"
                    : "حضّر خطوتك بثقة",
              badges: ["سيرة ذاتية", "آخر أجل", "رابط رسمي"],
            }
          : null,
    };
  });
  return {
    version: 6,
    pageId: options.page.id,
    generatedAt,
    evidenceCheckedAt: generatedAt,
    posts,
  };
}

/**
 * This prompt deliberately asks for a text-free editorial photograph. The Arabic copy,
 * source and call-to-action stay in the ZGR layout, where they remain editable and legible.
 */
export function publicationImagePrompt(post: PublicationDraft, page: PublicationPage) {
  const market = page.market === "DZ" ? "algérien" : "tunisien";
  const subject = post.visual?.title || post.headline;
  const destination = post.visual?.subtitle || "opportunité internationale vérifiée";
  return [
    `GPT Image : crée une affiche Facebook professionnelle originale pour la page ${page.name}.`,
    `Sujet vérifié : ${subject}.`,
    `Contexte vérifié : ${destination}. Public ciblé : candidats ${market}s adultes.`,
    "Format horizontal 4:3, 1600 × 1200 px, haute définition et parfaitement lisible sur mobile.",
    "Direction artistique : palette rouge, blanc et jaune, design publicitaire sobre, grille RTL claire, grand espace central pour informations numérotées, photographie réaliste placée latéralement et occupant au maximum 30 % de l’affiche.",
    "Utiliser uniquement les drapeaux de la Tunisie et de la destination réellement citée. Ne pas inventer de logos, de partenariats, de quotas, de délais ni de document officiel.",
    "Inscrire seulement ces éléments factuels en arabe RTL net : le titre, le statut ou la date limite ci-dessous, et une courte bannière d’action. Conserver exactement les noms officiels si nécessaire.",
    `Contenu autorisé de l’affiche : ${post.visual?.title || post.headline} — ${post.deadlineAt ? `آخر أجل: ${localDeadline(post.deadlineAt, page.market)}` : "التاريخ غير منشور رسميا"}.`,
    "Bannière : فرصة لا تعوض — سارعوا في التحضير والتسجيل.",
    "Aucune promesse de visa, de recrutement ou de résultat. Pas de filigrane, pas de faux texte illisible, pas de collage excessif ni illustration 3D.",
  ].join("\n");
}

export async function generatePublicationBatch(options: {
  page: PublicationPage;
  evidence: PublicationEvidence[];
  settings: AiSettings;
  focus: string;
  signal?: AbortSignal;
}) {
  try {
    const { runAiJson } = await import("./ai-client");
    const result = await runAiJson<unknown>(
      options.settings,
      PUBLICATION_SYSTEM_PROMPT,
      publicationPrompt(options.page, options.evidence, options.focus),
      { signal: options.signal, maxTotalMs: 150_000 },
    );
    return {
      batch: normalizePublicationBatch(result.data, options.page, options.evidence),
      nextSettings: result.nextSettings,
      model: result.model,
      connectionLabel: result.connectionLabel,
      fallbackUsed: false,
      providerError: "",
    };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return {
      batch: buildLocalPublicationBatch({
        page: options.page,
        evidence: options.evidence,
        focus: options.focus,
      }),
      nextSettings: options.settings,
      model: "ZGR Local Editorial v1",
      connectionLabel: "moteur éditorial local sécurisé",
      fallbackUsed: true,
      providerError: error instanceof Error ? error.message : "Fournisseurs IA indisponibles",
    };
  }
}
