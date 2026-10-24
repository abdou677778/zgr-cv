type Transport = { fetch(request: Request): Promise<Response> };

export async function fetchOpportunityJson(
  pathname: string,
  params: Record<string, string | number | undefined>,
  options: { baseUrl: string; binding?: Transport; fetcher?: typeof fetch },
): Promise<Record<string, unknown>> {
  const url = new URL(`${options.baseUrl.replace(/\/+$/, '')}${pathname}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && String(value).trim()) url.searchParams.set(name, String(value));
  }
  const request = new Request(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'ZGR-CV-MCP/0.9' },
    signal: AbortSignal.timeout(45_000),
  });
  // Same-account Workers communicate through a service binding, not a public
  // workers.dev request that can be challenged or rejected between Workers.
  const response = options.binding
    ? await options.binding.fetch(request)
    : await (options.fetcher || fetch)(request);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`Source publique indisponible ou non JSON (HTTP ${response.status}).`);
  }
  return payload as Record<string, unknown>;
}
