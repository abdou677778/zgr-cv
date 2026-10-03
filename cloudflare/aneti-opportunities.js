const ANETI_BASE_URL = "https://aneti-international.tn";
const ANETI_LIST_URL = `${ANETI_BASE_URL}/offres`;
const CACHE_KEY = "public-cache/aneti-international-jobs-latest.json";
const HEALTH_KEY = "system/monitoring/aneti-opportunities.json";
const CACHE_VERSION = 2;
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LIST_PAGES = 5;
const MAX_DETAILS = 40;
const DETAIL_CONCURRENCY = 4;
const MAX_HTML_BYTES = 3_000_000;
const FETCH_ATTEMPTS = 3;

const COUNTRY_ALIASES = new Map([
  ["italie", "Italie"],
  ["arabie saoudite", "Arabie saoudite"],
  ["france", "France"],
  ["allemagne", "Allemagne"],
  ["canada", "Canada"],
  ["qatar", "Qatar"],
  ["emirats arabes unis", "Émirats arabes unis"],
  ["emirates arabes unis", "Émirats arabes unis"],
  ["royaume uni", "Royaume-Uni"],
  ["grande bretagne", "Royaume-Uni"],
  ["mauritanie", "Mauritanie"],
  ["belgique", "Belgique"],
  ["suisse", "Suisse"],
  ["espagne", "Espagne"],
  ["portugal", "Portugal"],
]);

const NAMED_ENTITIES = new Map([
  ["eacute", "é"],
  ["egrave", "è"],
  ["ecirc", "ê"],
  ["agrave", "à"],
  ["acirc", "â"],
  ["ugrave", "ù"],
  ["ucirc", "û"],
  ["ocirc", "ô"],
  ["icirc", "î"],
  ["ccedil", "ç"],
  ["laquo", "«"],
  ["raquo", "»"],
  ["ndash", "–"],
  ["mdash", "—"],
]);

