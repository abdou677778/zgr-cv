const BACKUP_ORIGINS = new Set([
  "https://abdou677778.github.io",
  "https://zgr-cv-storage-api.zgrcv-wizi.workers.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function acceptedOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  if (origin === new URL(request.url).origin) return origin;
  return BACKUP_ORIGINS.has(origin) ? origin : false;
}

function corsHeaders(origin) {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Profile-Revision",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function gatewayResponse(response, origin) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(origin))) headers.set(name, value);
  headers.set("X-ZGR-Gateway", "cloudflare-pages");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function proxyApiRequest({ request, env }) {
  const origin = acceptedOrigin(request);
  if (origin === false)
    return Response.json(
      { error: "Origine non autorisée." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );

  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders(origin) });

  if (!env.ZGR_API || typeof env.ZGR_API.fetch !== "function")
    return Response.json(
      { error: "Passerelle Cloudflare temporairement indisponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );

  const sourceUrl = new URL(request.url);
  const upstreamUrl = new URL(
    `${sourceUrl.pathname}${sourceUrl.search}`,
    "https://zgr-cv.internal",
  );
  const upstreamHeaders = new Headers(request.headers);
  // Le contrôle d'origine est réalisé ci-dessus. L'appel interne n'a pas à
  // déclencher une seconde vérification CORS dans le Worker de stockage.
  upstreamHeaders.delete("Origin");
  const upstreamRequest = new Request(upstreamUrl, request);
  const response = await env.ZGR_API.fetch(
    new Request(upstreamRequest, { headers: upstreamHeaders }),
  );
  return gatewayResponse(response, origin);
}
