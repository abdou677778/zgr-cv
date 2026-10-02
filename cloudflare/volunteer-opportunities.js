const OFFICIAL_SEARCH_URL = "https://youth.europa.eu/api/rest/eyp/v1/search_en";
const OFFICIAL_LIST_URL = "https://youth.europa.eu/go-abroad/volunteering/opportunities_en";
const OFFICIAL_DETAIL_PREFIX = "https://youth.europa.eu/solidarity/opportunity/";
const OFFICIAL_REGISTER_URL = "https://youth.europa.eu/solidarity/register_en";
const CACHE_KEY = "public-cache/eu-youth-volunteering-latest.json";
const HEALTH_KEY = "system/monitoring/volunteer-opportunities.json";
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const CACHE_VERSION = 3;
const SEARCH_PAGE_SIZE = 200;
const MAX_DISCOVERY_PAGES = 10;

const COUNTRY_NAMES = {
  AL: "Albanie",
  AM: "Arménie",
  AT: "Autriche",
  AZ: "Azerbaïdjan",
  BA: "Bosnie-Herzégovine",
  BE: "Belgique",
  BG: "Bulgarie",
  CY: "Chypre",
  CZ: "Tchéquie",
  DE: "Allemagne",
  DK: "Danemark",
  DZ: "Algérie",
  EE: "Estonie",
  EG: "Égypte",
  EL: "Grèce",
  ES: "Espagne",
  FI: "Finlande",
  FR: "France",
  GE: "Géorgie",
  HR: "Croatie",
  HU: "Hongrie",
  IE: "Irlande",
  IL: "Israël",
  IS: "Islande",
  IT: "Italie",
  JO: "Jordanie",
  LB: "Liban",
  LI: "Liechtenstein",
  LT: "Lituanie",
  LU: "Luxembourg",
  LV: "Lettonie",
  LY: "Libye",
  MA: "Maroc",
  MD: "Moldavie",
  ME: "Monténégro",
  MK: "Macédoine du Nord",
  MT: "Malte",
  NL: "Pays-Bas",
  NO: "Norvège",
  PL: "Pologne",
  PS: "Palestine",
  PT: "Portugal",
  RO: "Roumanie",
  RS: "Serbie",
  SE: "Suède",
  SI: "Slovénie",
  SK: "Slovaquie",
  SY: "Syrie",
  TN: "Tunisie",
  TR: "Türkiye",
  UA: "Ukraine",
  XK: "Kosovo",
};

const COUNTRY_ALIASES = {
  algeria: "DZ",
  algerie: "DZ",
  dz: "DZ",
  france: "FR",
  fr: "FR",
  libya: "LY",
  libye: "LY",
  ly: "LY",
  maroc: "MA",
  ma: "MA",
  morocco: "MA",
  tn: "TN",
  tunisia: "TN",
  tunisie: "TN",
};

function fold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function resolveParticipantCountry(value) {
  const raw = String(value || "TN").trim();
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  return COUNTRY_ALIASES[fold(raw)] || "";
}

function countryName(code) {
  if (COUNTRY_NAMES[code]) return COUNTRY_NAMES[code];
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function validIso(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const includesTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  // The portal publishes Brussels wall-clock values without an offset. Keep
  // the displayed hour stable instead of letting the Worker or test machine
  // silently shift it according to its own timezone.
  const parsed = Date.parse(includesTimezone ? raw : `${raw}Z`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || "").replaceAll("&amp;", "&"));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function urlsFromHtml(value) {
  const html = String(value || "");
  const urls = [];
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const url = safeExternalUrl(match[1]);
    if (url) urls.push(url);
  }
  for (const match of html.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const url = safeExternalUrl(match[0].replace(/[),.;]+$/, ""));
    if (url) urls.push(url);
  }
  return [...new Set(urls)];
}

