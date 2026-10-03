const ANETI_BASE_URL = "https://aneti-international.tn";
const ANETI_LIST_URL = `${ANETI_BASE_URL}/offres`;
const CACHE_KEY = "public-cache/aneti-international-jobs-latest.json";
const HEALTH_KEY = "system/monitoring/aneti-opportunities.json";
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const MAX_LIST_PAGES = 5;
const MAX_DETAILS = 40;

const COUNTRY_ALIASES = new Map([
  ["italie", "Italie"],
  ["arabie saoudite", "Arabie saoudite"],
  ["france", "France"],
  ["allemagne", "Allemagne"],
  ["canada", "Canada"],
  ["qatar", "Qatar"],
  ["emirats arabes unis", "Émirats arabes unis"],
]);

function decodeHtml(value = "") {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function cleanText(value = "") {
  return decodeHtml(
    String(value)
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

function frenchDate(value) {
  const match = String(value || "").match(
    /(?:\b(?:lun|mar|mer|jeu|ven|sam|dim)\w*\s+)?(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*-\s*(\d{1,2}):(\d{2}))?/i,
  );
  if (!match) return null;
  const [, day, month, year, hour = "00", minute = "00"] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:00+01:00`;
}

function fieldBlock(html, fieldName) {
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
    .map((match) => absoluteUrl(match[1]))
    .filter(Boolean);
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
  const rows =
    String(html).match(
      /<div class="views-row">[\s\S]*?(?=<div class="views-row">|<nav class="pager")/gi,
    ) || [];
  return rows
    .map((row) => {
      const anchor = row.match(/<a\b[^>]*href=["']\/node\/(\d+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (!anchor) return null;
      const text = cleanText(row).replace(/\s+/g, " ");
      const publishedText = text.match(/Publié\s*:\s*([\s\S]*?)(?=Date\s*Fin\s*:)/i)?.[1] || "";
      const tail = text.match(/Date\s*Fin\s*:\s*([\s\S]*)$/i)?.[1]?.trim() || "";
      const deadlineMatch = tail.match(
        /(?:\b(?:lun|mar|mer|jeu|ven|sam|dim)\w*\s+)?\d{1,2}\/\d{1,2}\/\d{4}(?:\s*-\s*\d{1,2}:\d{2})?/i,
      );
      const countryText = deadlineMatch ? tail.slice(deadlineMatch[0].length).trim() : tail;
      return {
        id: anchor[1],
        title: cleanText(anchor[2]),
        postedAt: frenchDate(publishedText),
        deadlineAt: frenchDate(deadlineMatch?.[0]),
        country: normalizedCountry(countryText),
        sourceUrl: `${ANETI_BASE_URL}/node/${anchor[1]}`,
      };
    })
    .filter(Boolean);
}

function applicationDetails(descriptionHtml, combinedText, sourceUrl) {
  const links = linksFromHtml(descriptionHtml);
  const dedicatedForm = links.find((url) => /\/app\/inscription\//i.test(url));
  const accountRequired =
    /inscrit(?:e|\.e)?\s+(?:au|sur)|inscription|n[°o]\s*cin|espace candidat/i.test(combinedText);
  const requirements = [];
  if (/bureau de l[’']emploi/i.test(combinedText))
    requirements.push("Être inscrit au bureau de l’emploi et du travail indépendant");
  if (/inscrit[^\n]{0,30}sur\s+(?:le\s+)?site/i.test(combinedText))
    requirements.push("Disposer d’un compte candidat ANETI International");
  if (/n[°o]\s*cin/i.test(combinedText))
    requirements.push("Utiliser le numéro CIN pour l’inscription et le nom du fichier CV");
  if (/\bcv\b/i.test(combinedText)) requirements.push("Préparer et enregistrer le CV demandé");

  return {
    applicationMethod: {
      type: dedicatedForm ? "external_form" : "official_page",
      label: dedicatedForm
        ? accountRequired
          ? "Formulaire officiel + inscription ANETI requise"
          : "Formulaire officiel ANETI"
        : accountRequired
          ? "Connexion à l’espace candidat ANETI requise"
          : "Consulter les instructions officielles",
      url: dedicatedForm || sourceUrl,
      loginRequired: accountRequired,
      note: dedicatedForm
        ? "Le formulaire de candidature est publié directement dans la fiche officielle."
        : "La fiche officielle ne publie pas de formulaire séparé vérifié.",
    },
    registrationRequirements: [...new Set(requirements)],
  };
}

export function parseAnetiDetailHtml(html, summary = {}) {
  const title =
    cleanText(String(html).match(/<h1[^>]*class="page-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ||
    cleanText(String(html).match(/<meta\s+name="title"\s+content="([^"]+)"/i)?.[1]).replace(
      /\s*\|\s*Aneti.*$/i,
      "",
    ) ||
    summary.title ||
    "Offre ANETI International";
  const descriptionHtml = fieldBlock(html, "field-description");
  const requirementsHtml = fieldBlock(html, "field-competences-exigees");
  const languageText = cleanText(fieldBlock(html, "field-langue-de-cv-exigee"))
    .replace(/^Langue de cv exigée\s*/i, "")
    .replace(/\s*Tags\s*:.*$/i, "")
    .trim();
  const speciality = cleanText(fieldBlock(html, "field-domaine-et-specialite"))
    .replace(/^Domaine de specialité\s*/i, "")
    .trim();
  const detailCountry = cleanText(fieldBlock(html, "field-pays")).replace(/^Pays\s*/i, "");
  const description = cleanText(descriptionHtml).replace(/^Description de poste\s*/i, "");
  const requirements = cleanText(requirementsHtml).replace(/^Profil recherché\s*/i, "");
  const sourceUrl = summary.sourceUrl || `${ANETI_BASE_URL}/node/${summary.id || ""}`;
  const combinedText = `${description}\n${requirements}`;

  return {
    id: String(summary.id || sourceUrl.match(/\/node\/(\d+)/)?.[1] || ""),
    title,
    country: normalizedCountry(detailCountry || summary.country),
    postedAt: summary.postedAt || null,
    deadlineAt: summary.deadlineAt || null,
    description,
    requirements,
    cvLanguage: languageText,
    speciality,
    sourceUrl,
    ...applicationDetails(descriptionHtml, combinedText, sourceUrl),
    checkedAt: new Date().toISOString(),
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "ZGR-CV-Opportunity-Monitor/1.0 (+https://abdou677778.github.io/zgr-cv/)",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`ANETI a répondu ${response.status} pour ${url}.`);
  return response.text();
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

export async function refreshAnetiOpportunityCache(env) {
  const attemptedAt = new Date().toISOString();
  try {
    const summaries = new Map();
    for (let page = 0; page < MAX_LIST_PAGES && summaries.size < MAX_DETAILS; page += 1) {
      const html = await fetchText(`${ANETI_LIST_URL}?page=${page}`);
      const rows = parseAnetiListHtml(html);
      for (const row of rows) summaries.set(row.id, row);
      if (rows.length < 10) break;
    }
    if (!summaries.size) throw new Error("ANETI n’a renvoyé aucune offre publique.");
    const selected = [...summaries.values()].slice(0, MAX_DETAILS);
    const settled = await Promise.allSettled(
      selected.map(async (summary) =>
        parseAnetiDetailHtml(await fetchText(summary.sourceUrl), summary),
      ),
    );
    const opportunities = settled
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value)
      .sort((left, right) => Date.parse(right.postedAt || "") - Date.parse(left.postedAt || ""));
    if (!opportunities.length) throw new Error("Les fiches ANETI n’ont pas pu être vérifiées.");
    const payload = {
      version: CACHE_VERSION,
      fetchedAt: new Date().toISOString(),
      scanned: summaries.size,
      detailFailures: settled.length - opportunities.length,
      opportunities,
    };
    await Promise.all([
      writeJsonObject(env, CACHE_KEY, payload),
      writeJsonObject(env, HEALTH_KEY, {
        state: payload.detailFailures ? "warning" : "healthy",
        lastAttemptAt: attemptedAt,
        lastSuccessAt: payload.fetchedAt,
        opportunities: opportunities.length,
        detailFailures: payload.detailFailures,
        sourceUrl: ANETI_LIST_URL,
      }),
    ]);
    return payload;
  } catch (error) {
    await writeJsonObject(env, HEALTH_KEY, {
      state: "critical",
      lastAttemptAt: attemptedAt,
      lastFailureAt: attemptedAt,
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
    Date.now() - Date.parse(cached.fetchedAt || "") < CACHE_TTL_MS
  )
    return cached;
  try {
    return await refreshAnetiOpportunityCache(env);
  } catch (error) {
    if (cached?.version === CACHE_VERSION && Array.isArray(cached.opportunities))
      return { ...cached, stale: true };
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
      sourceUrl: ANETI_LIST_URL,
      methodology:
        "Liste et fiches publiques ANETI International vérifiées séparément. Les exigences de compte, CIN, CV et formulaire sont extraites de chaque fiche officielle.",
    },
  };
}

export async function inspectAnetiOpportunity(env, idOrUrl) {
  const id = String(idOrUrl || "").match(/(?:\/node\/)?(\d{4,})/i)?.[1];
  if (!id) throw new Error("Lien ou identifiant ANETI invalide.");
  const payload = await latestAnetiOpportunities(env);
  const cached = payload.opportunities.find((item) => String(item.id) === id);
  const summary = cached || { id, sourceUrl: `${ANETI_BASE_URL}/node/${id}` };
  const opportunity = parseAnetiDetailHtml(await fetchText(summary.sourceUrl), summary);
  return {
    opportunity: { ...opportunity, open: isDeadlineOpen(opportunity.deadlineAt) },
    meta: {
      verifiedAt: opportunity.checkedAt,
      sourceUrl: opportunity.sourceUrl,
      methodology: "Fiche ANETI officielle relue à la demande depuis son URL publique.",
    },
  };
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
