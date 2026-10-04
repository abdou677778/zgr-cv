const TELEGRAM_CHANNEL = "rcrdz1";
const TELEGRAM_CHANNEL_URL = `https://t.me/${TELEGRAM_CHANNEL}`;
const CACHE_KEY = "public-cache/algeria-telegram-jobs-latest.json";
const HEALTH_KEY = "system/monitoring/algeria-opportunities.json";
const CACHE_VERSION = 2;
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const SEED_POST_ID = 22072;
const INITIAL_HISTORY_SIZE = 8;
// Keep a full refresh under the 50 subrequest limit of a free Cloudflare Worker:
// at most 18 post pages plus 6 optional date lookups. Small batches also stay
// inside the CPU allowance of a free Worker; the high-water mark resumes later.
const MAX_FORWARD_REQUESTS = 18;
const MAX_DATE_LOOKUPS = 6;
const STOP_AFTER_MISSES = 4;
const MAX_CACHED_OPPORTUNITIES = 120;
const REQUEST_TIMEOUT_MS = 9_000;
const MAX_HTML_BYTES = 1_500_000;

export const ALGERIA_WILAYAS = [
  "Adrar",
  "Chlef",
  "Laghouat",
  "Oum El Bouaghi",
  "Batna",
  "Béjaïa",
  "Biskra",
  "Béchar",
  "Blida",
  "Bouira",
  "Tamanrasset",
  "Tébessa",
  "Tlemcen",
  "Tiaret",
  "Tizi Ouzou",
  "Alger",
  "Djelfa",
  "Jijel",
  "Sétif",
  "Saïda",
  "Skikda",
  "Sidi Bel Abbès",
  "Annaba",
  "Guelma",
  "Constantine",
  "Médéa",
  "Mostaganem",
  "M’Sila",
  "Mascara",
  "Ouargla",
  "Oran",
  "El Bayadh",
  "Illizi",
  "Bordj Bou Arréridj",
  "Boumerdès",
  "El Tarf",
  "Tindouf",
  "Tissemsilt",
  "El Oued",
  "Khenchela",
  "Souk Ahras",
  "Tipaza",
  "Mila",
  "Aïn Defla",
  "Naâma",
  "Aïn Témouchent",
  "Ghardaïa",
  "Relizane",
  "Timimoun",
  "Bordj Badji Mokhtar",
  "Ouled Djellal",
  "Béni Abbès",
  "In Salah",
  "In Guezzam",
  "Touggourt",
  "Djanet",
  "El Meghaier",
  "El Meniaâ",
  "Aflou",
  "Barika",
  "El Kantara",
  "Bir El Ater",
  "El Aricha",
  "Ksar Chellala",
  "Aïn Oussara",
  "Messaad",
  "Ksar El Boukhari",
  "Bou Saâda",
  "El Abiodh Sidi Cheikh",
];

const WILAYA_ALIASES = new Map(
  [
    ["alger", "Alger"],
    ["algiers", "Alger"],
    ["bordj el kiffan", "Alger"],
    ["باب الزوار", "Alger"],
    ["dar el beida", "Alger"],
    ["setif", "Sétif"],
    ["سطيف", "Sétif"],
    ["bejaia", "Béjaïa"],
    ["بجاية", "Béjaïa"],
    ["tebessa", "Tébessa"],
    ["تبسة", "Tébessa"],
    ["saida", "Saïda"],
    ["سعيدة", "Saïda"],
    ["medea", "Médéa"],
    ["المدية", "Médéa"],
    ["msila", "M’Sila"],
    ["m sila", "M’Sila"],
    ["المسيلة", "M’Sila"],
    ["ain defla", "Aïn Defla"],
    ["عين الدفلى", "Aïn Defla"],
    ["ain temouchent", "Aïn Témouchent"],
    ["عين تموشنت", "Aïn Témouchent"],
    ["bordj bou arreridj", "Bordj Bou Arréridj"],
    ["برج بوعريريج", "Bordj Bou Arréridj"],
    ["boumerdes", "Boumerdès"],
    ["بومرداس", "Boumerdès"],
    ["hassi messaoud", "Ouargla"],
    ["ورقلة", "Ouargla"],
    ["ouargla", "Ouargla"],
    ["oran", "Oran"],
    ["وهران", "Oran"],
    ["tlemcen", "Tlemcen"],
    ["تلمسان", "Tlemcen"],
    ["batna", "Batna"],
    ["باتنة", "Batna"],
    ["blida", "Blida"],
    ["البليدة", "Blida"],
    ["constantine", "Constantine"],
    ["قسنطينة", "Constantine"],
    ["annaba", "Annaba"],
    ["عنابة", "Annaba"],
    ["tizi ouzou", "Tizi Ouzou"],
    ["تيزي وزو", "Tizi Ouzou"],
    ["sidi bel abbes", "Sidi Bel Abbès"],
    ["سيدي بلعباس", "Sidi Bel Abbès"],
    ["el meghaier", "El Meghaier"],
    ["el mghair", "El Meghaier"],
    ["المغير", "El Meghaier"],
    ["bou saada", "Bou Saâda"],
    ["بوسعادة", "Bou Saâda"],
    ["ain oussera", "Aïn Oussara"],
    ["عين وسارة", "Aïn Oussara"],
  ].map(([alias, wilaya]) => [fold(alias), wilaya]),
);

