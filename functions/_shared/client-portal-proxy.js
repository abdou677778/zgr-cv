function portalUnavailable() {
  return new Response(
    `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CV PRO TEAM</title><body style="font-family:Arial,sans-serif;margin:0;display:grid;min-height:100vh;place-items:center;background:#f4f8fa;color:#123047"><main style="max-width:560px;padding:32px;text-align:center"><h1>Espace client temporairement indisponible</h1><p>Veuillez réessayer dans quelques instants ou contacter CV PRO TEAM.</p></main></body></html>`,
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    },
  );
}

function proxyResponse(response, asset = false) {
  const headers = new Headers(response.headers);
  if (!asset) headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("X-ZGR-Portal-Gateway", "cloudflare-pages");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function normalizedPath(value) {
  const parts = Array.isArray(value) ? value : typeof value === "string" ? value.split("/") : [];
  return parts.map((part) => String(part).trim()).filter(Boolean);
}

function publicRouteParts(url, asset, fallback) {
  const urlParts = url.pathname
    .split("/")
    .map((part) => {
      try {
        return decodeURIComponent(part).trim();
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  const fallbackParts = normalizedPath(fallback);
  const candidates = [...urlParts, ...fallbackParts];

  if (asset) {
    const marker = candidates.lastIndexOf("_next");
    return marker >= 0 ? candidates.slice(marker + 1) : fallbackParts;
  }

  const apiMarker = candidates.lastIndexOf("api");
  if (apiMarker >= 0) return candidates.slice(apiMarker);
  const code = candidates.find((part) => /^[a-f0-9]{24,128}$/i.test(part));
  return code ? [code] : fallbackParts;
}

function internalRequest(request, pathname, searchParams) {
  // Preserve the Worker's canonical host. Vinext's static asset dispatcher
  // uses it when resolving /_next files, while the service binding keeps the
  // request on Cloudflare's private network (no client-visible workers.dev).
  const upstreamUrl = new URL(
    pathname,
    "https://cv-pro-team-clients.zgrcv-wizi.workers.dev",
  );
  upstreamUrl.search = searchParams.toString();
  const headers = new Headers(request.headers);
  headers.delete("Origin");
  headers.delete("Referer");
  headers.set("X-Forwarded-Host", new URL(request.url).host);
  headers.set("X-Forwarded-Proto", "https");
  return new Request(new Request(upstreamUrl, request), { headers });
}

export async function proxyClientPortal({ request, env, path, asset = false }) {
  if (!env.CLIENT_PORTAL || typeof env.CLIENT_PORTAL.fetch !== "function") {
    return portalUnavailable();
  }

  const sourceUrl = new URL(request.url);
  const parts = publicRouteParts(sourceUrl, asset, path);
  let upstreamPath = "/";
  const upstreamSearch = new URLSearchParams(sourceUrl.searchParams);

  if (asset) {
    upstreamPath = `/_next/${parts.map(encodeURIComponent).join("/")}`;
  } else if (parts[0] === "api") {
    upstreamPath = `/api/${parts.slice(1).map(encodeURIComponent).join("/")}`;
  } else if (parts.length > 0) {
    // The portal validates the bearer token itself. Keeping that validation in
    // one place also supports legacy 64-character links without duplicating
    // authentication rules in the public gateway.
    upstreamSearch.set("invite", parts.at(-1).slice(0, 128));
  }

  const outbound = internalRequest(request, upstreamPath, upstreamSearch);
  // Static assets are resolved by the target Worker's asset dispatcher before
  // its fetch handler. A service binding enters after that dispatcher, so use a
  // server-side Cloudflare fetch only for immutable /_next files. The browser
  // still sees and contacts zgr-cv.pages.dev exclusively.
  const response = asset
    ? await fetch(outbound)
    : await env.CLIENT_PORTAL.fetch(outbound);
  return proxyResponse(response, asset);
}
