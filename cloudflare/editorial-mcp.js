import { inspectAnetiOpportunity, searchAnetiOpportunities } from "./aneti-opportunities.js";
import { inspectAtctOpportunity, searchAtctOpportunities } from "./atct-opportunities.js";
import { inspectCanadaOpportunity, searchCanadaOpportunities } from "./canada-opportunities.js";
import {
  inspectVolunteerOpportunity,
  searchVolunteerOpportunities,
} from "./volunteer-opportunities.js";

const MARKET_COUNTRIES = { TN: "Tunisie", DZ: "Algérie" };
const MAX_LIMIT = 24;

const EDITORIAL_PROFILES = {
  "cv-pro-algeria": {
    market: "DZ",
    dialect: "arabe algérien clair, administratif et accessible",
    responseLanguage: "arabe algérien",
    style:
      "informer avec précision, structurer les conditions et proposer le service sans promesse",
  },
  "emplois-immigration-tunis": {
    market: "TN",
    dialect: "arabe tunisien direct, professionnel et accessible",
    responseLanguage: "arabe tunisien",
    style: "ouvrir avec le délai vérifié, présenter l’opportunité puis les services en puces",
  },
  "bissane-career": {
    market: "TN",
    dialect: "arabe tunisien chaleureux, pédagogique et professionnel",
    responseLanguage: "arabe tunisien",
    style: "expliquer le parcours, mettre en valeur la préparation du dossier et rester prudent",
  },
};

