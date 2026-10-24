import assert from "node:assert/strict";
import test from "node:test";
import { proxyApiRequest } from "../functions/_shared/api-proxy.js";
import { proxyClientPortal } from "../functions/_shared/client-portal-proxy.js";
import { onRequest as portalAssetRequest } from "../functions/_next/[[path]].js";

test("les nouveaux assets du portail sont servis par la route publique _next", async () => {
  const originalFetch = globalThis.fetch;
  const forwarded = [];
  globalThis.fetch = async request => {
    forwarded.push(request.url);
    return new Response("/* portal asset */", {headers:{"Content-Type":"text/css"}});
  };
  try {
    const result = await portalAssetRequest({
      request:new Request("https://zgr-cv.pages.dev/_next/static/css/new-version.css"),
      params:{path:"static/css/new-version.css"},
      env:{CLIENT_PORTAL:service(async()=>{throw new Error("Static assets must use the canonical asset dispatcher");})},
    });
    assert.equal(result.status,200);
    assert.equal(result.headers.get("Content-Type"),"text/css");
    assert.equal(result.headers.get("X-ZGR-Portal-Gateway"),"cloudflare-pages");
    assert.deepEqual(forwarded,["https://cv-pro-team-clients.zgrcv-wizi.workers.dev/_next/static/css/new-version.css"]);
  } finally {globalThis.fetch=originalFetch;}
});

function service(handler) {
  return { fetch: handler };
}

test("un asset manquant ne peut pas mettre en cache une page HTML comme script",async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response('<html>fallback</html>',{headers:{'Content-Type':'text/html','Cache-Control':'public, max-age=31536000, immutable'}});
  try{
    const result=await portalAssetRequest({request:new Request('https://zgr-cv.pages.dev/_next/missing.js'),env:{CLIENT_PORTAL:service(async()=>new Response())},params:{path:'missing.js'}});
    assert.equal(result.status,404);assert.equal(result.headers.get('Cache-Control'),'no-store');
    assert.match(result.headers.get('Content-Type'),/text\/plain/);
  }finally{globalThis.fetch=originalFetch;}
});

test("le portail isole ses assets du cache historique de la SPA",async()=>{
  const result=await proxyClientPortal({request:new Request("https://zgr-cv.pages.dev/c/0123456789abcdef01234567"),env:{CLIENT_PORTAL:service(async()=>new Response('<link href="/_next/static/a.css"><script>const chunk="/_next/static/b.js"</script>',{headers:{"Content-Type":"text/html","Link":"</_next/static/a.css>; rel=preload"}}))}});
  const html=await result.text();
  assert.ok(html.includes('/c/_next/static/a.css'));
  assert.ok(html.includes('/c/_next/static/b.js'));
  assert.ok(result.headers.get('Link').includes('/c/_next/'));
});

test("la passerelle Pages transmet l'API au Worker sans exposer workers.dev", async () => {
  let forwarded;
  const response = await proxyApiRequest({
    request: new Request("https://zgr-cv.pages.dev/api/auth/login", {
      method: "POST",
      headers: { Origin: "https://zgr-cv.pages.dev", "Content-Type": "application/json" },
      body: JSON.stringify({ username: "test", password: "secret" }),
    }),
    env: {
      ZGR_API: service(async (request) => {
        forwarded = request;
        return Response.json({ ok: true });
      }),
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-ZGR-Gateway"), "cloudflare-pages");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://zgr-cv.pages.dev");
  assert.equal(new URL(forwarded.url).pathname, "/api/auth/login");
  assert.equal(forwarded.headers.has("Origin"), false);
  assert.deepEqual(await forwarded.json(), { username: "test", password: "secret" });
});

test("la passerelle Pages autorise le secours GitHub et refuse les autres origines", async () => {
  const allowed = await proxyApiRequest({
    request: new Request("https://zgr-cv.pages.dev/api/auth/login", {
      method: "OPTIONS",
      headers: { Origin: "https://abdou677778.github.io" },
    }),
    env: {},
  });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "https://abdou677778.github.io");

  const refused = await proxyApiRequest({
    request: new Request("https://zgr-cv.pages.dev/api/clients", {
      headers: { Origin: "https://example.invalid" },
    }),
    env: {},
  });
  assert.equal(refused.status, 403);
});

test("le lien client court reste sur pages.dev et transmet le code au portail interne", async () => {
  const code = "0123456789abcdef01234567";
  let forwarded;
  const response = await proxyClientPortal({
    request: new Request(`https://zgr-cv.pages.dev/c/${code}?lang=ar`),
    path: [code],
    env: {
      CLIENT_PORTAL: service(async (request) => {
        forwarded = request;
        return new Response("<html>portal</html>", {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }),
    },
  });

  const upstream = new URL(forwarded.url);
  assert.equal(upstream.pathname, "/");
  assert.equal(upstream.searchParams.get("invite"), code);
  assert.equal(upstream.searchParams.get("lang"), "ar");
  assert.equal(response.headers.get("X-ZGR-Portal-Gateway"), "cloudflare-pages");
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
});

test("la passerelle du portail transmet les API et laisse le portail valider le code public", async () => {
  let forwarded;
  const apiResponse = await proxyClientPortal({
    request: new Request("https://zgr-cv.pages.dev/c/api/orders/session", {
      method: "POST",
      body: JSON.stringify({ invitationToken: "0123456789abcdef01234567" }),
    }),
    path: ["api", "orders", "session"],
    env: {
      CLIENT_PORTAL: service(async (request) => {
        forwarded = request;
        return Response.json({ state: "NEW" });
      }),
    },
  });
  assert.equal(new URL(forwarded.url).pathname, "/api/orders/session");
  assert.equal(apiResponse.status, 200);

  let invalidForwarded;
  const invalid = await proxyClientPortal({
    request: new Request("https://zgr-cv.pages.dev/c/not-a-valid-code"),
    path: ["not-a-valid-code"],
    env: {
      CLIENT_PORTAL: service(async (request) => {
        invalidForwarded = request;
        return new Response("portal-validation");
      }),
    },
  });
  assert.equal(invalid.status, 200);
  assert.equal(new URL(invalidForwarded.url).searchParams.get("invite"), "not-a-valid-code");
});
