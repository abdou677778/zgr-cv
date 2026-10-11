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
  version: 1;
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

const BASELINE_CHECKED_AT = "2026-10-06T12:00:00.000Z";

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
Le service CV PRO TEAM peut être proposé comme aide à la rédaction de CV, Cover Letter et candidature, jamais comme intermédiaire officiel ni comme garantie.
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
Rédige exactement 5 publications différentes et directement copiables sur Facebook.
- Utilise l'arabe dialectal du marché avec un style administratif correct et lisible.
- Garde les termes professionnels utiles en anglais, par exemple Job Offer, Deadline, CV, Cover Letter, ATS, Apply.
- N'utilise aucune parenthèse ronde dans headline, body, comments ou visual.
- Alterne les formats : 2 publications short sans visuel et 3 publications visual.
- Chaque publication doit s'appuyer sur une seule preuve, citer la source, conserver son lien officiel et son checkedAt.
- Si deadlineAt vaut null, écris que le Deadline n'est pas publié. N'invente aucune date.
- Mentionne les documents et conditions uniquement s'ils existent dans la preuve.
- Termine par une action claire : consulter la source, préparer le dossier ou demander le service CV.
- Propose exactement 5 commentaires courts et utiles par publication. Ils doivent compléter la publication : source, documents, vigilance, service ou question d'engagement.
- Le texte doit rester naturel et ne doit pas ressembler à cinq copies du même modèle.
${focus.trim() ? `- Priorité éditoriale demandée : ${focus.trim()}` : ""}

