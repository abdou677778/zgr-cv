import { apiUrl } from "@/lib/auth-client";

export type AtctOpportunity = {
  id: string;
  title: string;
  country: string;
  postedAt: string | null;
  deadlineAt: string | null;
  closedBySource: boolean;
  category: "job";
  positions: string[];
  requirements: string;
  description: string;
  audience: string;
  sourceUrl: string;
  applicationMethod: {
    type: "external_form" | "email" | "atct_portal" | "official_page";
    label: string;
    url: string;
    email: string | null;
    loginRequired: boolean;
    note: string;
  };
  requiredDocuments: string[];
  dataQuality?: {
    status: "complete" | "partial";
    missingFields: string[];
  };
  staleDetail?: boolean;
  checkedAt: string;
};

export type AtctOpportunitySearchResult = {
  opportunities: AtctOpportunity[];
  meta: {
    period: "week" | "recent";
    returned: number;
    totalMatches: number;
    scanned: number;
    excludedNotices: number;
    verifiedAt: string;
    stale: boolean;
    staleReason?: string | null;
    cacheAgeMinutes?: number;
    detailFailures?: number;
    sourceUrl: string;
    candidatePortalUrl: string;
    methodology: string;
  };
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Recherche ATCT momentanément indisponible.");
  return payload;
}

export async function searchAtctOpportunities(options: {
  period: "week" | "recent";
  query?: string;
  limit?: number;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({
    period: options.period,
    limit: String(options.limit || 18),
  });
  if (options.query?.trim()) params.set("q", options.query.trim());
  const response = await fetch(apiUrl(`/api/atct-opportunities/search?${params.toString()}`), {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  return readJson<AtctOpportunitySearchResult>(response);
}