function ageRequirement(source) {
  const profile = decodeHtml(source?.participant_profile);
  const normalized = profile.replace(/[–—]/g, "-");
  const range = normalized.match(
    /(?:between|aged?|ages?|from)?\s*(1[789]|[2-3]\d)\s*(?:-|to|and)\s*(2\d|3[0-5])\s*(?:years?|yo|y\.o\.)?/i,
  );
  const humanitarian = source?.funding_programme?.is_humanitarian === true;
  const defaultMax = humanitarian ? 35 : 30;
  if (range) {
    const minimum = Number(range[1]);
    const maximum = Number(range[2]);
    if (minimum >= 17 && maximum >= minimum && maximum <= 35) {
      return {
        minimum,
        maximum,
        label: `${minimum}–${maximum} ans`,
        source: "participant_profile",
        programmeMaximum: defaultMax,
      };
    }
  }
  const minimumMatch = normalized.match(/(?:at least|minimum|min\.?|from)\s*(1[789]|2\d)/i);
  const maximumMatch = normalized.match(
    /(?:not older than|maximum|max\.?|under|up to)\s*(2\d|3[0-5])/i,
  );
  const minimum = minimumMatch ? Math.max(18, Number(minimumMatch[1])) : 18;
  const maximum = maximumMatch ? Math.min(defaultMax, Number(maximumMatch[1])) : defaultMax;
  return {
    minimum,
    maximum,
    label: `${minimum}–${maximum} ans`,
    source: minimumMatch || maximumMatch ? "profile_and_programme" : "programme_rule",
    programmeMaximum: defaultMax,
  };
}

function applicationMethod(source) {
  const fields = [
    source?.description,
    source?.participant_profile,
    source?.accommodation_and_food,
    source?.training_during_activity,
    source?.additional_information,
  ];
  const combinedHtml = fields.filter(Boolean).join("\n");
  const combinedText = decodeHtml(combinedHtml);
  const urls = urlsFromHtml(combinedHtml);
  const formUrl = urls.find((url) =>
    /(?:forms\.gle|docs\.google\.com\/forms|jotform|typeform|forms\.office\.com|formstack)/i.test(
      url,
    ),
  );
  if (formUrl) {
    return {
      type: "external_form",
      label: "Formulaire externe indiqué",
      url: formUrl,
      portalAccountRequired: true,
      note: "Remplissez le formulaire indiqué. L’inscription EU Login/Corps reste requise pour participer.",
    };
  }
  const mentionsExternalApplication =
    /(?:only way to apply|apply through the form|to apply.{0,80}(?:link|form)|application form)/i.test(
      combinedText,
    );
  if (mentionsExternalApplication && urls.length) {
    const descriptionUrl = urlsFromHtml(source?.description)[0];
    return {
      type: "external_instructions",
      label: "Candidature sur le site de l’organisme",
      url: descriptionUrl || urls[0],
      portalAccountRequired: true,
      note: "Suivez les instructions de l’organisme. L’inscription EU Login/Corps reste requise pour participer.",
    };
  }
  const emailApplication = combinedText.match(
    /(?:apply|application|send).{0,80}([\w.+-]+@[\w.-]+\.[a-z]{2,})/i,
  );
  if (emailApplication) {
    return {
      type: "email",
      label: "Candidature par e-mail indiquée",
      url: `mailto:${emailApplication[1]}`,
      portalAccountRequired: true,
      note: "Contactez l’organisme à l’adresse indiquée. L’inscription EU Login/Corps reste requise.",
    };
  }
  return {
    type: "portal_account",
    label: "Connexion EU Login requise",
    url: OFFICIAL_REGISTER_URL,
    portalAccountRequired: true,
    note: "Connectez-vous ou rejoignez le Corps européen de solidarité avant de postuler.",
  };
}

function eligibilityCodes(source) {
  const explicit = Array.isArray(source?.volunteer_countries)
    ? source.volunteer_countries.map((value) => String(value).toUpperCase())
    : [];
  const programme = Array.isArray(source?.funding_programme?.residence_countries)
    ? source.funding_programme.residence_countries.map((value) => String(value).toUpperCase())
    : [];
  const usesProgramme = !explicit.length || explicit.includes("ALL");
  return {
    codes: [...new Set(usesProgramme ? programme : explicit)].filter(Boolean),
    source: usesProgramme ? "funding_programme.residence_countries" : "volunteer_countries",
  };
}

