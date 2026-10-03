import { apiUrl } from "@/lib/auth-client";

export type AnetiOpportunity = {
  id: string;
  title: string;
  country: string;
  postedAt: string | null;
  deadlineAt: string | null;
  description: string;
  requirements: string;
  cvLanguage: string;
  speciality: string;
  sourceUrl: string;
  applicationMethod: {
    type: "external_form" | "email" | "official_page";
    label: string;
    url: string;
    loginRequired: boolean;
    note: string;
  };
  registrationRequirements: string[];
  dataQuality?: {
    status: "complete" | "partial";
    missingFields: string[];
  };
  staleDetail?: boolean;
  checkedAt: string;
};

export type AnetiOpportunitySearchResult = {
  opportunities: AnetiOpportunity[];
  meta: {
    period: "week" | "recent";
    returned: number;
    totalMatches: number;
    scanned: number;
    verifiedAt: string;
    stale: boolean;
    staleReason?: string | null;
    cacheAgeMinutes?: number;
    detailFailures?: number;
    sourceUrl: string;
    methodology: string;
  };
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Recherche ANETI momentanément indisponible.");
  return payload;
}

export async function searchAnetiOpportunities(options: {
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
  const response = await fetch(apiUrl(`/api/aneti-opportunities/search?${params.toString()}`), {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  return readJson<AnetiOpportunitySearchResult>(response);
}
