const ATCT_BASE_URL = "https://www.atct.tn";
const ATCT_LIST_URL = `${ATCT_BASE_URL}/fr/avis_ann`;
const ATCT_CANDIDATE_URL = `${ATCT_BASE_URL}/rh/fr/candidat`;
const CACHE_KEY = "public-cache/atct-international-jobs-latest.json";
const HEALTH_KEY = "system/monitoring/atct-opportunities.json";
const CACHE_VERSION = 2;
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LIST_PAGES = 5;
const MAX_DETAILS = 30;
const DETAIL_CONCURRENCY = 4;
const MAX_HTML_BYTES = 3_000_000;
const FETCH_ATTEMPTS = 3;

const COUNTRY_NAMES = [
  ["ontario", "Canada — Ontario"],
  ["quebec", "Canada — Québec"],
  ["canada", "Canada"],
  ["arabie saoudite", "Arabie saoudite"],
  ["mauritanie", "Mauritanie"],
  ["cote d ivoire", "Côte d’Ivoire"],
  ["koweit", "Koweït"],
  ["qatar", "Qatar"],
  ["emirats arabes unis", "Émirats arabes unis"],
  ["france", "France"],
  ["allemagne", "Allemagne"],
  ["oman", "Oman"],
  ["djibouti", "Djibouti"],
];

const FRENCH_MONTHS = new Map([
  ["janvier", 1],
  ["fevrier", 2],
  ["mars", 3],
  ["avril", 4],
  ["mai", 5],
  ["juin", 6],
  ["juillet", 7],
  ["aout", 8],
  ["septembre", 9],
  ["octobre", 10],
  ["novembre", 11],
  ["decembre", 12],
]);