export function normalizeOfficialOpportunity(source, checkedAt = new Date().toISOString()) {
  const id = String(source?.opid || source?.id || "").trim();
  if (!/^\d+$/.test(id)) return null;
  const eligibility = eligibilityCodes(source);
  const destinationCode = String(source?.country || "").toUpperCase();
  return {
    id,
    title: decodeHtml(source?.title) || `Opportunité ${id}`,
    organization: decodeHtml(source?.organisation_name),
    description: decodeHtml(source?.description),
    participantProfile: decodeHtml(source?.participant_profile),
    ageRequirement: ageRequirement(source),
    applicationMethod: applicationMethod(source),
    applicationRequirements: {
      cv: source?.requires_cv === true,
      motivationStatement: source?.requires_motivation_statement === true,
    },
    destination: {
      town: decodeHtml(source?.town),
      countryCode: destinationCode,
      countryName: countryName(destinationCode),
    },
    activityType: String(source?.volunteer_activity_type || "").trim(),
    topics: Array.isArray(source?.topics)
      ? source.topics.map((topic) => String(topic)).filter(Boolean)
      : [],
    startAt: validIso(source?.date_start),
    endAt: validIso(source?.date_end),
    deadlineAt: validIso(source?.date_application_end),
    publishedAt: validIso(source?.created),
    updatedAt: validIso(source?.changed),
    eligibilityCodes: eligibility.codes,
    eligibilitySource: eligibility.source,
    sourceUrl: `${OFFICIAL_DETAIL_PREFIX}${id}_en`,
    checkedAt,
  };
}

export function isCountryEligible(opportunity, participantCountry) {
  const code = resolveParticipantCountry(participantCountry);
  return Boolean(code && opportunity?.eligibilityCodes?.includes(code));
}

function officialSearchUrl({ id, from = 0, size = SEARCH_PAGE_SIZE } = {}) {
  const params = new URLSearchParams({
    type: "Opportunity",
    size: String(size),
    from: String(from),
  });
  params.set("filters[status]", "open");
  if (id) params.set("filters[opid]", String(id));
  else params.set("sort[created]", "desc");
  return `${OFFICIAL_SEARCH_URL}?${params.toString()}`;
}