STRUCTURE JSON ATTENDUE
{
  "posts": [
    {
      "format": "short ou visual",
      "objective": "information ou deadline ou service ou engagement",
      "headline": "texte",
      "body": "texte",
      "comments": ["1", "2", "3", "4", "5"],
      "highlightedTerms": ["Deadline", "CV"],
      "evidenceId": "identifiant exact d'une preuve",
      "visual": null ou {
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
    const format: PublicationFormat = candidate.format === "short" ? "short" : "visual";
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
        headline: clean(String(candidate.headline || proof.title)),
        body: clean(String(candidate.body || "")),
        comments: normalizeStringArray(candidate.comments, 5),
        highlightedTerms: normalizeStringArray(candidate.highlightedTerms, 8),
        evidenceId: proof.id,
        sourceLabel: proof.source,
        sourceUrl: proof.sourceUrl,
        applicationUrl: proof.applicationUrl,
        deadlineAt: proof.deadlineAt,
        checkedAt: proof.checkedAt,
        visual:
          format === "visual" && visualSource
            ? {
                eyebrow: clean(String(visualSource.eyebrow || page.name)).slice(0, 60),
                title: clean(String(visualSource.title || proof.title)).slice(0, 90),
                subtitle: clean(String(visualSource.subtitle || proof.destination)).slice(0, 140),
                cta: clean(String(visualSource.cta || "شوف التفاصيل")).slice(0, 45),
                badges: normalizeStringArray(visualSource.badges, 3),
              }
            : null,
      },
    ];
  });
  if (posts.length !== 5)
    throw new Error(`L’IA a produit ${posts.length} publication(s) vérifiables au lieu de 5.`);
  if (posts.some((post) => /[()]/.test(`${post.headline}${post.body}${post.comments.join("")}`)))
    throw new Error("Une publication contient des parenthèses interdites. Relancez la génération.");
  return {
    version: 1,
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
  if (!value)
    return market === "DZ"
      ? "الـ Deadline ما هوش منشور، لازم تراجع المصدر الرسمي قبل التقديم."
      : "الـ Deadline موش منشور، يلزمك تراجع المصدر الرسمي قبل التقديم.";
  const date = new Date(value);
  const label = Number.isNaN(date.getTime())
    ? withoutParentheses(value)
    : date.toLocaleDateString(market === "DZ" ? "ar-DZ" : "ar-TN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
  return market === "DZ"
    ? `الـ Deadline المنشور هو ${label}، راجعه مرة أخرى في المصدر الرسمي.`
    : `الـ Deadline المنشور هو ${label}، ثبّت التاريخ مرة أخرى من المصدر الرسمي.`;
}

function listLabel(values: string[], maximum = 3) {
  return values.map(withoutParentheses).filter(Boolean).slice(0, maximum).join("، ");
}

const LOCAL_HEADLINES: Record<PublicationPageId, string[]> = {
  "cv-pro-algeria": [
    "فرصة موثوقة وخطوات واضحة قبل إرسال الـ CV",
    "الـ Deadline ما يتخمنش، راجع المصدر الرسمي",
    "ملفك لازم يكون مهيأ للعرض الحقيقي",
    "قبل Apply تأكد من الشروط والوثائق",
    "فرصة رسمية تستاهل تحضير منظم",
  ],
  "emplois-immigration-tunis": [
    "فرصة دولية موثوقة وخطوات الترشح واضحة",
    "قبل ما تبعث الـ CV راجع الشروط والـ Deadline",
    "الترشح الصحيح يبدأ من المصدر الرسمي",
    "حضّر ملفك حسب العرض موش بطريقة عامة",
    "عرض جديد يلزمو ملف مرتب ومعلومات صحيحة",
  ],
  "bissane-career": [
    "فرصتك تنجم تبدأ بملف مرتب ومعلومة صحيحة",
    "ما تخليش الـ Deadline يفوتك بسبب ملف ناقص",
    "CV قوي ومصدر رسمي وخطوات واضحة",
    "قبل الترشح تأكد إن العرض يناسب بروفايلك",
    "خطوة صغيرة اليوم تنجم تقربك لفرصة أحسن",
  ],
};

function localBody(
  page: PublicationPage,
  proof: PublicationEvidence,
  objective: PublicationDraft["objective"],
) {
  const title = withoutParentheses(proof.title);
  const destination = withoutParentheses(proof.destination);
  const source = withoutParentheses(proof.source);
  const positions = listLabel(proof.positions);
  const conditions = listLabel(proof.conditions);
  const documents = listLabel(proof.requiredDocuments);
  const deadline = localDeadline(proof.deadlineAt, page.market);

  if (page.market === "DZ") {
    const opening =
      objective === "service"
        ? "كثير من المترشحين يلقاو الفرصة المناسبة بصح يبعثو نفس الملف لكل عرض. الحل هو ملف مخصص ومعلومة مؤكدة."
        : objective === "deadline"
          ? "المشكل ماشي غير تلقى الفرصة، لازم تعرف الوقت والشروط قبل ما تبعث ملفك."
          : "كاينة معلومة مهنية موثوقة تستاهل تراجعها إذا راك تحوس على فرصة منظمة.";
    return [
      opening,
      `الفرصة هي ${title} نحو ${destination}. المصدر الرسمي هو ${source}.`,
      positions
        ? `المناصب أو المجالات المذكورة: ${positions}.`
        : "المهنة المقبولة تتحدد حسب العرض الرسمي والملف.",
      conditions
        ? `أهم الشروط المنشورة: ${conditions}.`
        : "الشروط التفصيلية لازم تتراجع مباشرة في المصدر.",
      deadline,
      documents ? `الوثائق المذكورة: ${documents}.` : "حضّر CV والوثائق اللي يطلبها الإعلان فقط.",
      "راجع الرابط الرسمي، قارن الشروط مع بروفايلك، ومن بعد حضّر CV و Cover Letter مخصصين قبل Apply.",
      "CV PRO TEAM يقدر يساعدك في إعداد الملف والتقديم، بدون أي وعد بالتوظيف أو الفيزا.",
    ].join("\n\n");
  }

  const opening =
    page.id === "bissane-career"
      ? "برشة فرص تتفلت خاطر المعلومة توصل ناقصة ولا الملف يكون عام. البداية الصحيحة هي مصدر رسمي وملف يخدم هدف واضح."
      : objective === "deadline"
        ? "قبل ما تبعث مطلبك، أهم خطوة هي تثبّت الـ Deadline والشروط من المصدر الرسمي."
        : "فمّا فرصة مهنية موثوقة تنجم تهم الناس اللي تحب تحضّر ترشح منظم.";
  return [
    opening,
    `الفرصة هي ${title} نحو ${destination}. المصدر الرسمي هو ${source}.`,
    positions
      ? `الاختصاصات أو المجالات المذكورة: ${positions}.`
      : "الاختصاص المقبول يتحدد حسب العرض الرسمي والبروفايل.",
    conditions
      ? `أهم الشروط المنشورة: ${conditions}.`
      : "الشروط التفصيلية يلزم تتراجع مباشرة في المصدر.",
    deadline,
    documents ? `الوثائق المذكورة: ${documents}.` : "حضّر CV والوثائق المطلوبة في الإعلان فقط.",
    "افتح الرابط الرسمي، قارن الشروط ببروفايلك، وبعد حضّر CV و Cover Letter مخصصين قبل Apply.",
    "فريقنا ينجم يعاونك في إعداد الملف والتقديم، من غير وعود بالتشغيل أو الفيزا.",
  ].join("\n\n");
}

function localComments(page: PublicationPage, proof: PublicationEvidence) {
  const source = withoutParentheses(proof.source);
  const documents = listLabel(proof.requiredDocuments);
  const deadline = localDeadline(proof.deadlineAt, page.market);
  if (page.market === "DZ") {
    return [
      `المصدر الرسمي هو ${source} والرابط موجود مع المنشور.`,
      deadline,
      documents
        ? `قبل Apply حضّر هاذ الوثائق: ${documents}.`
        : "قبل Apply راجع قائمة الوثائق في الإعلان الرسمي.",
      "خدمة CV PRO TEAM تخص إعداد CV و Cover Letter والمساعدة في التقديم فقط، وماشي ضمان توظيف.",
      "قولولنا في التعليقات شنو هو المجال اللي حابين نركزو عليه في المنشورات الجاية.",
    ].map(withoutParentheses);
  }
  return [
    `المصدر الرسمي هو ${source} والرابط موجود مع المنشور.`,
    deadline,
    documents
      ? `قبل Apply حضّر الوثائق هاذي: ${documents}.`
      : "قبل Apply ثبّت قائمة الوثائق في الإعلان الرسمي.",
    "خدمتنا تخص إعداد CV و Cover Letter والمساعدة في التقديم فقط، وما هيش ضمان تشغيل.",
    "اكتبولنا في التعليقات شنوّة الاختصاص اللي تحبوا نركزوا عليه في المنشورات الجاية.",
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
  const objectives: PublicationDraft["objective"][] = [
    "information",
    "deadline",
    "service",
    "engagement",
    "information",
  ];
  const posts = Array.from({ length: 5 }, (_, index): PublicationDraft => {
    const proof = ranked[index % ranked.length];
    const format: PublicationFormat = index < 2 ? "short" : "visual";
    const title = withoutParentheses(proof.title);
    const destination = withoutParentheses(proof.destination);
    return {
      id: `${options.page.id}-${generatedAt}-local-${index}`,
      pageId: options.page.id,
      createdAt: generatedAt,
      format,
      objective: objectives[index],
      headline: LOCAL_HEADLINES[options.page.id][index],
      body: localBody(options.page, proof, objectives[index]),
      comments: localComments(options.page, proof),
      highlightedTerms: ["CV", "Cover Letter", "Deadline", "Apply"],
      evidenceId: proof.id,
      sourceLabel: proof.source,
      sourceUrl: proof.sourceUrl,
      applicationUrl: proof.applicationUrl,
      deadlineAt: proof.deadlineAt,
      checkedAt: proof.checkedAt,
      visual:
        format === "visual"
          ? {
              eyebrow: options.page.market === "DZ" ? "فرصة موثوقة" : "فرصة متثبت منها",
              title: LOCAL_HEADLINES[options.page.id][index],
              subtitle: `${title} · ${destination}`.slice(0, 140),
              cta: options.page.market === "DZ" ? "راجع المصدر الرسمي" : "ثبّت من المصدر الرسمي",
              badges: ["CV", "Deadline", "Apply"],
            }
          : null,
    };
  });
  return {
    version: 1,
    pageId: options.page.id,
    generatedAt,
    evidenceCheckedAt: generatedAt,
    posts,
  };
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
