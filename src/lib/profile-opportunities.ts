import type { CV } from "./cv-types";

export type CandidateCountry = "DZ" | "TN";
export type OpportunityKind = "job" | "volunteer" | "program";
export type MatchStatus = "strong" | "partial" | "verify";

export type OpportunityMatch = {
  id: string;
  kind: OpportunityKind;
  source: string;
  title: string;
  employer: string;
  countryCode: string;
  countryName: string;
  location: string;
  description: string;
  deadlineAt: string | null;
  conditions: string[];
  requiredDocuments: string[];
  application: {
    type: string;
    label: string;
    url: string;
    email?: string | null;
    loginRequired: boolean;
  };
  sourceUrl: string;
  checkedAt: string;
  score: number;
  status: MatchStatus;
  reasons: string[];
  gaps: string[];
};

export type OpportunityPlan = {
  version: 1;
  generatedAt: string;
  candidateCountry: CandidateCountry;
  targetJob: string;
  noc?: { code: string; title: string; teer: string };
  selectedOpportunities: OpportunityMatch[];
};

export type ProfileOpportunitySearch = {
  matches: OpportunityMatch[];
  warnings: string[];
  searchedAt: string;
};

const OFFICIAL_PROGRAMS: Array<Omit<OpportunityMatch, "score" | "status" | "reasons" | "gaps">> = [
  {
    id: "program:canada-francophone-mobility",
    kind: "program",
    source: "Immigration, Réfugiés et Citoyenneté Canada",
    title: "Mobilité francophone - permis de travail hors Québec",
    employer: "Gouvernement du Canada",
    countryCode: "CA",
    countryName: "Canada",
    location: "Canada, hors Québec",
    description:
      "Voie officielle facilitant l’embauche de travailleurs francophones lorsque les conditions du programme et l’offre d’emploi sont satisfaites.",
    deadlineAt: null,
    conditions: [
      "Obtenir une offre d’emploi admissible hors Québec",
      "Respecter les critères linguistiques affichés par IRCC au moment de la demande",
      "L’employeur dépose l’offre dans le Portail des employeurs",
    ],
    requiredDocuments: ["CV canadien", "Offre d’emploi", "Preuve de français"],
    application: {
      type: "official_instructions",
      label: "Vérifier les critères officiels",
      url: "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/travailler-canada/embaucher-etranger-temporaires/travailleurs-francophones-bilingues-exterieur-quebec.html",
      loginRequired: false,
    },
    sourceUrl:
      "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/travailler-canada/embaucher-etranger-temporaires/travailleurs-francophones-bilingues-exterieur-quebec.html",
    checkedAt: new Date().toISOString(),
  },
  {
    id: "program:canada-atlantic-immigration",
    kind: "program",
    source: "Immigration, Réfugiés et Citoyenneté Canada",
    title: "Programme d’immigration au Canada atlantique",
    employer: "Gouvernement du Canada",
    countryCode: "CA",
    countryName: "Canada",
    location: "Provinces atlantiques",
    description:
      "Parcours officiel vers la résidence permanente pour les candidats ayant une offre d’un employeur désigné et remplissant tous les critères.",
    deadlineAt: null,
    conditions: [
      "Offre d’emploi d’un employeur désigné",
      "Expérience, études et langue selon le profil",
      "Plan d’établissement et approbation provinciale",
    ],
    requiredDocuments: ["CV canadien", "Offre d’emploi", "Preuve de langue", "Diplômes"],
    application: {
      type: "official_instructions",
      label: "Consulter le programme officiel",
      url: "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/programme-immigration-atlantique.html",
      loginRequired: false,
    },
    sourceUrl:
      "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/programme-immigration-atlantique.html",
    checkedAt: new Date().toISOString(),
  },
  {
    id: "program:eures-jobs",
    kind: "program",
    source: "EURES - Union européenne",
    title: "Emplois officiels EURES en Europe",
    employer: "Réseau européen des services de l’emploi",
    countryCode: "EU",
    countryName: "Europe",
    location: "Union européenne",
    description:
      "Portail officiel d’offres d’emploi et d’informations sur les conditions de vie et de travail en Europe.",
    deadlineAt: null,
    conditions: [
      "Vérifier sur chaque offre si les candidatures hors UE sont acceptées",
      "Contrôler les exigences de visa ou de permis de travail",
    ],
    requiredDocuments: ["CV Europass ou CV adapté", "Lettre de motivation"],
    application: {
      type: "official_portal",
      label: "Rechercher sur EURES",
      url: "https://eures.europa.eu/jobseekers_fr",
      loginRequired: false,
    },
    sourceUrl: "https://eures.europa.eu/jobseekers_fr",
    checkedAt: new Date().toISOString(),
  },
];