async function fetchOfficialPage(options = {}) {
  let response;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(officialSearchUrl(options), {
        headers: {
          Accept: "application/json",
          "User-Agent": "ZGR-CV-Opportunity-Finder/1.0 (+https://abdou677778.github.io/zgr-cv/)",
        },
        cf: { cacheTtl: 900, cacheEverything: true },
        signal: AbortSignal.timeout(12_000),
      });
      if (response.ok) break;
      lastError = new Error(`European Youth Portal HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  if (!response?.ok)
    throw lastError instanceof Error ? lastError : new Error("European Youth Portal indisponible");
  const payload = await response.json();
  if (!payload?.hits || !Array.isArray(payload.hits.hits))
    throw new Error("Format inattendu du Portail européen de la jeunesse.");
  const hits = Array.isArray(payload?.hits?.hits) ? payload.hits.hits : [];
  const checkedAt = new Date().toISOString();
  return hits.map((hit) => normalizeOfficialOpportunity(hit?._source, checkedAt)).filter(Boolean);
}

async function fetchOfficialLatest() {
  const collected = new Map();
  const recentCutoff = Date.now() - 8 * 24 * 60 * 60 * 1000;
  let pagesScanned = 0;
  for (let pageIndex = 0; pageIndex < MAX_DISCOVERY_PAGES; pageIndex += 1) {
    const page = await fetchOfficialPage({
      from: pageIndex * SEARCH_PAGE_SIZE,
      size: SEARCH_PAGE_SIZE,
    });
    pagesScanned += 1;
    for (const opportunity of page) collected.set(opportunity.id, opportunity);
    if (page.length < SEARCH_PAGE_SIZE) break;
    const oldestPublishedAt = Math.min(
      ...page
        .map((opportunity) => Date.parse(opportunity.publishedAt || ""))
        .filter(Number.isFinite),
    );
    if (Number.isFinite(oldestPublishedAt) && oldestPublishedAt < recentCutoff) break;
  }
  return { opportunities: [...collected.values()], pagesScanned };
}

async function readCache(env) {
  if (!env?.CLIENTS_BUCKET) return null;
  const object = await env.CLIENTS_BUCKET.get(CACHE_KEY);
  if (!object) return null;
  try {
    const payload = JSON.parse(await object.text());
    return payload?.version === CACHE_VERSION && Array.isArray(payload?.opportunities)
      ? payload
      : null;
  } catch {
    return null;
  }
}

async function writeCache(env, payload) {
  if (!env?.CLIENTS_BUCKET) return;
  await env.CLIENTS_BUCKET.put(CACHE_KEY, JSON.stringify(payload), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function readHealth(env) {
  if (!env?.CLIENTS_BUCKET) return null;
  const object = await env.CLIENTS_BUCKET.get(HEALTH_KEY);
  if (!object) return null;
  try {
    return JSON.parse(await object.text());
  } catch {
    return null;
  }
}

async function writeHealth(env, payload) {
  if (!env?.CLIENTS_BUCKET) return;
  await env.CLIENTS_BUCKET.put(HEALTH_KEY, JSON.stringify(payload), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

function sourceSchemaAlerts(opportunities) {
  const alerts = [];
  if (!opportunities.length) alerts.push("La source officielle n’a renvoyé aucune opportunité.");
  const incomplete = opportunities.filter(
    (item) =>
      !item.id ||
      !item.title ||
      !item.sourceUrl ||
      !Array.isArray(item.eligibilityCodes) ||
      !item.publishedAt,
  );
  if (incomplete.length)
    alerts.push(`${incomplete.length} fiche(s) ne respectent plus le schéma attendu.`);
  return alerts;
}

export async function getVolunteerOpportunityHealth(env) {
  const stored = await readHealth(env);
  if (stored) return stored;
  return {
    state: "collecting",
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    consecutiveFailures: 0,
    opportunities: 0,
    pagesScanned: 0,
    cacheVersion: CACHE_VERSION,
    sourceUrl: OFFICIAL_LIST_URL,
    alerts: ["Premier contrôle automatique en attente."],
  };
}

export async function recordVolunteerOpportunityFailure(env, error) {
  const previous = await getVolunteerOpportunityHealth(env);
  const consecutiveFailures = Number(previous.consecutiveFailures || 0) + 1;
  const message =
    error instanceof Error ? error.message : "Erreur inconnue de la source officielle.";
  const payload = {
    ...previous,
    state: consecutiveFailures >= 3 ? "critical" : "warning",
    lastAttemptAt: new Date().toISOString(),
    lastFailureAt: new Date().toISOString(),
    consecutiveFailures,
    cacheVersion: CACHE_VERSION,
    sourceUrl: OFFICIAL_LIST_URL,
    alerts: [`Actualisation échouée : ${message}`],
  };
  await writeHealth(env, payload);
  return payload;
}

export async function refreshVolunteerOpportunityCache(env) {
  const attemptedAt = new Date().toISOString();
  try {
    const { opportunities, pagesScanned } = await fetchOfficialLatest();
    const alerts = sourceSchemaAlerts(opportunities);
    if (!opportunities.length) throw new Error(alerts.join(" "));
    const payload = {
      version: CACHE_VERSION,
      fetchedAt: new Date().toISOString(),
      sourceUrl: OFFICIAL_LIST_URL,
      pagesScanned,
      opportunities,
    };
    const previousHealth = await getVolunteerOpportunityHealth(env);
    await Promise.all([
      writeCache(env, payload),
      writeHealth(env, {
        state: alerts.length ? "warning" : "healthy",
        lastAttemptAt: attemptedAt,
        lastSuccessAt: payload.fetchedAt,
        lastFailureAt: previousHealth.lastFailureAt || null,
        consecutiveFailures: 0,
        opportunities: opportunities.length,
        pagesScanned,
        cacheVersion: CACHE_VERSION,
        sourceUrl: OFFICIAL_LIST_URL,
        alerts,
      }),
    ]);
    return payload;
  } catch (error) {
    await recordVolunteerOpportunityFailure(env, error);
    throw error;
  }
}

async function latestOpportunities(env) {
  const cached = await readCache(env);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < CACHE_TTL_MS) return cached;
  try {
    return await refreshVolunteerOpportunityCache(env);
  } catch (error) {
    if (cached) return { ...cached, stale: true };
    throw error;
  }
}

function isOpenAt(opportunity, now) {
  const end = opportunity.endAt ? Date.parse(opportunity.endAt) : Number.POSITIVE_INFINITY;
  const deadline = opportunity.deadlineAt
    ? Date.parse(opportunity.deadlineAt)
    : Number.POSITIVE_INFINITY;
  return end >= now && deadline >= now;
}

function parseLimit(value, fallback = 24) {
  const parsed = Number.parseInt(String(value || fallback), 10);
  return Math.min(50, Math.max(1, Number.isFinite(parsed) ? parsed : fallback));
}

export async function searchVolunteerOpportunities(env, options = {}) {
  const countryCode = resolveParticipantCountry(options.participantCountry || "TN");
  if (!countryCode) throw new Error("Pays participant non reconnu.");
  const period = options.period === "recent" ? "recent" : "week";
  const query = fold(options.query);
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const payload = await latestOpportunities(env);
  const matches = payload.opportunities
    .filter((opportunity) => isOpenAt(opportunity, now))
    .filter((opportunity) => isCountryEligible(opportunity, countryCode))
    .filter(
      (opportunity) => period !== "week" || Date.parse(opportunity.publishedAt || "") >= weekAgo,
    )
    .filter((opportunity) => {
      if (!query) return true;
      return fold(
        [
          opportunity.title,
          opportunity.organization,
          opportunity.description,
          opportunity.destination?.town,
          opportunity.destination?.countryName,
        ].join(" "),
      ).includes(query);
    });
  const limit = parseLimit(options.limit);
  return {
    opportunities: matches.slice(0, limit).map((opportunity) => ({
      ...opportunity,
      eligible: true,
      eligibleCountry: { code: countryCode, name: countryName(countryCode) },
    })),
    meta: {
      participantCountry: { code: countryCode, name: countryName(countryCode) },
      period,
      returned: Math.min(limit, matches.length),
      totalMatches: matches.length,
      scanned: payload.opportunities.length,
      pagesScanned: Number(payload.pagesScanned) || 1,
      verifiedAt: payload.fetchedAt,
      stale: payload.stale === true,
      sourceUrl: OFFICIAL_LIST_URL,
      cacheVersion: CACHE_VERSION,
      sourceStrategy: "official_structured_api",
      methodology:
        "Admissibilité vérifiée par code pays exact dans les pays participants de la fiche officielle.",
    },
  };
}

export async function inspectVolunteerOpportunity(env, idOrUrl, participantCountry = "TN") {
  const id = String(idOrUrl || "").match(/(?:opportunity\/)?(\d{3,})(?:_[a-z]{2})?/i)?.[1];
  if (!id) throw new Error("Lien ou identifiant d’opportunité invalide.");
  const [opportunity] = await fetchOfficialPage({ id, size: 1 });
  if (!opportunity) throw new Error("Opportunité introuvable sur le portail officiel.");
  const countryCode = resolveParticipantCountry(participantCountry || "TN");
  if (!countryCode) throw new Error("Pays participant non reconnu.");
  return {
    opportunity: {
      ...opportunity,
      eligible: isCountryEligible(opportunity, countryCode),
      eligibleCountry: { code: countryCode, name: countryName(countryCode) },
    },
    meta: {
      verifiedAt: opportunity.checkedAt,
      sourceUrl: opportunity.sourceUrl,
      methodology:
        "Admissibilité vérifiée par code pays exact dans les pays participants de la fiche officielle.",
    },
  };
}

function apiHeaders(origin) {
  return {
    "Cache-Control": "public, max-age=300",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...(origin
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          Vary: "Origin",
        }
      : {}),
  };
}

function apiJson(body, status = 200, origin = null) {
  return new Response(JSON.stringify(body), { status, headers: apiHeaders(origin) });
}

export async function handleVolunteerApi(request, env, origin) {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/opportunities/search" && request.method === "GET") {
      return apiJson(
        await searchVolunteerOpportunities(env, {
          participantCountry: url.searchParams.get("country") || "TN",
          period: url.searchParams.get("period") || "week",
          query: url.searchParams.get("q") || "",
          limit: url.searchParams.get("limit") || "24",
        }),
        200,
        origin,
      );
    }
    if (url.pathname === "/api/opportunities/inspect" && request.method === "GET") {
      return apiJson(
        await inspectVolunteerOpportunity(
          env,
          url.searchParams.get("url") || url.searchParams.get("id"),
          url.searchParams.get("country") || "TN",
        ),
        200,
        origin,
      );
    }
    return apiJson({ error: "Route opportunités introuvable." }, 404, origin);
  } catch (error) {
    return apiJson(
      { error: error instanceof Error ? error.message : "Recherche indisponible." },
      502,
      origin,
    );
  }
}

const MCP_TOOLS = [
  {
    name: "search_volunteer_opportunities",
    title: "Rechercher des opportunités de volontariat",
    description:
      "Recherche les opportunités récentes du Portail européen de la jeunesse et ne retourne que celles dont le pays du participant est explicitement admissible.",
    inputSchema: {
      type: "object",
      properties: {
        participant_country: {
          type: "string",
          description:
            "Pays de résidence du participant, par exemple Tunisia, Tunisie, TN ou Algeria.",
        },
        period: {
          type: "string",
          enum: ["week", "recent"],
          description:
            "week = publiées durant les 7 derniers jours; recent = opportunités récentes actives.",
        },
        query: { type: "string", description: "Mots-clés facultatifs." },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      required: ["participant_country"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
  },
  {
    name: "inspect_volunteer_opportunity",
    title: "Vérifier une opportunité de volontariat",
    description:
      "Vérifie une fiche officielle précise, notamment la présence exacte du pays dans les pays participants.",
    inputSchema: {
      type: "object",
      properties: {
        url_or_id: { type: "string", description: "Lien officiel ou identifiant numérique." },
        participant_country: { type: "string", description: "Pays à contrôler." },
      },
      required: ["url_or_id", "participant_country"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
  },
];

function mcpHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, MCP-Protocol-Version",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Expose-Headers": "MCP-Protocol-Version",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "MCP-Protocol-Version": "2025-03-26",
  };
}

function mcpJson(body, status = 200) {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: mcpHeaders(),
  });
}

function mcpError(id, code, message, status = 200) {
  return mcpJson({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, status);
}

function opportunityText(result) {
  if (!result.opportunities.length)
    return `Aucune opportunité vérifiée pour ${result.meta.participantCountry.name} dans cette période.`;
  const lines = result.opportunities.map((item, index) => {
    const location = [item.destination.town, item.destination.countryName]
      .filter(Boolean)
      .join(", ");
    const deadline = item.deadlineAt
      ? new Date(item.deadlineAt).toLocaleDateString("fr-FR")
      : "sans échéance indiquée";
    return `${index + 1}. ${item.title} — ${location || "destination non précisée"} — candidature: ${deadline}\n${item.sourceUrl}`;
  });
  return `${result.opportunities.length} opportunité(s) vérifiée(s) pour ${result.meta.participantCountry.name}.\n\n${lines.join("\n\n")}\n\nSource: ${result.meta.sourceUrl}`;
}

export async function handleVolunteerMcp(request, env) {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: mcpHeaders() });
  if (request.method === "GET")
    return mcpJson({
      name: "ZGR Volunteer Opportunities MCP",
      endpoint: "/mcp",
      source: OFFICIAL_LIST_URL,
      tools: MCP_TOOLS.map((tool) => tool.name),
    });
  if (request.method !== "POST") return mcpJson({ error: "Method not allowed" }, 405);
  let message;
  try {
    message = await request.json();
  } catch {
    return mcpError(null, -32700, "Invalid JSON", 400);
  }
  const id = message?.id;
  if (message?.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (message?.method === "initialize") {
    return mcpJson({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "zgr-volunteer-opportunities", version: "1.0.0" },
        instructions:
          "Utilisez toujours le pays de résidence fourni. Ne déclarez admissible qu’un résultat marqué eligible=true et citez son sourceUrl officiel.",
      },
    });
  }
  if (message?.method === "tools/list")
    return mcpJson({ jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } });
  if (message?.method === "tools/call") {
    const name = message?.params?.name;
    const args = message?.params?.arguments || {};
    try {
      if (name === "search_volunteer_opportunities") {
        const result = await searchVolunteerOpportunities(env, {
          participantCountry: args.participant_country,
          period: args.period,
          query: args.query,
          limit: args.limit,
        });
        return mcpJson({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: opportunityText(result) }],
            structuredContent: result,
            isError: false,
          },
        });
      }
      if (name === "inspect_volunteer_opportunity") {
        const result = await inspectVolunteerOpportunity(
          env,
          args.url_or_id,
          args.participant_country,
        );
        return mcpJson({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `${result.opportunity.title}\nAdmissible pour ${result.opportunity.eligibleCountry.name}: ${result.opportunity.eligible ? "oui" : "non"}\n${result.opportunity.sourceUrl}`,
              },
            ],
            structuredContent: result,
            isError: false,
          },
        });
      }
      return mcpError(id, -32602, `Outil inconnu: ${String(name || "")}`);
    } catch (error) {
      return mcpJson({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            { type: "text", text: error instanceof Error ? error.message : "Échec de l’outil." },
          ],
          isError: true,
        },
      });
    }
  }
  if (id == null) return new Response(null, { status: 202 });
  return mcpError(id, -32601, `Méthode inconnue: ${String(message?.method || "")}`);
}
