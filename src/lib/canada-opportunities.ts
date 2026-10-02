import { apiUrl } from "@/lib/auth-client";

export type CanadaOpportunity = {
  id: string;
  title: string;
  employer: string;
  employerUrl: string;
  description: string;
  location: string;
  salary: string;
  workplace: string;
  employmentType: string;
  postedAt: string | null;
  deadlineAt: string | null;
  sourceUrl: string;
  acceptsInternational: boolean;
  eligibilityEvidence: string;
  lmiaStatus: "approved" | "requested" | "not_specified";
  applicationMethod: {
    type: "company_site" | "job_bank_direct" | "public_instructions";
    label: string;
    url: string;
    loginRequired: boolean;
    note: string;
  };
  candidateCountry: { code: "DZ" | "TN"; name: string };
  checkedAt: string;
};

export type CanadaOpportunitySearchResult = {
  opportunities: CanadaOpportunity[];
  sources: {
    jobBank: { name: string; url: string; automated: true };
    indeed: { name: string; url: string; automated: false; reason: string };
  };
  meta: {
    country: { code: "DZ" | "TN"; name: string };
    period: "week" | "recent";
    returned: number;
    totalMatches: number;
    scanned: number;
    verifiedAt: string;
    stale: boolean;
    sourceUrl: string;
    methodology: string;
  };
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok)
    throw new Error(payload.error || "Recherche Canada momentanément indisponible.");
  return payload;
}

export async function searchCanadaOpportunities(options: {
  country: "DZ" | "TN";
  period: "week" | "recent";
  query?: string;
  limit?: number;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({
    country: options.country,
    period: options.period,
    limit: String(options.limit || 18),
  });
  if (options.query?.trim()) params.set("q", options.query.trim());
  const response = await fetch(apiUrl(`/api/canada-opportunities/search?${params.toString()}`), {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  return readJson<CanadaOpportunitySearchResult>(response);
}

export function indeedCanadaSearchUrl(query = "") {
  const terms = query.trim() || "foreign candidates outside canada";
  const params = new URLSearchParams({ q: terms, sort: "date" });
  return `https://ca.indeed.com/jobs?${params.toString()}`;
}