const clean = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();

function destinationCode(value: string) {
  const label = clean(value).toLocaleLowerCase("fr");
  if (/canada|ontario|québec|quebec|alberta|manitoba/.test(label)) return "CA";
  if (/italie|italia|italy/.test(label)) return "IT";
  if (/france/.test(label)) return "FR";
  if (/allemagne|germany|deutschland/.test(label)) return "DE";
  if (/belgique|belgium/.test(label)) return "BE";
  if (/espagne|spain|españa/.test(label)) return "ES";
  if (/portugal/.test(label)) return "PT";
  return "INT";
}

export function safeApplicationUrl(value: string | null | undefined) {
  const url = clean(value);
  if (!url) return "";
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : "";
}

export function inferCandidateCountry(cv: CV): CandidateCountry {
  const haystack = `${cv.pays} ${cv.adresse} ${cv.wilaya}`.toLocaleLowerCase("fr");
  return /tunisie|tunisia|tunis|tn\b/.test(haystack) ? "TN" : "DZ";
}

function tokens(value: string) {
  return clean(value)
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !["avec", "pour", "dans", "des", "les", "the", "and"].includes(token));
}

export function profileSearchQuery(cv: CV) {
  return clean([cv.titre_poste, cv.cnp?.title].filter(Boolean).join(" "));
}

function scored(
  match: Omit<OpportunityMatch, "score" | "status" | "reasons" | "gaps">,
  query: string,
) {
  const queryTokens = [...new Set(tokens(query))];
  const haystack = tokens(
    `${match.title} ${match.employer} ${match.description} ${match.conditions.join(" ")}`,
  );
  const matched = queryTokens.filter((token) =>
    haystack.some((candidate) => candidate.includes(token) || token.includes(candidate)),
  );
  const reasons: string[] = [];
  const gaps: string[] = [];
  let score = queryTokens.length ? Math.round((matched.length / queryTokens.length) * 55) : 20;
  if (matched.length) reasons.push(`Métier correspondant : ${matched.slice(0, 4).join(", ")}`);
  else gaps.push("Correspondance métier à confirmer");
  if (match.application.url || match.application.email) {
    score += 20;
    reasons.push("Candidature directe disponible");
  } else gaps.push("Méthode de candidature à vérifier sur la source");
  if (match.deadlineAt) {
    score += 10;
    reasons.push("Date limite publiée");
  } else gaps.push("Aucune date limite publiée");
  if (match.checkedAt) score += 10;
  if (!match.application.loginRequired) score += 5;
  else gaps.push("Compte ou connexion requis");
  score = Math.max(0, Math.min(100, score));
  return {
    ...match,
    score,
    status: score >= 70 ? "strong" : score >= 45 ? "partial" : "verify",
    reasons,
    gaps,
  } satisfies OpportunityMatch;
}

function activeDeadline(deadlineAt: string | null) {
  if (!deadlineAt) return true;
  const timestamp = Date.parse(deadlineAt);
  return Number.isNaN(timestamp) || timestamp >= Date.now() - 86_400_000;
}