for (const wilaya of ALGERIA_WILAYAS) WILAYA_ALIASES.set(fold(wilaya), wilaya);

function fold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function normalizeText(value) {
  return decodeHtml(value)
    .replace(/\r/g, "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function metaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+property=(["'])${escaped}\\1[^>]+content=(["'])([\\s\\S]*?)\\2[^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=(["'])([\\s\\S]*?)\\1[^>]+property=(["'])${escaped}\\3[^>]*>`,
      "i",
    ),
  ];
  for (let index = 0; index < patterns.length; index += 1) {
    const pattern = patterns[index];
    const match = String(html || "").match(pattern);
    const content = index === 0 ? match?.[3] : match?.[2];
    if (content) return normalizeText(content);
  }
  return "";
}

function stripChannelPromotion(text) {
  const markers = [
    "هل تريد زيادة فرص قبولك",
    "نقدم لكم خدمات احترافية",
    "للاستفادة من خدماتنا",
    "تابعوا أحدث عروض العمل",
    "Recrutement DZ —",
    "Recrutement DZ -",
  ];
  let end = text.length;
  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index >= 0) end = Math.min(end, index);
  }
  return normalizeText(text.slice(0, end).replace(/(?:[━═]{5,}|📄)\s*$/gu, ""));
}

function validPostId(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function telegramPostUrl(id) {
  const safeId = validPostId(id);
  if (!safeId) throw new Error("Identifiant Telegram invalide.");
  return `${TELEGRAM_CHANNEL_URL}/${safeId}`;
}

function titleFromText(text, positions, employer) {
  if (positions.length === 1) return positions[0];
  if (positions.length > 1) return `${positions[0]} et ${positions.length - 1} autre(s) poste(s)`;
  const firstUseful = text
    .split("\n")
    .map((line) => line.replace(/^[^\p{L}\p{N}]+/u, "").trim())
    .find(
      (line) =>
        line.length >= 8 && !/^(إعلان توظيف|اعلان توظيف|offre d.emploi|recrutement)$/i.test(line),
    );
  return firstUseful?.slice(0, 140) || employer || "Offre d’emploi en Algérie";
}

function linesAfterHeading(lines, headingPattern, stopPattern) {
  const headingIndex = lines.findIndex((line) => headingPattern.test(fold(line)));
  if (headingIndex < 0) return [];
  const values = [];
  for (let index = headingIndex + 1; index < lines.length && values.length < 12; index += 1) {
    if (/^[━═]{5,}/u.test(lines[index])) break;
    const line = lines[index].replace(/^[^\p{L}\p{N}]+/u, "").trim();
    if (!line) continue;
    if (stopPattern.test(fold(line))) break;
    if (line.length > 2 && line.length < 180) values.push(line);
  }
  return values;
}

function extractPositions(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const heading =
    /(postes?.*(a pourvoir|recherches?|demandes?)|المناصب? المطلوبة|المنصب المطلوب|الوظائف المطلوبة|التخصصات المطلوبة|specialites)/;
  const stop =
    /^(lieu|localisation|مكان|المناطق|regions|الموقع|نظام|profil|الشروط|المهام|candidature|طريقة التقديم|للتقديم|contact)/;
  const block = linesAfterHeading(lines, heading, stop);
  const emojiPositions = lines
    .filter((line) => /^\s*(?:💼|👨‍🍳|👩‍🍳|👨‍🏫|👩‍🏫)/u.test(line))
    .map((line) => line.replace(/^\s*(?:💼|👨‍🍳|👩‍🍳|👨‍🏫|👩‍🏫)\s*/u, "").trim())
    .filter((line) => line.length > 2 && line.length < 180);
  const inline = lines
    .map(
      (line) =>
        line.match(/(?:poste|المنصب)\s*(?:recherché|required|المطلوب)?\s*[:：-]\s*(.+)$/i)?.[1],
    )
    .filter(Boolean);
  const candidates = block.length ? [...block, ...inline] : [...emojiPositions, ...inline];
  return [...new Set(candidates.map(normalizeText))].slice(0, 12);
}

function extractEmployer(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (/^[🏢🏭🏫🏥🏨]/u.test(line)) {
      const value = line.replace(/^[^\p{L}\p{N}]+/u, "").trim();
      if (value.length >= 3 && value.length <= 180) return value;
    }
    const match = line.match(
      /(?:شركة|مؤسسة|مدرسة|عيادة|فندق|company|entreprise|société)\s+(.+?)(?:\s+(?:تعلن|يعلن|recrute|cherche)|[.،]|$)/i,
    );
    if (match?.[1]) return normalizeText(match[1]).slice(0, 180);
  }
  return null;
}