const MCP_TOOLS = [
  {
    name: "list_verified_opportunities",
    title: "Lister les opportunités vérifiées ZGR",
    description:
      "Retourne des opportunités ouvertes provenant de sources ZGR contrôlées, avec source, date, état du cache et liens de candidature. Aucune donnée client n’est exposée.",
    inputSchema: {
      type: "object",
      properties: {
        market: { type: "string", enum: ["TN", "DZ"], description: "Marché éditorial." },
        sources: {
          type: "array",
          items: { type: "string", enum: ["atct", "aneti", "canada", "volunteer"] },
          description: "Sources à interroger. Par défaut, les sources adaptées au marché.",
        },
        query: { type: "string", description: "Mot-clé facultatif." },
        period: { type: "string", enum: ["week", "recent"] },
        limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT },
      },
      required: ["market"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
  },
  {
    name: "get_opportunity_bundle",
    title: "Obtenir le dossier éditorial vérifié d’une opportunité",
    description:
      "Retourne un contrat JSON prêt pour rédaction : faits vérifiés, source, deadline, conditions, documents et garde-fous éditoriaux. Ne retourne jamais de données client.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["atct", "aneti", "canada", "volunteer"] },
        id_or_url: { type: "string", description: "Identifiant ou lien de la fiche officielle." },
        market: { type: "string", enum: ["TN", "DZ"] },
      },
      required: ["source", "id_or_url", "market"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
  },
  {
    name: "get_editorial_profile",
    title: "Obtenir le profil éditorial d’une page ZGR",
    description:
      "Retourne le dialecte, le ton, les règles de sécurité et le format d’affiche à appliquer pour une page.",
    inputSchema: {
      type: "object",
      properties: { page_id: { type: "string", enum: Object.keys(EDITORIAL_PROFILES) } },
      required: ["page_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  },
];

function headers() {
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

function rpc(body, status = 200) {
  return new Response(body == null ? null : JSON.stringify(body), { status, headers: headers() });
}

function rpcError(id, code, message, status = 200) {
  return rpc({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, status);
}

function textResult(value, text) {
  return { content: [{ type: "text", text }], structuredContent: value, isError: false };
}

function cleanList(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String).slice(0, 12) : [];
}

function canonicalOpportunity(source, item, meta = {}) {
  const destination =
    item.country ||
    item.location ||
    item.destination?.countryName ||
    item.destination?.country ||
    "Destination non publiée";
  const applicationUrl =
    item.applicationMethod?.url || item.applicationContact?.url || item.applicationUrl || "";
  const deadlineAt = item.deadlineAt || item.endAt || null;
  return {
    id: `${source}:${item.id}`,
    source,
    title: String(item.title || "Opportunité sans intitulé"),
    destination,
    open: item.open !== false,
    deadline: {
      status: deadlineAt ? "confirmed" : "not_published",
      at: deadlineAt,
      displayRule: deadlineAt
        ? "La date peut être affichée exactement telle que fournie."
        : "Écrire seulement : date limite non publiée officiellement.",
    },
    sourceUrl: item.sourceUrl || meta.sourceUrl || "",
    applicationUrl,
    checkedAt: item.checkedAt || meta.verifiedAt || null,
    stale: meta.stale === true || item.staleDetail === true,
    positions: cleanList(item.positions),
    conditions: cleanList(item.conditions || item.registrationRequirements).concat(
      item.requirements ? [String(item.requirements)] : [],
    ),
    documents: cleanList(item.requiredDocuments),
    description: String(item.description || ""),
  };
}

function selectedSources(market, requested) {
  const allowed = new Set(["atct", "aneti", "canada", "volunteer"]);
  const values = Array.isArray(requested) ? requested.filter((item) => allowed.has(item)) : [];
  if (values.length) return values;
  return market === "TN" ? ["atct", "aneti", "canada", "volunteer"] : ["canada", "volunteer"];
}

async function listVerified(env, args) {
  const market = args.market;
  const query = String(args.query || "");
  const period = args.period === "week" ? "week" : "recent";
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(args.limit) || 12));
  const sources = selectedSources(market, args.sources);
  const tasks = {
    atct: () => searchAtctOpportunities(env, { query, period, limit }),
    aneti: () => searchAnetiOpportunities(env, { query, period, limit }),
    canada: () => searchCanadaOpportunities(env, { query, period, limit, country: market }),
    volunteer: () =>
      searchVolunteerOpportunities(env, {
        query,
        period,
        limit,
        participantCountry: MARKET_COUNTRIES[market],
      }),
  };
  const settled = await Promise.allSettled(
    sources.map(async (source) => ({ source, result: await tasks[source]() })),
  );
  const warnings = [];
  const opportunities = [];
  settled.forEach((entry) => {
    if (entry.status === "rejected") {
      warnings.push(entry.reason instanceof Error ? entry.reason.message : "Source indisponible.");
      return;
    }
    const { source, result } = entry.value;
    (result.opportunities || []).forEach((item) =>
      opportunities.push(canonicalOpportunity(source, item, result.meta)),
    );
  });
  return {
    market,
    checkedAt: new Date().toISOString(),
    opportunities: opportunities.filter((item) => item.open).slice(0, limit),
    warnings,
    editorialRules: {
      useOnlyVerifiedFacts: true,
      publishDeadlineOnlyWhenConfirmed: true,
      humanApprovalRequired: true,
    },
  };
}

async function bundle(env, args) {
  const market = args.market;
  let result;
  if (args.source === "atct") result = await inspectAtctOpportunity(env, args.id_or_url);
  else if (args.source === "aneti") result = await inspectAnetiOpportunity(env, args.id_or_url);
  else if (args.source === "canada")
    result = await inspectCanadaOpportunity(env, args.id_or_url, market);
  else if (args.source === "volunteer")
    result = await inspectVolunteerOpportunity(env, args.id_or_url, MARKET_COUNTRIES[market]);
  else throw new Error("Source non prise en charge.");
  const opportunity = canonicalOpportunity(args.source, result.opportunity, result.meta);
  return {
    schemaVersion: 1,
    opportunity,
    publishingGuardrails: {
      allowed: opportunity.open && !opportunity.stale,
      blockReasons: [
        ...(opportunity.open ? [] : ["L’opportunité est fermée."]),
        ...(opportunity.stale ? ["La vérification en direct a échoué ou est expirée."] : []),
      ],
      prohibitedClaims: [
        "garantie de recrutement",
        "garantie de visa",
        "quota non publié",
        "date non confirmée",
      ],
    },
  };
}

export async function handleEditorialMcp(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers() });
  if (request.method === "GET")
    return rpc({
      name: "ZGR Editorial MCP",
      endpoint: "/editorial/mcp",
      tools: MCP_TOOLS.map((tool) => tool.name),
    });
  if (request.method !== "POST") return rpc({ error: "Method not allowed" }, 405);
  let message;
  try {
    message = await request.json();
  } catch {
    return rpcError(null, -32700, "Invalid JSON", 400);
  }
  const id = message?.id;
  if (message?.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (message?.method === "initialize")
    return rpc({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "zgr-editorial", version: "1.0.0" },
        instructions:
          "Protocole linguistique ZGR : répondre par défaut en arabe algérien clair, professionnel et accessible. Pour toute demande liée à une publication, appeler d’abord get_editorial_profile avec une page explicitement choisie : cv-pro-algeria impose l’arabe algérien ; emplois-immigration-tunis et bissane-career imposent exclusivement l’arabe tunisien adapté à leur style. Ne jamais déduire une page par défaut ni mélanger les dialectes. Utiliser exclusivement les faits et liens retournés. Ne jamais rédiger une publication finale sans page, offre identifiée et source officielle. Ne jamais inventer une offre, date, condition, lien, quota, visa ou recrutement. Une date ne peut être affichée que si deadline.status vaut confirmed. Ne pas prétendre avoir généré une image, transféré un fichier ou enregistré un brouillon sans outil dédié et résultat visible. Les JSON clients et CV ZGR restent multilingues et intouchables : ne pas traduire, renommer ou modifier leurs clés, valeurs, structure ou langues. Ne publier sans validation humaine. Les outils de cette version sont strictement en lecture seule.",
      },
    });
  if (message?.method === "tools/list")
    return rpc({ jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } });
  if (message?.method === "tools/call") {
    try {
      const args = message?.params?.arguments || {};
      if (message?.params?.name === "list_verified_opportunities") {
        const result = await listVerified(env, args);
        return rpc({
          jsonrpc: "2.0",
          id,
          result: textResult(
            result,
            `${result.opportunities.length} opportunité(s) vérifiée(s) disponibles.`,
          ),
        });
      }
      if (message?.params?.name === "get_opportunity_bundle") {
        const result = await bundle(env, args);
        return rpc({ jsonrpc: "2.0", id, result: textResult(result, result.opportunity.title) });
      }
      if (message?.params?.name === "get_editorial_profile") {
        const profile = EDITORIAL_PROFILES[args.page_id];
        if (!profile) throw new Error("Page éditoriale inconnue.");
        return rpc({
          jsonrpc: "2.0",
          id,
          result: textResult(
            {
              pageId: args.page_id,
              ...profile,
              poster: { format: "4:3", palette: ["rouge", "blanc", "jaune"], textDirection: "rtl" },
            },
            `Profil éditorial : ${args.page_id}`,
          ),
        });
      }
      return rpcError(id, -32602, `Outil inconnu: ${String(message?.params?.name || "")}`);
    } catch (error) {
      return rpc({
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
  return rpcError(id, -32601, `Méthode inconnue: ${String(message?.method || "")}`);
}
