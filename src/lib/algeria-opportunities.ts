import { apiUrl } from "@/lib/auth-client";

export type AlgeriaOpportunity = {
  id: string;
  title: string;
  employer: string | null;
  wilaya: string | null;
  wilayas: string[];
  commune: string | null;
  location: string | null;
  positions: string[];
  description: string;
  publishedAt: string | null;
  sourceUrl: string;
  applicationMethod: {
    type: "email" | "external_link" | "phone" | "source_only";
    label: string;
    url: string;
    email: string | null;
    phone: string | null;
    loginRequired: boolean | null;
    note: string;
  };
  requiredDocuments: string[];
  dataQuality: {
    status: "complete" | "partial";
    missingFields: string[];
  };
  checkedAt: string;
};

export type AlgeriaOpportunitySearchResult = {
  opportunities: AlgeriaOpportunity[];
  wilayas: string[];
  meta: {
    period: "week" | "recent";
    wilaya: string;
    returned: number;
    totalMatches: number;
    scanned: number;
    verifiedAt: string;
    stale: boolean;
    staleReason?: string | null;
    cacheAgeMinutes?: number;
    sourceUrl: string;
    sourceType: "community_aggregator";
    methodology: string;
    territorialReference: string;
  };
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok)
    throw new Error(payload.error || "Recherche des opportunités en Algérie indisponible.");
  return payload;
}

export async function searchAlgeriaOpportunities(options: {
  period: "week" | "recent";
  wilaya?: string;
  query?: string;
  limit?: number;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({
    period: options.period,
    wilaya: options.wilaya || "all",
    limit: String(options.limit || 30),
  });
  if (options.query?.trim()) params.set("q", options.query.trim());
  const response = await fetch(apiUrl(`/api/algeria-opportunities/search?${params.toString()}`), {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  return readJson<AlgeriaOpportunitySearchResult>(response);
}