function detectWilayas(text) {
  const searchable = ` ${fold(text)} `;
  const matches = [];
  for (const [alias, wilaya] of WILAYA_ALIASES) {
    const index = searchable.indexOf(` ${alias} `);
    if (index >= 0) {
      matches.push({ alias, wilaya, index });
    }
  }
  matches.sort((left, right) => left.index - right.index || right.alias.length - left.alias.length);
  return [...new Set(matches.map((match) => match.wilaya))];
}

function extractLocation(text, wilayas) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const labelledIndex = lines.findIndex((line) =>
    /(?:مكان العمل|lieu de travail|localisation|location|wilaya|الولاية|المناطق المعنية|régions)\s*(?:\|[^:：]*)?[:：-]/i.test(
      line,
    ),
  );
  const labelled = lines[labelledIndex];
  if (labelled) {
    const value = labelled.replace(/^.*?(?:[:：]|\s[-–—]\s)/, "").trim();
    if (value) return value.slice(0, 180);
    const next = lines[labelledIndex + 1]?.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    if (next && next.length < 180) {
      const locations = [];
      for (
        let index = labelledIndex + 1;
        index < lines.length && locations.length < 12;
        index += 1
      ) {
        if (/^[━═]{5,}/u.test(lines[index])) break;
        const candidate = lines[index].replace(/^[^\p{L}\p{N}]+/u, "").trim();
        if (!candidate) continue;
        if (/^(profil|المهام|الشروط|candidature|طريقة التقديم|للتقديم)/i.test(fold(candidate)))
          break;
        if (candidate.length < 180) locations.push(candidate);
      }
      return locations.join(" · ").slice(0, 500);
    }
  }
  return wilayas.join(" · ") || null;
}

function extractEmails(text) {
  return [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])].slice(0, 5);
}

function extractPhones(text) {
  const matches = text.match(/(?:\+?213|0)[\s.-]?[5-7](?:[\s.-]?\d){8}/g) || [];
  return [...new Set(matches.map((value) => value.replace(/\s+/g, " ").trim()))].slice(0, 5);
}

function extractExternalUrls(text) {
  return [...new Set(text.match(/https?:\/\/[^\s<>]+/gi) || [])]
    .map((url) => url.replace(/[),.;،]+$/u, ""))
    .filter((url) => {
      try {
        const host = new URL(url).hostname.toLowerCase();
        return host !== "t.me" && host !== "telegram.me";
      } catch {
        return false;
      }
    })
    .slice(0, 5);
}