export async function searchProfileOpportunities(options: {
  cv: CV;
  candidateCountry: CandidateCountry;
  signal?: AbortSignal;
}): Promise<ProfileOpportunitySearch> {
  const query = profileSearchQuery(options.cv);
  const tasks: Array<{ source: string; promise: Promise<OpportunityMatch[]> }> = [
    {
      source: "Guichet-Emplois Canada",
      promise: import("./canada-opportunities")
        .then(({ searchCanadaOpportunities }) =>
          searchCanadaOpportunities({
            country: options.candidateCountry,
            period: "recent",
            query,
            limit: 24,
            signal: options.signal,
          }),
        )
        .then((result) =>
          result.opportunities.map((item) =>
            scored(
              {
                id: `jobbank:${item.id}`,
                kind: "job",
                source: "Guichet-Emplois Canada",
                title: clean(item.title),
                employer: clean(item.employer),
                countryCode: "CA",
                countryName: "Canada",
                location: clean(item.location),
                description: clean(item.description),
                deadlineAt: item.deadlineAt,
                conditions: [item.eligibilityEvidence, item.salary, item.employmentType]
                  .map(clean)
                  .filter(Boolean),
                requiredDocuments: ["CV canadien", "Lettre de motivation selon l’offre"],
                application: {
                  type: item.applicationMethod.type,
                  label: clean(item.applicationMethod.label) || "Postuler",
                  url: safeApplicationUrl(
                    item.applicationMethod.url || item.applicationContact.url,
                  ),
                  email: clean(item.applicationContact.email),
                  loginRequired: item.applicationMethod.loginRequired,
                },
                sourceUrl: safeApplicationUrl(item.sourceUrl),
                checkedAt: item.checkedAt,
              },
              query,
            ),
          ),
        ),
    },
    {
      source: "Corps européen de solidarité",
      promise: import("./volunteer-opportunities")
        .then(({ searchVolunteerOpportunities }) =>
          searchVolunteerOpportunities({
            country: options.candidateCountry,
            period: "recent",
            query,
            limit: 18,
            signal: options.signal,
          }),
        )
        .then((result) =>
          result.opportunities
            .filter((item) => item.eligible)
            .map((item) =>
              scored(
                {
                  id: `esc:${item.id}`,
                  kind: "volunteer",
                  source: "Portail européen de la jeunesse",
                  title: clean(item.title),
                  employer: clean(item.organization),
                  countryCode: item.destination.countryCode,
                  countryName: item.destination.countryName,
                  location: clean(
                    [item.destination.town, item.destination.countryName]
                      .filter(Boolean)
                      .join(", "),
                  ),
                  description: clean(item.description),
                  deadlineAt: item.deadlineAt,
                  conditions: [item.ageRequirement.label, item.participantProfile]
                    .map(clean)
                    .filter(Boolean),
                  requiredDocuments: [
                    item.applicationRequirements.cv ? "CV" : "",
                    item.applicationRequirements.motivationStatement ? "Texte de motivation" : "",
                  ].filter(Boolean),
                  application: {
                    type: item.applicationMethod.type,
                    label: clean(item.applicationMethod.label) || "Postuler",
                    url: safeApplicationUrl(item.applicationMethod.url),
                    loginRequired: item.applicationMethod.portalAccountRequired,
                  },
                  sourceUrl: safeApplicationUrl(item.sourceUrl),
                  checkedAt: item.checkedAt,
                },
                query,
              ),
            ),
        ),
    },
  ];

  if (options.candidateCountry === "TN") {
    tasks.push(
      {
        source: "ANETI International",
        promise: import("./aneti-opportunities")
          .then(({ searchAnetiOpportunities }) =>
            searchAnetiOpportunities({
              period: "recent",
              query,
              limit: 18,
              signal: options.signal,
            }),
          )
          .then((result) =>
            result.opportunities.map((item) =>
              scored(
                {
                  id: `aneti:${item.id}`,
                  kind: "job",
                  source: "ANETI International",
                  title: clean(item.title),
                  employer: "ANETI International",
                  countryCode: destinationCode(item.country),
                  countryName: clean(item.country) || "International",
                  location: clean(item.country),
                  description: clean(item.description),
                  deadlineAt: item.deadlineAt,
                  conditions: [item.requirements, item.speciality].map(clean).filter(Boolean),
                  requiredDocuments: ["CV", ...item.registrationRequirements]
                    .map(clean)
                    .filter(Boolean),
                  application: {
                    type: item.applicationMethod.type,
                    label: clean(item.applicationMethod.label) || "Postuler",
                    url: safeApplicationUrl(item.applicationMethod.url),
                    loginRequired: item.applicationMethod.loginRequired,
                  },
                  sourceUrl: safeApplicationUrl(item.sourceUrl),
                  checkedAt: item.checkedAt,
                },
                query,
              ),
            ),
          ),
      },
      {
        source: "ATCT Tunisie",
        promise: import("./atct-opportunities")
          .then(({ searchAtctOpportunities }) =>
            searchAtctOpportunities({
              period: "recent",
              query,
              limit: 18,
              signal: options.signal,
            }),
          )
          .then((result) =>
            result.opportunities
              .filter((item) => !item.closedBySource)
              .map((item) =>
                scored(
                  {
                    id: `atct:${item.id}`,
                    kind: "job",
                    source: "ATCT Tunisie",
                    title: clean(item.title),
                    employer: "ATCT Tunisie",
                    countryCode: destinationCode(item.country),
                    countryName: clean(item.country) || "International",
                    location: clean(item.country),
                    description: clean(item.description),
                    deadlineAt: item.deadlineAt,
                    conditions: [item.requirements, item.audience].map(clean).filter(Boolean),
                    requiredDocuments: item.requiredDocuments.map(clean).filter(Boolean),
                    application: {
                      type: item.applicationMethod.type,
                      label: clean(item.applicationMethod.label) || "Postuler",
                      url: safeApplicationUrl(item.applicationMethod.url),
                      email: item.applicationMethod.email,
                      loginRequired: item.applicationMethod.loginRequired,
                    },
                    sourceUrl: safeApplicationUrl(item.sourceUrl),
                    checkedAt: item.checkedAt,
                  },
                  query,
                ),
              ),
          ),
      },
    );
  } else {
    tasks.push({
      source: "Opportunités Algérie",
      promise: import("./algeria-opportunities")
        .then(({ searchAlgeriaOpportunities }) =>
          searchAlgeriaOpportunities({
            period: "recent",
            query,
            limit: 24,
            signal: options.signal,
          }),
        )
        .then((result) =>
          result.opportunities.map((item) =>
            scored(
              {
                id: `algeria:${item.id}`,
                kind: "job",
                source: "Opportunités Algérie",
                title: clean(item.title),
                employer: clean(item.employer),
                countryCode: "DZ",
                countryName: "Algérie",
                location: clean(
                  item.location || [item.commune, item.wilaya].filter(Boolean).join(", "),
                ),
                description: clean(item.description),
                deadlineAt: null,
                conditions: item.positions.map(clean).filter(Boolean),
                requiredDocuments: item.requiredDocuments.map(clean).filter(Boolean),
                application: {
                  type: item.applicationMethod.type,
                  label: clean(item.applicationMethod.label) || "Plus d’informations",
                  url: safeApplicationUrl(item.applicationMethod.url || item.sourceUrl),
                  email: item.applicationMethod.email,
                  loginRequired: Boolean(item.applicationMethod.loginRequired),
                },
                sourceUrl: safeApplicationUrl(item.sourceUrl),
                checkedAt: item.checkedAt,
              },
              query,
            ),
          ),
        ),
    });
  }

  const settled = await Promise.allSettled(tasks.map((task) => task.promise));
  const warnings: string[] = [];
  const liveMatches = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value;
    if (result.reason?.name !== "AbortError")
      warnings.push(`${tasks[index].source} : momentanément indisponible.`);
    return [];
  });
  return {
    matches: [...liveMatches, ...OFFICIAL_PROGRAMS.map((program) => scored(program, query))]
      .filter((item) => activeDeadline(item.deadlineAt))
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "fr")),
    warnings,
    searchedAt: new Date().toISOString(),
  };
}

export function emptyOpportunityPlan(
  cv: CV,
  candidateCountry = inferCandidateCountry(cv),
): OpportunityPlan {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    candidateCountry,
    targetJob: clean(cv.titre_poste),
    noc: cv.cnp ? { code: cv.cnp.code, title: cv.cnp.title, teer: cv.cnp.teer } : undefined,
    selectedOpportunities: [],
  };
}