function decodeHtml(value = "") {
  const named = {
    nbsp: " ",
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    eacute: "é",
    egrave: "è",
    ecirc: "ê",
    agrave: "à",
    acirc: "â",
    ugrave: "ù",
    ocirc: "ô",
    icirc: "î",
    ccedil: "ç",
    ndash: "–",
    mdash: "—",
  };
  return String(value)
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] || entity)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function cleanText(value = "") {
  return decodeHtml(
    String(value)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(?:p|li|h[1-6]|div)\s*>/gi, "\n")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fold(value = "") {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function classNamesFromTag(tag = "") {
  return (tag.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1] || "").split(/\s+/).filter(Boolean);
}

function elementBlocksByClass(html, className, tagName = "div") {
  const source = String(html || "");
  const blocks = [];
  const openingPattern = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  let opening;
  while ((opening = openingPattern.exec(source))) {
    if (!classNamesFromTag(opening[0]).includes(className)) continue;
    const start = opening.index;
    const tokenPattern = new RegExp(`<${tagName}\\b[^>]*>|<\\/${tagName}\\s*>`, "gi");
    tokenPattern.lastIndex = openingPattern.lastIndex;
    let depth = 1;
    let token;
    while (depth > 0 && (token = tokenPattern.exec(source))) {
      depth += /^<\//.test(token[0]) ? -1 : 1;
    }
    if (depth === 0 && token) {
      blocks.push(source.slice(start, tokenPattern.lastIndex));
      openingPattern.lastIndex = tokenPattern.lastIndex;
    }
  }
  return blocks;
}

function firstClassBlock(html, className, tagName = "div") {
  return elementBlocksByClass(html, className, tagName)[0] || "";
}

function absoluteUrl(value = "") {
  try {
    const url = new URL(decodeHtml(value), ATCT_BASE_URL);
    if (/^(?:www\.)?atct\.tn$/i.test(url.hostname)) {
      url.protocol = "https:";
      url.hostname = "www.atct.tn";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function canonicalPath(value) {
  try {
    const url = new URL(value, ATCT_BASE_URL);
    if (!/(^|\.)atct\.tn$/i.test(url.hostname)) return "";
    const path = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "");
    return path.startsWith("/fr/") ? path : "";
  } catch {
    return "";
  }
}

function idFromPath(path) {
  return canonicalPath(path).replace(/^\/fr\//, "");
}

export function extractAtctOpportunityId(value) {
  let candidate = String(value || "").trim();
  if (/^[a-z0-9][a-z0-9-]{4,}$/i.test(candidate) && !candidate.includes("/")) return candidate;
  for (let pass = 0; pass < 3; pass += 1) {
    const match = candidate.match(
      /(?:https?:\/\/)?(?:www\.)?atct\.tn\/(fr\/[a-z0-9][a-z0-9-]{4,})(?:[?#]|$)/i,
    );
    if (match) return match[1].replace(/^fr\//i, "");
    try {
      const decoded = decodeURIComponent(candidate.replace(/\+/g, "%20"));
      if (decoded === candidate) break;
      candidate = decoded;
    } catch {
      break;
    }
  }
  return null;
}

function canonicalDetailUrl(id) {
  return `${ATCT_BASE_URL}/fr/${id}`;
}

function isoDate(year, month, day, hour = 23, minute = 59) {
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 1, Number(minute)),
  );
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function parseAtctDate(value, endOfDay = false) {
  const source = fold(value);
  const numeric = source.match(/\b(\d{1,2})\s+(\d{1,2})\s+(\d{4})\b/);
  if (numeric)
    return isoDate(numeric[3], numeric[2], numeric[1], endOfDay ? 23 : 0, endOfDay ? 59 : 0);
  const french = source.match(/\b(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})\b/);
  if (!french) return null;
  const month = FRENCH_MONTHS.get(french[2]);
  return month ? isoDate(french[3], month, french[1], endOfDay ? 23 : 0, endOfDay ? 59 : 0) : null;
}

function linksFromHtml(html) {
  return [...String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ url: absoluteUrl(match[1]), label: cleanText(match[2]) }))
    .filter((link) => Boolean(link.url));
}

function bodyHtmlFromDetail(html) {
  return firstClassBlock(html, "field-name-body") || firstClassBlock(html, "detailActualiteDesc");
}

function titleFromDetail(html, fallback = "") {
  return (
    cleanText(String(html).match(/<h1\b[^>]*id=["']page-title["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ||
    cleanText(
      String(html).match(
        /<meta\b(?=[^>]*property=["']og:title["'])(?=[^>]*content=["']([^"']+)["'])[^>]*>/i,
      )?.[1],
    ).replace(/\s*\|\s*atct.*$/i, "") ||
    fallback ||
    "Offre ATCT"
  );
}

function postedDateFromDetail(html) {
  const block = firstClassBlock(html, "field-name-field-date-avis-ann");
  const machineDate = block.match(/\bcontent=["'](\d{4}-\d{2}-\d{2}T[^"']+)["']/i)?.[1];
  if (machineDate && Number.isFinite(Date.parse(machineDate))) {
    const [year, month, day] = machineDate.slice(0, 10).split("-").map(Number);
    return isoDate(year, month, day, 12, 0);
  }
  return parseAtctDate(cleanText(block));
}

function deadlineFromText(text) {
  const lines = cleanText(text).split("\n");
  const deadlineLine = lines.find((line) =>
    /date\s+limite|dernier\s+delai|deadline|cloture\s+des\s+candidatures|(?:avant|jusqu au|au plus tard)(?:\s+le)?\s+\d{1,2}\s+\d{1,2}\s+\d{4}/i.test(
      fold(line),
    ),
  );
  return deadlineLine ? parseAtctDate(deadlineLine, true) : null;
}

function countryFromText(value) {
  const normalized = fold(value);
  for (const [needle, label] of COUNTRY_NAMES) {
    if (normalized.includes(needle)) return label;
  }
  return "International";
}

function listItemsBetween(bodyHtml, startLabels, endLabels) {
  const source = String(bodyHtml || "");
  const headingPattern = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  const headings = [...source.matchAll(headingPattern)];
  const start = headings.find((heading) =>
    startLabels.some((label) => fold(heading[1]).includes(fold(label))),
  );
  let startIndex;
  let endIndex;
  if (start) {
    startIndex = start.index + start[0].length;
    const end = headings.find(
      (heading) =>
        heading.index > startIndex &&
        endLabels.some((label) => fold(heading[1]).includes(fold(label))),
    );
    endIndex = end?.index;
  } else {
    const rawStart = source.search(/postes?\b[\s\S]{0,120}(?:pourvoir|disponibles)/i);
    if (rawStart < 0) return [];
    startIndex = rawStart;
    const tail = source.slice(startIndex);
    const rawEnd = tail.search(/crit[èe]res?|conditions?|modalit[ée]s?|candidature|date\s+limite/i);
    endIndex = rawEnd > 0 ? startIndex + rawEnd : undefined;
  }
  const section = source.slice(startIndex, endIndex || source.length);
  return [...section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((item) => cleanText(item[1]).replace(/^([A-ZÀ-ÖØ-Þ])\s+(?=[a-zà-ÿ]{3})/, "$1"))
    .filter((item) => item.length >= 2)
    .slice(0, 30);
}

function sectionText(bodyText, startLabels, endLabels) {
  const lines = cleanText(bodyText).split("\n");
  const start = lines.findIndex((line) =>
    startLabels.some((label) => fold(line).includes(fold(label))),
  );
  if (start < 0) return "";
  const relativeEnd = lines
    .slice(start + 1)
    .findIndex((line) => endLabels.some((label) => fold(line).includes(fold(label))));
  const end = relativeEnd >= 0 ? start + 1 + relativeEnd : Math.min(lines.length, start + 20);
  return lines.slice(start, end).join("\n").trim();
}

function classifyNotice(title, bodyText) {
  const titleText = fold(title);
  const content = fold(`${title}\n${bodyText}`);
  if (
    /appel d offres|acquisition|consultation|marche public|avis au public|concours externe|concours interne|atelier|webinaire|seminaire/.test(
      titleText,
    )
  ) {
    return "excluded";
  }
  if (
    /recrut|offres? d emploi|postes? a pourvoir|personnel|candidats? interesses|souhaite recruter|recherche des [a-z]/.test(
      content,
    )
  ) {
    return "job";
  }
  return "other";
}

function applicationDetails(bodyHtml, bodyText, sourceUrl) {
  const links = linksFromHtml(bodyHtml);
  const externalForm = links.find(({ url, label }) => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const path = new URL(url).pathname.toLowerCase();
      const recognizedFormHost =
        /(^|\.)(forms\.gle|docs\.google\.com|forms\.office\.com|typeform\.com|jotform\.com|afeseo\.ca)$/.test(
          hostname,
        );
      const applicationContext = /formulaire|inscri|postul|candid|je vis|apply/i.test(fold(label));
      return (
        !/(^|\.)atct\.tn$/.test(hostname) &&
        !/(^|\.)(facebook|twitter|linkedin|youtube)\.com$/.test(hostname) &&
        !/\.(pdf|docx?|xlsx?|zip|jpe?g|png|webp)$/i.test(path) &&
        (recognizedFormHost || applicationContext)
      );
    } catch {
      return false;
    }
  });
  const portalLink = links.find(({ url }) => /atct\.tn\/rh\/fr\/candidat/i.test(url));
  const emails = [
    ...new Set(
      (bodyText.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || []).filter(
        (email) => !/^atct\.tunisia@atct\.tn$/i.test(email),
      ),
    ),
  ];
  const explicitAccount =
    /espace candidat|compte atct|inscri(?:re|ption).*atct|banque des candidatures|se connecter/i.test(
      fold(bodyText),
    );
  const loginRequired = Boolean(portalLink || explicitAccount);
  const applicationEmail = emails[0] || "";
  const type = externalForm
    ? "external_form"
    : applicationEmail
      ? "email"
      : loginRequired
        ? "atct_portal"
        : "official_page";
  const url =
    externalForm?.url ||
    (applicationEmail
      ? `mailto:${applicationEmail}`
      : portalLink?.url || (loginRequired ? ATCT_CANDIDATE_URL : sourceUrl));
  const documents = [];
  if (/\bcv\b/i.test(bodyText)) documents.push("CV");
  if (/copie du dipl[oô]me|dipl[oô]me/i.test(bodyText)) documents.push("Diplôme ou qualification");
  if (/attestations? d.exp[ée]rience/i.test(bodyText)) documents.push("Attestations d’expérience");
  if (/lettre de motivation/i.test(bodyText)) documents.push("Lettre de motivation");
  return {
    applicationMethod: {
      type,
      label: externalForm
        ? "Formulaire externe officiel publié par l’ATCT"
        : applicationEmail
          ? "Candidature par e-mail"
          : loginRequired
            ? "Connexion à l’espace candidat ATCT requise"
            : "Consulter les instructions ATCT",
      url,
      email: applicationEmail || null,
      loginRequired,
      note: externalForm
        ? `Plateforme : ${externalForm.label || new URL(externalForm.url).hostname}`
        : applicationEmail
          ? "Adresse extraite uniquement du contenu de l’annonce."
          : loginRequired
            ? "L’inscription et le suivi sont effectués dans l’espace candidat ATCT."
            : "Aucun formulaire ni e-mail de candidature séparé n’est publié.",
    },
    requiredDocuments: documents,
  };
}

export function parseAtctListHtml(html) {
  const rows = elementBlocksByClass(html, "views-row");
  const opportunities = [];
  for (const row of rows) {
    const titleBlock = firstClassBlock(row, "titleAtualite");
    const anchor = (titleBlock || row).match(
      /<a\b[^>]*href=["']([^"']*\/fr\/[a-z0-9][a-z0-9-]{4,})(?:[?#][^"']*)?["'][^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!anchor) continue;
    const path = canonicalPath(anchor[1]);
    const id = idFromPath(path);
    const title = cleanText(anchor[2]);
    if (!id || !title) continue;
    opportunities.push({ id, title, sourceUrl: canonicalDetailUrl(id) });
  }
  const unique = new Map();
  for (const item of opportunities) if (!unique.has(item.id)) unique.set(item.id, item);
  return [...unique.values()];
}

export function hasAtctNextPage(html, currentPage = 0) {
  return [...String(html).matchAll(/href=["'][^"']*[?&]page=(\d+)[^"']*["']/gi)].some(
    (match) => Number.parseInt(match[1], 10) > currentPage,
  );
}

export function parseAtctDetailHtml(html, summary = {}) {
  const title = titleFromDetail(html, summary.title);
  const bodyHtml = bodyHtmlFromDetail(html);
  const bodyText = cleanText(bodyHtml);
  const id = String(summary.id || extractAtctOpportunityId(summary.sourceUrl) || "");
  const sourceUrl = id ? canonicalDetailUrl(id) : ATCT_LIST_URL;
  const positions = listItemsBetween(
    bodyHtml,
    ["Postes à pourvoir", "Postes disponibles"],
    ["Critères", "Conditions", "Modalités", "Candidature", "Date limite"],
  );
  const requirements = sectionText(
    bodyText,
    ["Critères d’éligibilité", "Profil recherché", "Conditions requises"],
    ["Modalités de candidature", "Candidature", "Date limite"],
  );
  const deadlineAt = deadlineFromText(bodyText);
  const closedBySource =
    /(?:date limite|delai(?: de participation)?)[^\n]{0,100}(?:termine|expire|clotur)|(?:offre|candidatures?)[^\n]{0,60}(?:clotur|ferme)/i.test(
      fold(bodyText),
    );
  const category = classifyNotice(title, bodyText);
  const missingFields = [
    !title || title === "Offre ATCT" ? "title" : "",
    !bodyText ? "content" : "",
    !deadlineAt ? "deadline" : "",
  ].filter(Boolean);
  return {
    id,
    title,
    country: countryFromText(`${title}\n${bodyText}`),
    postedAt: postedDateFromDetail(html),
    deadlineAt,
    closedBySource,
    category,
    positions,
    requirements,
    description: bodyText.slice(0, 8_000),
    audience: "Candidats et compétences tunisiennes",
    sourceUrl,
    ...applicationDetails(bodyHtml, bodyText, sourceUrl),
    dataQuality: {
      status: missingFields.filter((field) => field !== "deadline").length ? "partial" : "complete",
      missingFields,
    },
    checkedAt: new Date().toISOString(),
  };
}

function validateAtctFetchUrl(value) {
  const url = new URL(value, ATCT_BASE_URL);
  if (url.protocol !== "https:" || !/(^|\.)atct\.tn$/i.test(url.hostname)) {
    throw new Error("URL ATCT non autorisée.");
  }
  return url.toString();
}

function retryDelay(response, attempt) {
  const retryAfter = Number.parseInt(response?.headers?.get("Retry-After") || "", 10);
  if (Number.isFinite(retryAfter)) return Math.min(2_000, Math.max(0, retryAfter * 1000));
  return 200 * 2 ** attempt;
}

async function wait(milliseconds) {
  if (milliseconds > 0) await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchAtctHtml(url, fetcher = fetch) {
  const safeUrl = validateAtctFetchUrl(url);
  let lastError;
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetcher(safeUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "fr-FR,fr;q=0.9",
          "User-Agent": "ZGR-CV-Opportunity-Monitor/1.0 (+https://abdou677778.github.io/zgr-cv/)",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      const finalUrl = response.url ? validateAtctFetchUrl(response.url) : safeUrl;
      if (response.ok) {
        const contentType = response.headers.get("Content-Type") || "";
        if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
          throw new Error(`ATCT a renvoyé un contenu inattendu (${contentType}).`);
        }
        const length = Number.parseInt(response.headers.get("Content-Length") || "", 10);
        if (Number.isFinite(length) && length > MAX_HTML_BYTES) {
          throw new Error("La page ATCT dépasse la taille maximale autorisée.");
        }
        const body = await response.text();
        if (new TextEncoder().encode(body).byteLength > MAX_HTML_BYTES) {
          throw new Error("La page ATCT dépasse la taille maximale autorisée.");
        }
        if (!body.trim()) throw new Error("ATCT a renvoyé une page vide.");
        return { body, finalUrl };
      }
      lastError = new Error(`ATCT a répondu ${response.status} pour ${safeUrl}.`);
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status)) break;
      await wait(retryDelay(response, attempt));
    } catch (error) {
      lastError = error;
      if (attempt + 1 < FETCH_ATTEMPTS) await wait(200 * 2 ** attempt);
    }
  }
  throw lastError || new Error(`ATCT est momentanément indisponible pour ${safeUrl}.`);
}

async function readJsonObject(env, key) {
  const object = await env.CLIENTS_BUCKET.get(key);
  return object ? object.json() : null;
}

async function writeJsonObject(env, key, value) {
  await env.CLIENTS_BUCKET.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function settleWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: "fulfilled", value: await task(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function timestampAge(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp)
    ? Math.max(0, Date.now() - timestamp)
    : Number.POSITIVE_INFINITY;
}

export async function refreshAtctOpportunityCache(env) {
  const attemptedAt = new Date().toISOString();
  const [previousCache, previousHealth] = await Promise.all([
    readJsonObject(env, CACHE_KEY),
    readJsonObject(env, HEALTH_KEY),
  ]);
  try {
    const summaries = new Map();
    for (let page = 0; page < MAX_LIST_PAGES && summaries.size < MAX_DETAILS; page += 1) {
      const { body } = await fetchAtctHtml(`${ATCT_LIST_URL}?page=${page}`);
      const rows = parseAtctListHtml(body);
      const before = summaries.size;
      for (const row of rows) summaries.set(row.id, row);
      if (!rows.length || summaries.size === before || !hasAtctNextPage(body, page)) break;
    }
    if (!summaries.size) throw new Error("ATCT n’a renvoyé aucun avis public.");
    const selected = [...summaries.values()].slice(0, MAX_DETAILS);
    const settled = await settleWithConcurrency(selected, DETAIL_CONCURRENCY, async (summary) =>
      parseAtctDetailHtml((await fetchAtctHtml(summary.sourceUrl)).body, summary),
    );
    const previousById = new Map(
      (Array.isArray(previousCache?.opportunities) ? previousCache.opportunities : []).map(
        (item) => [String(item.id), item],
      ),
    );
    const detailFailureIds = [];
    const verifiedNotices = settled
      .map((result, index) => {
        if (result.status === "fulfilled") return result.value;
        const summary = selected[index];
        detailFailureIds.push(summary.id);
        const previous = previousById.get(String(summary.id));
        return previous ? { ...previous, staleDetail: true } : null;
      })
      .filter(Boolean);
    const freshDetails = settled.filter((result) => result.status === "fulfilled").length;
    if (!freshDetails) throw new Error("Les avis ATCT n’ont pas pu être vérifiés.");
    if (!previousById.size && freshDetails / selected.length < 0.5) {
      throw new Error("Trop d’avis ATCT sont illisibles pour publier une mise à jour fiable.");
    }
    const opportunities = verifiedNotices
      .filter((item) => item.category === "job")
      .sort((left, right) => Date.parse(right.postedAt || "") - Date.parse(left.postedAt || ""));
    const payload = {
      version: CACHE_VERSION,
      fetchedAt: new Date().toISOString(),
      scanned: summaries.size,
      classifiedJobs: opportunities.length,
      excludedNotices: verifiedNotices.length - opportunities.length,
      freshDetails,
      detailFailures: detailFailureIds.length,
      detailFailureIds,
      opportunities,
    };
    await Promise.all([
      writeJsonObject(env, CACHE_KEY, payload),
      writeJsonObject(env, HEALTH_KEY, {
        state: detailFailureIds.length ? "warning" : "healthy",
        lastAttemptAt: attemptedAt,
        lastSuccessAt: payload.fetchedAt,
        scanned: summaries.size,
        opportunities: opportunities.length,
        excludedNotices: payload.excludedNotices,
        freshDetails,
        detailFailures: detailFailureIds.length,
        detailFailureIds,
        consecutiveFailures: 0,
        sourceUrl: ATCT_LIST_URL,
      }),
    ]);
    return payload;
  } catch (error) {
    await writeJsonObject(env, HEALTH_KEY, {
      state: "critical",
      lastAttemptAt: attemptedAt,
      lastFailureAt: attemptedAt,
      lastSuccessAt: previousHealth?.lastSuccessAt || previousCache?.fetchedAt || null,
      consecutiveFailures: Number(previousHealth?.consecutiveFailures || 0) + 1,
      message: error instanceof Error ? error.message : "Échec de la source ATCT.",
      sourceUrl: ATCT_LIST_URL,
    });
    throw error;
  }
}

async function latestAtctOpportunities(env) {
  const cached = await readJsonObject(env, CACHE_KEY);
  if (
    cached?.version === CACHE_VERSION &&
    Array.isArray(cached.opportunities) &&
    timestampAge(cached.fetchedAt) < CACHE_TTL_MS
  ) {
    return cached;
  }
  try {
    return await refreshAtctOpportunityCache(env);
  } catch (error) {
    if (
      cached?.version === CACHE_VERSION &&
      Array.isArray(cached.opportunities) &&
      timestampAge(cached.fetchedAt) <= MAX_STALE_MS
    ) {
      return {
        ...cached,
        stale: true,
        staleReason: error instanceof Error ? error.message : "Actualisation ATCT échouée.",
      };
    }
    throw error;
  }
}

function isOpen(item, now = Date.now()) {
  if (item.closedBySource) return false;
  if (!item.deadlineAt) return true;
  const deadline = Date.parse(item.deadlineAt);
  return !Number.isFinite(deadline) || deadline + 60_000 > now;
}

function parseLimit(value, fallback = 18) {
  const parsed = Number.parseInt(String(value || fallback), 10);
  return Math.min(30, Math.max(1, Number.isFinite(parsed) ? parsed : fallback));
}

export async function searchAtctOpportunities(env, options = {}) {
  const payload = await latestAtctOpportunities(env);
  const query = fold(options.query);
  const queryTokens = query.split(/\s+/).filter(Boolean);
  const period = options.period === "week" ? "week" : "recent";
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const matches = payload.opportunities
    .filter((item) => isOpen(item))
    .filter((item) => period !== "week" || Date.parse(item.postedAt || "") >= weekAgo)
    .filter((item) => {
      if (!query) return true;
      const searchable = fold(
        [
          item.id,
          item.title,
          item.country,
          item.positions?.join(" "),
          item.requirements,
          item.description,
        ].join(" "),
      );
      return queryTokens.every((token) => searchable.includes(token));
    });
  const limit = parseLimit(options.limit);
  return {
    opportunities: matches.slice(0, limit),
    meta: {
      period,
      returned: Math.min(limit, matches.length),
      totalMatches: matches.length,
      scanned: payload.scanned,
      excludedNotices: payload.excludedNotices,
      verifiedAt: payload.fetchedAt,
      stale: payload.stale === true,
      staleReason: payload.staleReason || null,
      cacheAgeMinutes: Math.round(timestampAge(payload.fetchedAt) / 60_000),
      detailFailures: Number(payload.detailFailures || 0),
      sourceUrl: ATCT_LIST_URL,
      candidatePortalUrl: ATCT_CANDIDATE_URL,
      methodology:
        "Les avis récents ATCT sont paginés, relus fiche par fiche puis classés afin d’exclure les marchés publics, concours internes, ateliers et annonces sans emploi. Les échéances et méthodes de candidature proviennent uniquement du contenu officiel.",
    },
  };
}

export async function inspectAtctOpportunity(env, idOrUrl) {
  const id = extractAtctOpportunityId(idOrUrl);
  if (!id) throw new Error("Lien ou identifiant ATCT invalide.");
  const payload = await latestAtctOpportunities(env);
  const cached = payload.opportunities.find((item) => item.id === id);
  const summary = cached || { id, sourceUrl: canonicalDetailUrl(id) };
  try {
    const opportunity = parseAtctDetailHtml(
      (await fetchAtctHtml(canonicalDetailUrl(id))).body,
      summary,
    );
    if (opportunity.category !== "job") {
      throw new Error("Cette page ATCT n’est pas classée comme offre d’emploi.");
    }
    return {
      opportunity: { ...opportunity, open: isOpen(opportunity) },
      meta: {
        verifiedAt: opportunity.checkedAt,
        live: true,
        sourceUrl: opportunity.sourceUrl,
        methodology: "Annonce ATCT relue et reclassée à la demande depuis sa page officielle.",
      },
    };
  } catch (error) {
    if (!cached) throw error;
    return {
      opportunity: { ...cached, staleDetail: true, open: isOpen(cached) },
      meta: {
        verifiedAt: cached.checkedAt || payload.fetchedAt,
        live: false,
        sourceUrl: cached.sourceUrl,
        warning: "La relecture en direct a échoué ; le dernier cache ATCT vérifié est utilisé.",
        methodology: "Cache ATCT vérifié utilisé temporairement après échec de relecture.",
      },
    };
  }
}

function apiHeaders(origin) {
  return {
    "Cache-Control": "public, max-age=180",
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

export async function handleAtctOpportunityApi(request, env, origin) {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/atct-opportunities/search" && request.method === "GET") {
      return apiJson(
        await searchAtctOpportunities(env, {
          period: url.searchParams.get("period") || "recent",
          query: url.searchParams.get("q") || "",
          limit: url.searchParams.get("limit") || "18",
        }),
        200,
        origin,
      );
    }
    if (url.pathname === "/api/atct-opportunities/inspect" && request.method === "GET") {
      return apiJson(
        await inspectAtctOpportunity(
          env,
          url.searchParams.get("url") || url.searchParams.get("id"),
        ),
        200,
        origin,
      );
    }
    if (url.pathname === "/api/atct-opportunities/health" && request.method === "GET") {
      return apiJson(
        (await readJsonObject(env, HEALTH_KEY)) || { state: "collecting" },
        200,
        origin,
      );
    }
    return apiJson({ error: "Route ATCT introuvable." }, 404, origin);
  } catch (error) {
    return apiJson(
      { error: error instanceof Error ? error.message : "Recherche ATCT indisponible." },
      502,
      origin,
    );
  }
}