function applicationMethod(text, sourceUrl) {
  const emails = extractEmails(text);
  const phones = extractPhones(text);
  const urls = extractExternalUrls(text);
  if (emails[0]) {
    return {
      type: "email",
      label: "Candidature par e-mail indiquée dans l’annonce",
      url: `mailto:${emails[0]}`,
      email: emails[0],
      phone: phones[0] || null,
      loginRequired: false,
      note: "Vérifiez l’adresse dans la publication Telegram avant l’envoi.",
    };
  }
  if (urls[0]) {
    return {
      type: "external_link",
      label: "Lien de candidature publié dans l’annonce",
      url: urls[0],
      email: null,
      phone: phones[0] || null,
      loginRequired: null,
      note: "Les exigences de connexion dépendent du site destinataire.",
    };
  }
  if (phones[0]) {
    return {
      type: "phone",
      label: "Contact téléphonique indiqué dans l’annonce",
      url: `tel:${phones[0].replace(/[^+\d]/g, "")}`,
      email: null,
      phone: phones[0],
      loginRequired: false,
      note: "Ne transmettez aucun paiement et vérifiez l’identité de l’employeur.",
    };
  }
  return {
    type: "source_only",
    label: "Consulter la publication pour les modalités",
    url: sourceUrl,
    email: null,
    phone: null,
    loginRequired: null,
    note: "Aucun contact de candidature distinct n’a pu être extrait avec certitude.",
  };
}

function requiredDocuments(text) {
  const folded = fold(text);
  const values = [];
  if (/\bcv\b|سيرة ذاتية/.test(folded)) values.push("CV");
  if (/lettre de motivation|cover letter|رسالة تحفيز/.test(folded))
    values.push("Lettre de motivation");
  if (/diplome|شهادة/.test(folded)) values.push("Diplôme ou certificat");
  if (/experience|خبرة/.test(folded)) values.push("Justificatif d’expérience");
  return values;
}

export function parseTelegramPostHtml(html, id, publishedAt = null) {
  const safeId = validPostId(id);
  if (!safeId) throw new Error("Identifiant Telegram invalide.");
  const canonicalUrl = telegramPostUrl(safeId);
  const pageUrl = metaContent(html, "og:url");
  if (pageUrl && pageUrl !== canonicalUrl) return null;
  const rawDescription = metaContent(html, "og:description");
  if (!rawDescription || /contact @telegram/i.test(rawDescription)) return null;
  const description = stripChannelPromotion(rawDescription);
  if (description.length < 20) return null;
  const positions = extractPositions(description);
  if (
    !positions.length &&
    !/(توظيف|فرصة عمل|recrutement|recrute|offre d.emploi|emploi|job opening)/i.test(description)
  )
    return null;
  const employer = extractEmployer(description);
  const wilayas = detectWilayas(description);
  const wilaya = wilayas[0] || null;
  const location = extractLocation(description, wilayas);
  const method = applicationMethod(description, canonicalUrl);
  const missingFields = [];
  if (!wilaya) missingFields.push("wilaya");
  if (!positions.length) missingFields.push("poste");
  if (method.type === "source_only") missingFields.push("contact_candidature");
  return {
    id: String(safeId),
    title: titleFromText(description, positions, employer),
    employer,
    wilaya,
    wilayas,
    commune: location && location !== wilaya ? location : null,
    location,
    positions,
    description,
    publishedAt,
    sourceUrl: canonicalUrl,
    applicationMethod: method,
    requiredDocuments: requiredDocuments(description),
    dataQuality: {
      status: missingFields.length ? "partial" : "complete",
      missingFields,
    },
    checkedAt: new Date().toISOString(),
  };
}

function assertTelegramUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "t.me")
    throw new Error("Source Telegram non autorisée.");
  if (!new RegExp(`^/${TELEGRAM_CHANNEL}/\\d+$`).test(parsed.pathname))
    throw new Error("Canal Telegram non autorisé.");
}

export async function fetchTelegramHtml(url, fetchImpl = fetch) {
  assertTelegramUrl(url);
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "ZGR-CV-OpportunityMonitor/1.0 (+https://abdou677778.github.io/zgr-cv/)",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      if (response.status === 404) return null;
      if (response.status === 429 || response.status >= 500)
        throw new Error(`Telegram HTTP ${response.status}`);
      if (!response.ok) return null;
      const contentLength = Number(response.headers.get("Content-Length") || 0);
      if (contentLength > MAX_HTML_BYTES) throw new Error("Réponse Telegram trop volumineuse.");
      const body = await response.text();
      if (body.length > MAX_HTML_BYTES) throw new Error("Réponse Telegram trop volumineuse.");
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 40 * 2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error("Telegram est momentanément indisponible.");
}

