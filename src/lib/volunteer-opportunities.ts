import { apiUrl } from "@/lib/auth-client";

export type VolunteerOpportunity = {
  id: string;
  title: string;
  organization: string;
  description: string;
  participantProfile: string;
  ageRequirement: {
    minimum: number;
    maximum: number;
    label: string;
    source: "participant_profile" | "profile_and_programme" | "programme_rule";
    programmeMaximum: number;
  };
  applicationMethod: {
    type: "external_form" | "external_instructions" | "email" | "portal_account";
    label: string;
    url: string;
    portalAccountRequired: boolean;
    note: string;
  };
  applicationRequirements: {
    cv: boolean;
    motivationStatement: boolean;
  };
  destination: {
    town: string;
    countryCode: string;
    countryName: string;
  };
  activityType: string;
  topics: string[];
  startAt: string | null;
  endAt: string | null;
  deadlineAt: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  eligibilityCodes: string[];
  eligibilitySource: string;
  sourceUrl: string;
  checkedAt: string;
  eligible: boolean;
  eligibleCountry: { code: string; name: string };
};

export type VolunteerSearchResult = {
  opportunities: VolunteerOpportunity[];
  meta: {
    participantCountry: { code: string; name: string };
    period: "week" | "recent";
    returned: number;
    totalMatches: number;
    scanned: number;
    verifiedAt: string;
    stale: boolean;
    sourceUrl: string;
    methodology: string;
    cacheVersion: number;
    sourceStrategy: "official_structured_api";
  };
};

type VolunteerInspectResult = {
  opportunity: VolunteerOpportunity;
  meta: {
    verifiedAt: string;
    sourceUrl: string;
    methodology: string;
  };
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Recherche momentanément indisponible.");
  return payload;
}

export async function searchVolunteerOpportunities(options: {
  country: string;
  period: "week" | "recent";
  query?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<VolunteerSearchResult> {
  const params = new URLSearchParams({
    country: options.country,
    period: options.period,
    limit: String(options.limit || 30),
  });
  if (options.query?.trim()) params.set("q", options.query.trim());
  const response = await fetch(apiUrl(`/api/opportunities/search?${params.toString()}`), {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  return readJson<VolunteerSearchResult>(response);
}

export async function inspectVolunteerOpportunity(options: {
  urlOrId: string;
  country: string;
  signal?: AbortSignal;
}): Promise<VolunteerInspectResult> {
  const params = new URLSearchParams({
    url: options.urlOrId,
    country: options.country,
  });
  const response = await fetch(apiUrl(`/api/opportunities/inspect?${params.toString()}`), {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  return readJson<VolunteerInspectResult>(response);
}
