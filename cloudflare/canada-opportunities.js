const JOB_BANK_SEARCH_URL =
  "https://www.jobbank.gc.ca/jobsearch/jobsearch?fglo=1&sort=M&wbdisable=true";
const JOB_BANK_FOREIGN_CANDIDATES_URL = "https://www.jobbank.gc.ca/findajob/foreign-candidates";
const INDEED_SEARCH_URL =
  "https://ca.indeed.com/q-foreign-candidates-outside-canada-jobs.html?sort=date";
const CACHE_KEY = "public-cache/canada-international-jobs-latest.json";
const HEALTH_KEY = "system/monitoring/canada-opportunities.json";
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const CACHE_VERSION = 9;
const MAX_DETAILS = 18;

const CANDIDATE_COUNTRIES = {
  DZ: "Algérie",
  TN: "Tunisie",
};

function decodeHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fold(value) {
  return decodeHtml(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || "").replaceAll("&amp;", "&"));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function firstMatch(source, pattern) {
  return String(source || "").match(pattern)?.[1] || "";
}

function textForClass(source, className) {
  const match = String(source || "").match(
    new RegExp(
      `<([a-z][\\w:-]*)\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
      "i",
    ),
  );
  return decodeHtml(match?.[2] || "");
}

function isoDate(value) {
  const raw = String(value || "")
    .replace(/^\s*Posted on\s*/i, "")
    .trim();
  if (!raw) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}T00:00:00Z`
    : /^[A-Za-z]+\s+\d{1,2},\s+\d{4}$/.test(raw)
      ? `${raw} 00:00:00 GMT`
      : raw;
  const parsed = Date.parse(dateOnly);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function parseJobBankSearchHtml(html) {
  const jobs = [];
  const source = String(html || "");
  for (const match of source.matchAll(
    /<article\s+id=["']article-(\d+)["'][^>]*>([\s\S]*?)<\/article>/gi,
  )) {
    const id = match[1];
    const article = match[2];
    const href = firstMatch(
      article,
      /<a[^>]+href=["']([^"']*\/jobsearch\/jobposting(?:tfw)?\/\d+[^"']*)["']/i,
    );
    const usesTemporaryWorkerPath = /\/jobpostingtfw\//i.test(href);
    jobs.push({
      id,
      title: textForClass(article, "noctitle") || `Offre ${id}`,
      employer: textForClass(article, "business"),
      location: textForClass(article, "location").replace(/^Location\s*/i, ""),
      salary: textForClass(article, "salary").replace(/^Salary\s*/i, ""),
      postedAt: isoDate(textForClass(article, "date")),
      workplace: textForClass(article, "telework"),
      sourceUrl: `https://www.jobbank.gc.ca/jobsearch/${
        usesTemporaryWorkerPath ? "jobpostingtfw" : "jobposting"
      }/${encodeURIComponent(id)}?source=searchresults&wbdisable=true`,
      directApplyAdvertised: /class=["'][^"']*\bappmethod\b/i.test(article),
      lmiaStatus: /LMIA\s+approved/i.test(article)
        ? "approved"
        : /LMIA\s+requested/i.test(article)
          ? "requested"
          : "not_specified",
    });
  }
  return jobs;
}

function propertyText(html, property) {
  return decodeHtml(
    firstMatch(
      html,
      new RegExp(`<[^>]+property=["']${property}["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i"),
    ),
  );
}

export function parseJobBankDetailHtml(html, summary = {}) {
  const source = String(html || "");
  const id = String(summary.id || firstMatch(source, /data-jsjobid=["'](\d+)["']/i)).trim();
  const audience = decodeHtml(
    firstMatch(
      source,
      /<div[^>]+class=["'][^"']*\bjob-audience\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    ),
  );
  const acceptsInternational =
    /other candidates,?\s+with or without a valid Canadian work permit/i.test(audience) ||
    /autres candidat(?:e)?s,?\s+avec ou sans permis de travail canadien valide/i.test(audience);
  const deadlineAt = isoDate(propertyText(source, "validThrough"));
  const detailDescription = propertyText(source, "description");
  const externalBlock = firstMatch(
    source,
    /<div[^>]+class=["'][^"']*\bexternal-job\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  );
  const externalUrl = safeExternalUrl(firstMatch(externalBlock, /<a[^>]+href=["']([^"']+)["']/i));
  const hasDirectApply = /id=["']btn-direct-apply["']/i.test(source);
  const applicationMethod = externalUrl
    ? {
        type: "company_site",
        label: "Site officiel de l’employeur",
        url: externalUrl,
        loginRequired: false,
        note: "Candidature externe : aucun compte Indeed ou Guichet-Emplois requis pour ouvrir le formulaire.",
      }
    : hasDirectApply
      ? {
          type: "job_bank_direct",
          label: "Candidature directe Guichet-Emplois",
          url: summary.sourceUrl,
          loginRequired: true,
          note: "La candidature directe demande un compte Guichet-Emplois Plus.",
        }
      : {
          type: "public_instructions",
          label: "Consignes publiques sur la fiche",
          url: summary.sourceUrl,
          loginRequired: false,
          note: "Ouvrez « Show how to apply » : l’employeur peut proposer un e-mail ou un formulaire externe.",
        };
  const employerLink = safeExternalUrl(
    firstMatch(
      source,
      /property=["']hiringOrganization["'][\s\S]{0,800}?<a[^>]+href=["']([^"']+)["']/i,
    ),
  );
  const employer = decodeHtml(
    firstMatch(
      source,
      /property=["']hiringOrganization["'][\s\S]{0,1200}?property=["']name["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    ),
  );
  return {
    ...summary,
    id,
    title: propertyText(source, "title") || summary.title || `Offre ${id}`,
    employer: employer || summary.employer || "",
    employerUrl: employerLink,
    description: detailDescription,
    location:
      [propertyText(source, "addressLocality"), propertyText(source, "addressRegion")]
        .filter(Boolean)
        .join(", ") ||
      summary.location ||
      "",
    salary: summary.salary || propertyText(source, "baseSalary") || "",
    employmentType: propertyText(source, "employmentType"),
    postedAt: isoDate(propertyText(source, "datePosted")) || summary.postedAt || null,
    deadlineAt,
    acceptsInternational,
    eligibilityEvidence: acceptsInternational
      ? "L’employeur accepte explicitement les candidats avec ou sans permis de travail canadien valide."
      : "L’admissibilité internationale n’a pas pu être confirmée sur la fiche détaillée.",
    applicationMethod,
    applicationContact: {
      type: applicationMethod.type,
      email: "",
      phone: "",
      url: applicationMethod.url || summary.sourceUrl,
      label: applicationMethod.label,
      details: applicationMethod.note,
      loginRequired: applicationMethod.loginRequired,
    },
    lmiaStatus: /(?:LMIA|EIMT)\s+(?:approved|approuv[ée]e?)/i.test(source)
      ? "approved"
      : /(?:LMIA|EIMT)\s+(?:requested|demand[ée]e?)/i.test(source)
        ? "requested"
        : summary.lmiaStatus || "not_specified",
    checkedAt: new Date().toISOString(),
  };
}

function decodeXmlMarkup(value) {
  return String(value || "")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

export function parseJobBankHowToApplyHtml(html, fallback = {}) {
  const source = decodeXmlMarkup(html);
  const section =
    firstMatch(
      source,
      /<(?:section|div)[^>]+id=["']howtoapply["'][^>]*>([\s\S]*?)<\/(?:section|div)>/i,
    ) || source;
  const email = decodeURIComponent(
    firstMatch(section, /href=["']mailto:([^?"'<\s]+)(?:\?[^"']*)?["']/i),
  )
    .replace(/^mailto:/i, "")
    .trim();
  const phone = decodeURIComponent(
    firstMatch(section, /href=["']tel:([^?"'<\s]+)(?:\?[^"']*)?["']/i),
  ).trim();
  const links = [...section.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => safeExternalUrl(match[1]))
    .filter((url) => url && !/\.jobbank\.gc\.ca\//i.test(url));
  const url = links[0] || "";
  const details = decodeHtml(section)
    .replace(/^How to apply\s*/i, "")
    .slice(0, 800);
  if (email) {
    return {
      type: "email",
      email,
      phone,
      url: `mailto:${email}`,
      label: "Postuler par e-mail",
      details: details || "Envoyez votre candidature à l’adresse publiée par l’employeur.",
      loginRequired: false,
    };
  }
  if (url) {
    return {
      type: "external_form",
      email: "",
      phone,
      url,
      label: "Formulaire officiel de candidature",
      details: details || "Remplissez le formulaire indiqué par l’employeur.",
      loginRequired: false,
    };
  }
  if (phone) {
    return {
      type: "phone",
      email: "",
      phone,
      url: `tel:${phone}`,
      label: "Contacter l’employeur par téléphone",
      details,
      loginRequired: false,
    };
  }
  return {
    type: fallback.type || "public_instructions",
    email: "",
    phone: "",
    url: fallback.url || "",
    label: fallback.label || "Consignes sur la fiche officielle",
    details: details || fallback.note || "Ouvrez la fiche officielle pour voir comment postuler.",
    loginRequired: fallback.loginRequired === true,
  };
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-CA,en;q=0.9,fr-CA;q=0.8",
          "User-Agent": "ZGR-CV-Canada-Opportunities/1.0 (+https://abdou677778.github.io/zgr-cv/)",
        },
        cf: { cacheTtl: 900, cacheEverything: true },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return response.text();
      lastError = new Error(`Guichet-Emplois HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
  }
  throw lastError instanceof Error ? lastError : new Error("Guichet-Emplois indisponible.");
}

function responseCookie(response) {
  const raw = response.headers.get("set-cookie") || "";
  return raw
    .split(/,(?=\s*[^;,=]+=)/)
    .map((cookie) => cookie.split(";", 1)[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function fetchJobBankDocument(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-CA,en;q=0.9,fr-CA;q=0.8",
          "Cache-Control": "no-cache",
          "User-Agent": "ZGR-CV-Canada-Opportunities/1.0 (+https://abdou677778.github.io/zgr-cv/)",
        },
        cf: { cacheTtl: 0, cacheEverything: false },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok)
        return {
          html: await response.text(),
          responseUrl: response.url || url,
          cookie: responseCookie(response),
        };
      lastError = new Error(`Guichet-Emplois HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
  }
  throw lastError instanceof Error ? lastError : new Error("Fiche Guichet-Emplois indisponible.");
}

function inputValue(html, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return decodeXmlMarkup(
    firstMatch(
      html,
      new RegExp(`<input[^>]+name=["']${escaped}["'][^>]+value=["']([^"']*)["']`, "i"),
    ) ||
      firstMatch(
        html,
        new RegExp(`<input[^>]+value=["']([^"']*)["'][^>]+name=["']${escaped}["']`, "i"),
      ),
  );
}

async function fetchHowToApply(document, jobId, fallback) {
  const action = decodeXmlMarkup(
    firstMatch(document.html, /<form[^>]+id=["']seekeractivity["'][^>]+action=["']([^"']+)["']/i),
  );
  if (!action) return parseJobBankHowToApplyHtml("", fallback);
  // The official page replaces the static JSF form action with window.location.href
  // immediately before sending the partial request.
  const endpoint = document.responseUrl;
  const viewState = inputValue(document.html, "jakarta.faces.ViewState") || "stateless";
  const body = new URLSearchParams({
    "jakarta.faces.partial.ajax": "true",
    "jakarta.faces.source": "seekeractivity",
    "jakarta.faces.partial.execute": "jobid",
    "jakarta.faces.partial.render": "applynow markappliedgroup",
    "jakarta.faces.partial.event": "click",
    "jakarta.faces.behavior.event": "action",
    action: "applynowbutton",
    seekeractivity: "seekeractivity",
    "seekeractivity:jobid": String(jobId),
    "jakarta.faces.ViewState": viewState,
  });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/xml, text/xml, */*; q=0.01",
      "Accept-Language": "en-CA,en;q=0.9",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Faces-Request": "partial/ajax",
      Referer: document.responseUrl,
      "User-Agent": "ZGR-CV-Canada-Opportunities/1.0 (+https://abdou677778.github.io/zgr-cv/)",
      "X-Requested-With": "XMLHttpRequest",
      ...(document.cookie ? { Cookie: document.cookie } : {}),
    },
    body: body.toString(),
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Guichet-Emplois candidature HTTP ${response.status}`);
  return parseJobBankHowToApplyHtml(await response.text(), fallback);
}

async function readJsonObject(env, key) {
  if (!env?.CLIENTS_BUCKET) return null;
  const object = await env.CLIENTS_BUCKET.get(key);
  if (!object) return null;
  try {
    return JSON.parse(await object.text());
  } catch {
    return null;
  }
}

async function writeJsonObject(env, key, payload) {
  if (!env?.CLIENTS_BUCKET) return;
  await env.CLIENTS_BUCKET.put(key, JSON.stringify(payload), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function mapSettledWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: "fulfilled", value: await mapper(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export async function refreshCanadaOpportunityCache(env) {
  const attemptedAt = new Date().toISOString();
  try {
    const searchHtml = await fetchText(JOB_BANK_SEARCH_URL);
    const summaries = parseJobBankSearchHtml(searchHtml).slice(0, MAX_DETAILS);
    if (!summaries.length) throw new Error("Aucune offre trouvée dans la source officielle.");
    const settled = await mapSettledWithConcurrency(summaries, 4, async (summary) => {
      const document = await fetchJobBankDocument(summary.sourceUrl);
      const opportunity = parseJobBankDetailHtml(document.html, summary);
      let applicationContact = opportunity.applicationContact;
      try {
        applicationContact = await fetchHowToApply(
          document,
          opportunity.id,
          opportunity.applicationMethod,
        );
      } catch {
        // The public listing remains usable when the optional JSF contact panel is unavailable.
      }
      const applicationMethod = {
        type: applicationContact.type,
        label: applicationContact.label,
        url: applicationContact.url || opportunity.applicationMethod.url,
        loginRequired: applicationContact.loginRequired,
        note: applicationContact.details || opportunity.applicationMethod.note,
      };
      return { ...opportunity, applicationContact, applicationMethod };
    });
    const opportunities = settled
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value)
      .filter((job) => job.acceptsInternational)
      .sort((left, right) => Date.parse(right.postedAt || "") - Date.parse(left.postedAt || ""));
    if (!opportunities.length)
      throw new Error("Aucune offre n’a confirmé l’admissibilité internationale.");
    const fetchedAt = new Date().toISOString();
    const payload = {
      version: CACHE_VERSION,
      fetchedAt,
      sourceUrl: JOB_BANK_SEARCH_URL,
      scanned: summaries.length,
      detailFailures: settled.filter((result) => result.status === "rejected").length,
      opportunities,
    };
    await Promise.all([
      writeJsonObject(env, CACHE_KEY, payload),
      writeJsonObject(env, HEALTH_KEY, {
        state: payload.detailFailures ? "warning" : "healthy",
        lastAttemptAt: attemptedAt,
        lastSuccessAt: fetchedAt,
        opportunities: opportunities.length,
        scanned: summaries.length,
        detailFailures: payload.detailFailures,
        sourceUrl: JOB_BANK_SEARCH_URL,
      }),
    ]);
    return payload;
  } catch (error) {
    const previous = (await readJsonObject(env, HEALTH_KEY)) || {};
    await writeJsonObject(env, HEALTH_KEY, {
      ...previous,
      state: "critical",
      lastAttemptAt: attemptedAt,
      lastFailureAt: attemptedAt,
      message: error instanceof Error ? error.message : "Échec de la source officielle.",
      sourceUrl: JOB_BANK_SEARCH_URL,
    });
    throw error;
  }
}

async function latestCanadaOpportunities(env) {
  const cached = await readJsonObject(env, CACHE_KEY);
  if (
    cached?.version === CACHE_VERSION &&
    Array.isArray(cached.opportunities) &&
    Date.now() - Date.parse(cached.fetchedAt || "") < CACHE_TTL_MS
  )
    return cached;
  try {
    return await refreshCanadaOpportunityCache(env);
  } catch (error) {
    if (cached?.version === CACHE_VERSION && Array.isArray(cached.opportunities))
      return { ...cached, stale: true };
    throw error;
  }
}

function candidateCountry(value) {
  const code = String(value || "DZ")
    .trim()
    .toUpperCase();
  return CANDIDATE_COUNTRIES[code] ? code : "DZ";
}

function parseLimit(value, fallback = 18) {
  const parsed = Number.parseInt(String(value || fallback), 10);
  return Math.min(30, Math.max(1, Number.isFinite(parsed) ? parsed : fallback));
}

export async function searchCanadaOpportunities(env, options = {}) {
  const payload = await latestCanadaOpportunities(env);
  const country = candidateCountry(options.country);
  const query = fold(options.query);
  const period = options.period === "week" ? "week" : "recent";
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const matches = payload.opportunities
    .filter((job) => !job.deadlineAt || Date.parse(job.deadlineAt) >= Date.now())
    .filter((job) => period !== "week" || Date.parse(job.postedAt || "") >= weekAgo)
    .filter((job) => {
      if (!query) return true;
      return fold(
        [job.title, job.employer, job.location, job.description, job.employmentType].join(" "),
      ).includes(query);
    });
  const limit = parseLimit(options.limit);
  return {
    opportunities: matches.slice(0, limit).map((job) => ({
      ...job,
      candidateCountry: { code: country, name: CANDIDATE_COUNTRIES[country] },
    })),
    sources: {
      jobBank: {
        name: "Guichet-Emplois Canada",
        url: JOB_BANK_FOREIGN_CANDIDATES_URL,
        automated: true,
      },
      indeed: {
        name: "Indeed Canada",
        url: INDEED_SEARCH_URL,
        automated: false,
        reason: "Indeed interdit le scraping automatisé sans autorisation écrite.",
      },
    },
    meta: {
      country: { code: country, name: CANDIDATE_COUNTRIES[country] },
      period,
      returned: Math.min(limit, matches.length),
      totalMatches: matches.length,
      scanned: payload.scanned,
      verifiedAt: payload.fetchedAt,
      stale: payload.stale === true,
      sourceUrl: JOB_BANK_SEARCH_URL,
      methodology:
        "Chaque fiche est ouverte et conservée uniquement si elle accepte explicitement les candidats avec ou sans permis canadien valide.",
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

export async function handleCanadaOpportunityApi(request, env, origin) {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/canada-opportunities/search" && request.method === "GET") {
      return apiJson(
        await searchCanadaOpportunities(env, {
          country: url.searchParams.get("country") || "DZ",
          period: url.searchParams.get("period") || "recent",
          query: url.searchParams.get("q") || "",
          limit: url.searchParams.get("limit") || "18",
        }),
        200,
        origin,
      );
    }
    if (url.pathname === "/api/canada-opportunities/health" && request.method === "GET") {
      return apiJson(
        (await readJsonObject(env, HEALTH_KEY)) || { state: "collecting" },
        200,
        origin,
      );
    }
    return apiJson({ error: "Route opportunités Canada introuvable." }, 404, origin);
  } catch (error) {
    return apiJson(
      { error: error instanceof Error ? error.message : "Recherche Canada indisponible." },
      502,
      origin,
    );
  }
}
