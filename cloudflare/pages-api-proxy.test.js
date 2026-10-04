import assert from "node:assert/strict";
import test from "node:test";
import { proxyApiRequest } from "../functions/_shared/api-proxy.js";

function service(handler) {
  return { fetch: handler };
}

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