function publishedAtFromEmbed(html) {
  const match = String(html || "").match(/<time[^>]+datetime=["']([^"']+)["']/i);
  if (!match?.[1]) return null;
  const timestamp = Date.parse(decodeHtml(match[1]));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
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

function timestampAge(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp)
    ? Math.max(0, Date.now() - timestamp)
    : Number.POSITIVE_INFINITY;
}

async function settleWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: "fulfilled", value: await task(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchPost(id) {
  const body = await fetchTelegramHtml(telegramPostUrl(id));
  if (!body) return null;
  return parseTelegramPostHtml(body, id);
}

export async function refreshAlgeriaOpportunityCache(env) {
  const attemptedAt = new Date().toISOString();
  const [previousCache, previousHealth] = await Promise.all([
    readJsonObject(env, CACHE_KEY),
    readJsonObject(env, HEALTH_KEY),
  ]);
  const previousItems =
    previousCache?.version === CACHE_VERSION && Array.isArray(previousCache?.opportunities)
      ? previousCache.opportunities
      : [];
  const previousById = new Map(previousItems.map((item) => [String(item.id), item]));
  const previousHighWater =
    previousCache?.version === CACHE_VERSION ? Number(previousCache?.highWaterMark || 0) : 0;
  const initial = previousHighWater < 1;
  const start = initial ? SEED_POST_ID - INITIAL_HISTORY_SIZE + 1 : previousHighWater + 1;
  const previousMinimumId = previousItems.reduce(
    (minimum, item) => Math.min(minimum, Number(item.id) || minimum),
    Number.POSITIVE_INFINITY,
  );
  let backfillCursor =
    previousCache?.version === CACHE_VERSION && Number(previousCache?.backfillCursor) > 0
      ? Number(previousCache.backfillCursor)
      : Number.isFinite(previousMinimumId)
        ? previousMinimumId - 1
        : start - 1;
  let highestFound = previousHighWater || SEED_POST_ID;
  let misses = 0;
  let scanned = 0;
  const fetched = [];
  try {
    for (let id = start; scanned < MAX_FORWARD_REQUESTS; id += 1) {
      const item = await fetchPost(id);
      scanned += 1;
      if (item) {
        fetched.push(item);
        highestFound = Math.max(highestFound, id);
        misses = 0;
      } else {
        misses += 1;
        if ((!initial || id > SEED_POST_ID) && misses >= STOP_AFTER_MISSES) break;
      }
    }
    while (scanned < MAX_FORWARD_REQUESTS && backfillCursor > 0) {
      const id = backfillCursor;
      backfillCursor -= 1;
      const item = await fetchPost(id);
      scanned += 1;
      if (item && !previousById.has(item.id)) fetched.push(item);
    }
    if (!fetched.length && !previousItems.length)
      throw new Error("Aucune publication publique exploitable n’a été trouvée.");
    const dated = await settleWithConcurrency(fetched.slice(-MAX_DATE_LOOKUPS), 5, async (item) => {
      const embed = await fetchTelegramHtml(`${item.sourceUrl}?embed=1&mode=tme`);
      return { ...item, publishedAt: publishedAtFromEmbed(embed) };
    });
    for (const result of dated) {
      if (result.status === "fulfilled") previousById.set(result.value.id, result.value);
    }
    for (const item of fetched) {
      if (!previousById.has(item.id)) previousById.set(item.id, item);
    }
    const opportunities = [...previousById.values()]
      .sort((left, right) => Number(right.id) - Number(left.id))
      .slice(0, MAX_CACHED_OPPORTUNITIES);
    const payload = {
      version: CACHE_VERSION,
      fetchedAt: new Date().toISOString(),
      highWaterMark: highestFound,
      backfillCursor,
      scanned,
      opportunities,
    };
    await Promise.all([
      writeJsonObject(env, CACHE_KEY, payload),
      writeJsonObject(env, HEALTH_KEY, {
        state: "healthy",
        lastAttemptAt: attemptedAt,
        lastSuccessAt: payload.fetchedAt,
        highWaterMark: highestFound,
        backfillCursor,
        scanned,
        opportunities: opportunities.length,
        consecutiveFailures: 0,
        sourceUrl: TELEGRAM_CHANNEL_URL,
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
      message: error instanceof Error ? error.message : "Échec de la source Telegram.",
      sourceUrl: TELEGRAM_CHANNEL_URL,
    });
    throw error;
  }
}

async function latestAlgeriaOpportunities(env, forceRefresh = false) {
  const cached = await readJsonObject(env, CACHE_KEY);
  if (
    !forceRefresh &&
    cached?.version === CACHE_VERSION &&
    Array.isArray(cached.opportunities) &&
    timestampAge(cached.fetchedAt) < CACHE_TTL_MS
  )
    return cached;
  try {
    return await refreshAlgeriaOpportunityCache(env);
  } catch (error) {
    if (
      cached?.version === CACHE_VERSION &&
      Array.isArray(cached.opportunities) &&
      timestampAge(cached.fetchedAt) <= MAX_STALE_MS
    ) {
      return {
        ...cached,
        stale: true,
        staleReason: error instanceof Error ? error.message : "Actualisation Telegram échouée.",
      };
    }
    throw error;
  }
}

function parseLimit(value, fallback = 24) {
  const parsed = Number.parseInt(String(value || fallback), 10);
  return Math.min(60, Math.max(1, Number.isFinite(parsed) ? parsed : fallback));
}

export async function searchAlgeriaOpportunities(env, options = {}) {
  const payload = await latestAlgeriaOpportunities(env, options.refresh === true);
  const queryTokens = fold(options.query).split(/\s+/).filter(Boolean);
  const wilaya = String(options.wilaya || "all");
  const period = options.period === "week" ? "week" : "recent";
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const matches = payload.opportunities
    .filter(
      (item) =>
        wilaya === "all" ||
        item.wilaya === wilaya ||
        (Array.isArray(item.wilayas) && item.wilayas.includes(wilaya)),
    )
    .filter(
      (item) => period !== "week" || !item.publishedAt || Date.parse(item.publishedAt) >= weekAgo,
    )
    .filter((item) => {
      if (!queryTokens.length) return true;
      const searchable = fold(
        [
          item.title,
          item.employer,
          item.wilaya,
          item.commune,
          item.location,
          item.positions?.join(" "),
          item.description,
        ].join(" "),
      );
      return queryTokens.every((token) => searchable.includes(token));
    });
  const limit = parseLimit(options.limit);
  return {
    opportunities: matches.slice(0, limit),
    wilayas: ALGERIA_WILAYAS,
    meta: {
      period,
      wilaya,
      returned: Math.min(limit, matches.length),
      totalMatches: matches.length,
      scanned: Number(payload.scanned || 0),
      cachedTotal: payload.opportunities.length,
      hasMoreHistory: Number(payload.backfillCursor || 0) > 0,
      verifiedAt: payload.fetchedAt,
      stale: payload.stale === true,
      staleReason: payload.staleReason || null,
      cacheAgeMinutes: Math.round(timestampAge(payload.fetchedAt) / 60_000),
      sourceUrl: TELEGRAM_CHANNEL_URL,
      sourceType: "community_aggregator",
      methodology:
        "Les publications publiques individuelles du canal sont détectées par identifiant, mises en cache et analysées sans compte Telegram. Wilaya, commune, poste et contact ne sont publiés que lorsqu’ils sont présents ou identifiables avec certitude. Toute candidature doit être vérifiée auprès de l’employeur.",
      territorialReference: "69 wilayas et 1 541 communes — découpage officiel algérien 2026.",
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

export async function handleAlgeriaOpportunityApi(request, env, origin) {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/algeria-opportunities/search" && request.method === "GET") {
      return apiJson(
        await searchAlgeriaOpportunities(env, {
          period: url.searchParams.get("period") || "recent",
          query: url.searchParams.get("q") || "",
          wilaya: url.searchParams.get("wilaya") || "all",
          limit: url.searchParams.get("limit") || "24",
          refresh: url.searchParams.get("refresh") === "1",
        }),
        200,
        origin,
      );
    }
    if (url.pathname === "/api/algeria-opportunities/health" && request.method === "GET") {
      return apiJson(
        (await readJsonObject(env, HEALTH_KEY)) || { state: "collecting" },
        200,
        origin,
      );
    }
    return apiJson({ error: "Route Opportunités Algérie introuvable." }, 404, origin);
  } catch (error) {
    return apiJson(
      { error: error instanceof Error ? error.message : "Recherche Algérie indisponible." },
      502,
      origin,
    );
  }
}