function decodeHtml(value = "") {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&([a-z]+);/gi, (entity, name) => NAMED_ENTITIES.get(name.toLowerCase()) || entity)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function cleanText(value = "") {
  return decodeHtml(
    String(value)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n")
      .replace(/<\/li\s*>/gi, "\n")
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
    .toLowerCase();
}

function absoluteUrl(value = "") {
  try {
    return new URL(decodeHtml(value), ANETI_BASE_URL).toString();
  } catch {
    return "";
  }
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

function firstClassBlock(html, className) {
  return elementBlocksByClass(html, className)[0] || "";
}

function frenchDate(value) {
  const match = String(value || "").match(
    /(?:\b(?:lun|mar|mer|jeu|ven|sam|dim|mon|tue|wed|thu|fri|sat|sun)\w*\s+)?(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})(?:\s*(?:-|à|at)?\s*(\d{1,2}):(\d{2}))?/i,
  );
  if (!match) return null;
  const [, day, month, year, hour = "00", minute = "00"] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:00+01:00`;
}

function fieldBlock(html, fieldName) {
  const classBlock = firstClassBlock(html, `field--name-${fieldName}`);
  if (classBlock) return classBlock;
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(html).match(
    new RegExp(
      `<div class="[^"]*field--name-${escaped}[^"]*">([\\s\\S]*?)(?=<div class="[^"]*field--name-field-|<\\/article>|<footer)`,
      "i",
    ),
  );
  return match?.[1] || "";
}

function linksFromHtml(html) {
  return [...String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => ({ url: absoluteUrl(match[1]), raw: decodeHtml(match[1]) }))
    .filter((link) => Boolean(link.url));
}

function fieldBlockByAliases(html, names) {
  for (const name of names) {
    const block = fieldBlock(html, name);
    if (block) return block;
  }
  return "";
}

function labeledDate(text, labels) {
  const pattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const match = cleanText(text).match(new RegExp(`(?:${pattern})\\s*:?\\s*([^\\n]{0,80})`, "i"));
  return frenchDate(match?.[1]);
}

function canonicalAnetiNodeUrl(id) {
  return `${ANETI_BASE_URL}/node/${id}`;
}

export function extractAnetiOpportunityId(value) {
  let candidate = String(value || "").trim();
  if (/^\d{4,}$/.test(candidate)) return candidate;
  for (let pass = 0; pass < 3; pass += 1) {
    const match = candidate.match(
      /(?:https?:\/\/)?(?:www\.)?aneti-international\.tn\/(?:[a-z]{2}\/)?node\/(\d{4,})/i,
    );
    if (match) return match[1];
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

function normalizedCountry(value) {
  const cleaned = cleanText(value)
    .replace(/^Pays\s*/i, "")
    .trim();
  return (
    COUNTRY_ALIASES.get(fold(cleaned)) || cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function parseAnetiListHtml(html) {
  const robustRows = elementBlocksByClass(html, "views-row");
  const rows = robustRows.length
    ? robustRows
    : String(html).match(
        /<div\b[^>]*class=["'][^"']*\bviews-row\b[^"']*["'][^>]*>[\s\S]*?(?=<div\b[^>]*class=["'][^"']*\bviews-row\b|<nav\b[^>]*class=["'][^"']*\bpager\b)/gi,
      ) || [];
  const parsed = rows
    .map((row) => {
      const anchor = row.match(
        /<a\b[^>]*href=["']([^"']*\/(?:[a-z]{2}\/)?node\/(\d+)(?:[?#][^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/i,
      );
      if (!anchor) return null;
      const text = cleanText(row).replace(/\s+/g, " ");
      const publishedText =
        text.match(
          /(?:Publié|Published)\s*:\s*([\s\S]*?)(?=(?:Date\s*Fin|End\s*date)\s*:)/i,
        )?.[1] || "";
      const tail = text.match(/(?:Date\s*Fin|End\s*date)\s*:\s*([\s\S]*)$/i)?.[1]?.trim() || "";
      const deadlineMatch = tail.match(
        /(?:\b(?:lun|mar|mer|jeu|ven|sam|dim|mon|tue|wed|thu|fri|sat|sun)\w*\s+)?\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}(?:\s*(?:-|à|at)?\s*\d{1,2}:\d{2})?/i,
      );
      const countryField = cleanText(firstClassBlock(row, "views-field-name"))
        .replace(/^(?:Pays|Country)\s*:?\s*/i, "")
        .trim();
      const countryText =
        countryField || (deadlineMatch ? tail.slice(deadlineMatch[0].length).trim() : tail);
      return {
        id: anchor[2],
        title: cleanText(anchor[3]),
        postedAt: frenchDate(publishedText),
        deadlineAt: frenchDate(deadlineMatch?.[0]),
        country: normalizedCountry(countryText),
        sourceUrl: canonicalAnetiNodeUrl(anchor[2]),
      };
    })
    .filter((item) => item?.id && item.title);
  const unique = new Map();
  for (const item of parsed) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  return [...unique.values()];
}

export function hasAnetiNextPage(html, currentPage = 0) {
  const source = String(html || "");
  if (/class=["'][^"']*pager__item--next\b/i.test(source) || /rel=["']next["']/i.test(source)) {
    return true;
  }
  return [...source.matchAll(/href=["'][^"']*[?&]page=(\d+)[^"']*["']/gi)].some(
    (match) => Number.parseInt(match[1], 10) > currentPage,
  );
}

function applicationDetails(descriptionHtml, combinedText, sourceUrl) {
  const links = linksFromHtml(descriptionHtml);
  const dedicatedForm = links.find(
    ({ url }) =>
      /^https:\/\/candidatures\.aneti\.tn\//i.test(url) ||
      /aneti-international\.tn\/(?:[a-z]{2}\/)?(?:user|inscription|candidat)/i.test(url),
  )?.url;
  const emailLink = links.find(({ url }) => /^mailto:/i.test(url))?.url;
  const plainEmail = combinedText.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] || "";
  const applicationEmail = emailLink || (plainEmail ? `mailto:${plainEmail}` : "");
  const accountRequired =
    /(?:être|etre|devez|doit)\s+(?:impérativement\s+)?(?:inscrit|connect)|compte\s+candidat|espace\s+candidat|identifi(?:ant|ez-vous)|connexion/i.test(
      fold(combinedText),
    );
  const requirements = [];
  if (/bureau de l[’']emploi/i.test(combinedText))
    requirements.push("Être inscrit au bureau de l’emploi et du travail indépendant");
  if (/inscrit[^\n]{0,30}sur\s+(?:le\s+)?site/i.test(combinedText))
    requirements.push("Disposer d’un compte candidat ANETI International");
  if (/n[°o]\s*cin/i.test(combinedText))
    requirements.push("Utiliser le numéro CIN pour l’inscription et le nom du fichier CV");
  if (/\bcv\b/i.test(combinedText)) requirements.push("Préparer et enregistrer le CV demandé");

  const type = dedicatedForm ? "external_form" : applicationEmail ? "email" : "official_page";
  const url = dedicatedForm || applicationEmail || sourceUrl;

  return {
    applicationMethod: {
      type,
      label: dedicatedForm
        ? accountRequired
          ? "Formulaire officiel + inscription ANETI requise"
          : "Formulaire officiel ANETI"
        : applicationEmail
          ? accountRequired
            ? "Candidature par e-mail + inscription ANETI requise"
            : "Candidature par e-mail"
          : accountRequired
            ? "Connexion à l’espace candidat ANETI requise"
            : "Consulter les instructions officielles",
      url,
      loginRequired: accountRequired,
      note: dedicatedForm
        ? "Le formulaire de candidature est publié directement dans la fiche officielle."
        : applicationEmail
          ? "L’adresse de candidature est publiée dans la fiche officielle ANETI."
          : "La fiche officielle ne publie pas de formulaire séparé vérifié.",
    },
    registrationRequirements: [...new Set(requirements)],
  };
}

export function parseAnetiDetailHtml(html, summary = {}) {
  const title =
    cleanText(elementBlocksByClass(html, "page-title", "h1")[0]) ||
    cleanText(
      String(html).match(
        /<meta\b(?=[^>]*(?:property|name)=["'](?:og:title|title)["'])(?=[^>]*content=["']([^"']+)["'])[^>]*>/i,
      )?.[1],
    ).replace(/\s*\|\s*Aneti.*$/i, "") ||
    cleanText(String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]).replace(
      /\s*\|\s*Aneti.*$/i,
      "",
    ) ||
    summary.title ||
    "Offre ANETI International";
  const descriptionHtml = fieldBlockByAliases(html, [
    "field-description",
    "field-description-poste",
    "body",
  ]);
  const requirementsHtml = fieldBlockByAliases(html, [
    "field-competences-exigees",
    "field-profil-recherche",
    "field-exigences",
  ]);
  const languageText = cleanText(
    fieldBlockByAliases(html, ["field-langue-de-cv-exigee", "field-langue-cv"]),
  )
    .replace(/^Langue de cv exigée\s*/i, "")
    .replace(/\s*Tags\s*:.*$/i, "")
    .trim();
  const speciality = cleanText(
    fieldBlockByAliases(html, ["field-domaine-et-specialite", "field-specialite", "field-domaine"]),
  )
    .replace(/^Domaine de specialité\s*/i, "")
    .trim();
  const detailCountry = cleanText(fieldBlockByAliases(html, ["field-pays", "field-country"]))
    .replace(/^(?:Pays|Country)\s*/i, "")
    .trim();
  const description = cleanText(descriptionHtml).replace(/^Description de poste\s*/i, "");
  const requirements = cleanText(requirementsHtml).replace(/^Profil recherché\s*/i, "");
  const id = String(summary.id || extractAnetiOpportunityId(summary.sourceUrl) || "");
  const sourceUrl = id ? canonicalAnetiNodeUrl(id) : ANETI_LIST_URL;
  const combinedText = `${description}\n${requirements}`;
  const pageText = cleanText(html);
  const postedAt = summary.postedAt || labeledDate(pageText, ["Publié", "Published"]);
  const deadlineAt =
    summary.deadlineAt ||
    labeledDate(pageText, ["Date Fin", "Date limite", "Deadline", "End date"]);
  const country = normalizedCountry(detailCountry || summary.country);
  const missingFields = [
    !title || title === "Offre ANETI International" ? "title" : "",
    !country ? "country" : "",
    !description && !requirements ? "content" : "",
  ].filter(Boolean);

  return {
    id,
    title,
    country,
    postedAt: postedAt || null,
    deadlineAt: deadlineAt || null,
    description,
    requirements,
    cvLanguage: languageText,
    speciality,
    sourceUrl,
    ...applicationDetails(`${descriptionHtml}\n${requirementsHtml}`, combinedText, sourceUrl),
    dataQuality: {
      status: missingFields.length ? "partial" : "complete",
      missingFields,
    },
    checkedAt: new Date().toISOString(),
  };
}

function validateAnetiFetchUrl(value) {
  const url = new URL(value, ANETI_BASE_URL);
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !/(^|\.)aneti-international\.tn$/.test(hostname)) {
    throw new Error("URL ANETI non autorisée.");
  }
  return url.toString();
}

function retryDelay(response, attempt) {
  const retryAfter = Number.parseInt(response?.headers?.get("Retry-After") || "", 10);
  if (Number.isFinite(retryAfter)) return Math.min(2_000, Math.max(0, retryAfter * 1000));
  return 200 * 2 ** attempt;
}

async function wait(milliseconds) {
  if (milliseconds <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchAnetiHtml(url, fetcher = fetch) {
  const safeUrl = validateAnetiFetchUrl(url);
  let lastError;
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetcher(safeUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "fr-FR,fr;q=0.9",
          "User-Agent": "ZGR-CV-Opportunity-Monitor/2.0 (+https://abdou677778.github.io/zgr-cv/)",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      const finalUrl = response.url ? validateAnetiFetchUrl(response.url) : safeUrl;
      if (response.ok) {
        const contentType = response.headers.get("Content-Type") || "";
        if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
          throw new Error(`ANETI a renvoyé un contenu inattendu (${contentType}).`);
        }
        const declaredLength = Number.parseInt(response.headers.get("Content-Length") || "", 10);
        if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_BYTES) {
          throw new Error("La page ANETI dépasse la taille maximale autorisée.");
        }
        const body = await response.text();
        if (new TextEncoder().encode(body).byteLength > MAX_HTML_BYTES) {
          throw new Error("La page ANETI dépasse la taille maximale autorisée.");
        }
        if (!body.trim()) throw new Error("ANETI a renvoyé une page vide.");
        return { body, finalUrl };
      }
      lastError = new Error(`ANETI a répondu ${response.status} pour ${safeUrl}.`);
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status)) break;
      await wait(retryDelay(response, attempt));
    } catch (error) {
      lastError = error;
      if (attempt + 1 < FETCH_ATTEMPTS) await wait(200 * 2 ** attempt);
    }
  }
  throw lastError || new Error(`ANETI est momentanément indisponible pour ${safeUrl}.`);
}

async function fetchText(url) {
  return (await fetchAnetiHtml(url)).body;
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

export async function refreshAnetiOpportunityCache(env) {
  const attemptedAt = new Date().toISOString();
  const [previousCache, previousHealth] = await Promise.all([
    readJsonObject(env, CACHE_KEY),
    readJsonObject(env, HEALTH_KEY),
  ]);
  try {
    const summaries = new Map();
    for (let page = 0; page < MAX_LIST_PAGES && summaries.size < MAX_DETAILS; page += 1) {
      const html = await fetchText(`${ANETI_LIST_URL}?page=${page}`);
      const rows = parseAnetiListHtml(html);
      const sizeBefore = summaries.size;
      for (const row of rows) summaries.set(row.id, row);
      if (!rows.length || summaries.size === sizeBefore || !hasAnetiNextPage(html, page)) break;
    }
    if (!summaries.size) throw new Error("ANETI n’a renvoyé aucune offre publique.");
    const selected = [...summaries.values()].slice(0, MAX_DETAILS);
    const settled = await settleWithConcurrency(selected, DETAIL_CONCURRENCY, async (summary) =>
      parseAnetiDetailHtml(await fetchText(summary.sourceUrl), summary),
    );
    const previousById = new Map(
      (Array.isArray(previousCache?.opportunities) ? previousCache.opportunities : []).map(
        (item) => [String(item.id), item],
      ),
    );
    const detailFailureIds = [];
    const opportunities = settled
      .map((result, index) => {
        if (result.status === "fulfilled") return result.value;
        const summary = selected[index];
        detailFailureIds.push(summary.id);
        const previous = previousById.get(String(summary.id));
        return previous ? { ...previous, staleDetail: true } : null;
      })
      .filter(Boolean)
      .sort((left, right) => Date.parse(right.postedAt || "") - Date.parse(left.postedAt || ""));
    const freshDetails = settled.filter((result) => result.status === "fulfilled").length;
    if (!freshDetails) throw new Error("Les fiches ANETI n’ont pas pu être vérifiées.");
    if (!previousById.size && freshDetails / selected.length < 0.5) {
      throw new Error("Trop de fiches ANETI sont illisibles pour publier une mise à jour fiable.");
    }
    const payload = {
      version: CACHE_VERSION,
      fetchedAt: new Date().toISOString(),
      scanned: summaries.size,
      freshDetails,
      detailFailures: detailFailureIds.length,
      detailFailureIds,
      opportunities,
    };
    await Promise.all([
      writeJsonObject(env, CACHE_KEY, payload),
      writeJsonObject(env, HEALTH_KEY, {
        state: payload.detailFailures ? "warning" : "healthy",
        lastAttemptAt: attemptedAt,
        lastSuccessAt: payload.fetchedAt,
        opportunities: opportunities.length,
        scanned: summaries.size,
        freshDetails,
        detailFailures: payload.detailFailures,
        detailFailureIds,
        consecutiveFailures: 0,
        sourceUrl: ANETI_LIST_URL,
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
      message: error instanceof Error ? error.message : "Échec de la source ANETI.",
      sourceUrl: ANETI_LIST_URL,
    });
    throw error;
  }
}

async function latestAnetiOpportunities(env) {
  const cached = await readJsonObject(env, CACHE_KEY);
  if (
    cached?.version === CACHE_VERSION &&
    Array.isArray(cached.opportunities) &&
    timestampAge(cached.fetchedAt) < CACHE_TTL_MS
  )
    return cached;
  try {
    return await refreshAnetiOpportunityCache(env);
  } catch (error) {
    if (
      cached?.version === CACHE_VERSION &&
      Array.isArray(cached.opportunities) &&
      timestampAge(cached.fetchedAt) <= MAX_STALE_MS
    )
      return {
        ...cached,
        stale: true,
        staleReason: error instanceof Error ? error.message : "Actualisation ANETI échouée.",
      };
    throw error;
  }
}

function isDeadlineOpen(value, now = Date.now()) {
  if (!value) return true;
  const deadline = Date.parse(value);
  return !Number.isFinite(deadline) || deadline + 24 * 60 * 60 * 1000 > now;
}

function parseLimit(value, fallback = 18) {
  const parsed = Number.parseInt(String(value || fallback), 10);
  return Math.min(40, Math.max(1, Number.isFinite(parsed) ? parsed : fallback));
}

export async function searchAnetiOpportunities(env, options = {}) {
  const payload = await latestAnetiOpportunities(env);
  const query = fold(options.query);
  const queryTokens = query.split(/[^a-z0-9]+/).filter(Boolean);
  const period = options.period === "week" ? "week" : "recent";
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const matches = payload.opportunities
    .filter((item) => isDeadlineOpen(item.deadlineAt))
    .filter((item) => period !== "week" || Date.parse(item.postedAt || "") >= weekAgo)
    .filter((item) => {
      if (!query) return true;
      const searchable = fold(
        [
          item.id,
          item.title,
          item.country,
          item.description,
          item.requirements,
          item.speciality,
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
      verifiedAt: payload.fetchedAt,
      stale: payload.stale === true,
      staleReason: payload.staleReason || null,
      cacheAgeMinutes: Math.round(timestampAge(payload.fetchedAt) / 60_000),
      detailFailures: Number(payload.detailFailures || 0),
      sourceUrl: ANETI_LIST_URL,
      methodology:
        "Liste paginée et fiches publiques ANETI International vérifiées séparément, avec nouvelles tentatives réseau, contrôle de structure et cache de secours limité à sept jours. Les exigences de compte, CIN, CV, e-mail et formulaire sont extraites de chaque fiche officielle.",
    },
  };
}

export async function inspectAnetiOpportunity(env, idOrUrl) {
  const id = extractAnetiOpportunityId(idOrUrl);
  if (!id) throw new Error("Lien ou identifiant ANETI invalide.");
  const payload = await latestAnetiOpportunities(env);
  const cached = payload.opportunities.find((item) => String(item.id) === id);
  const summary = cached || { id, sourceUrl: canonicalAnetiNodeUrl(id) };
  try {
    const opportunity = parseAnetiDetailHtml(await fetchText(canonicalAnetiNodeUrl(id)), summary);
    return {
      opportunity: { ...opportunity, open: isDeadlineOpen(opportunity.deadlineAt) },
      meta: {
        verifiedAt: opportunity.checkedAt,
        live: true,
        sourceUrl: opportunity.sourceUrl,
        methodology: "Fiche ANETI officielle relue à la demande depuis son URL publique.",
      },
    };
  } catch (error) {
    if (!cached) throw error;
    return {
      opportunity: {
        ...cached,
        staleDetail: true,
        open: isDeadlineOpen(cached.deadlineAt),
      },
      meta: {
        verifiedAt: cached.checkedAt || payload.fetchedAt,
        live: false,
        sourceUrl: cached.sourceUrl,
        warning:
          "La relecture en direct a échoué ; cette réponse provient du dernier cache vérifié.",
        methodology: "Cache ANETI vérifié utilisé temporairement après échec de relecture.",
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

export async function handleAnetiOpportunityApi(request, env, origin) {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/aneti-opportunities/search" && request.method === "GET") {
      return apiJson(
        await searchAnetiOpportunities(env, {
          period: url.searchParams.get("period") || "recent",
          query: url.searchParams.get("q") || "",
          limit: url.searchParams.get("limit") || "18",
        }),
        200,
        origin,
      );
    }
    if (url.pathname === "/api/aneti-opportunities/inspect" && request.method === "GET") {
      return apiJson(
        await inspectAnetiOpportunity(
          env,
          url.searchParams.get("url") || url.searchParams.get("id"),
        ),
        200,
        origin,
      );
    }
    if (url.pathname === "/api/aneti-opportunities/health" && request.method === "GET") {
      return apiJson(
        (await readJsonObject(env, HEALTH_KEY)) || { state: "collecting" },
        200,
        origin,
      );
    }
    return apiJson({ error: "Route ANETI introuvable." }, 404, origin);
  } catch (error) {
    return apiJson(
      { error: error instanceof Error ? error.message : "Recherche ANETI indisponible." },
      502,
      origin,
    );
  }
}
