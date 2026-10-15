import assert from "node:assert/strict";
import test from "node:test";

import { handleEditorialMcp } from "./editorial-mcp.js";

async function call(method, params = {}, id = 1) {
  const response = await handleEditorialMcp(
    new Request("https://example.test/editorial/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }),
    {},
  );
  return response.json();
}

test("le MCP éditorial expose uniquement les outils de fondation en lecture seule", async () => {
  const initialized = await call("initialize");
  assert.equal(initialized.result.serverInfo.name, "zgr-editorial");

  const list = await call("tools/list", {}, 2);
  const names = list.result.tools.map((tool) => tool.name);
  assert.deepEqual(names, [
    "list_verified_opportunities",
    "get_opportunity_bundle",
    "get_editorial_profile",
  ]);
  assert.ok(list.result.tools.every((tool) => tool.annotations.readOnlyHint === true));
});

test("le profil éditorial tunisien retourne le dialecte et le format d’affiche", async () => {
  const reply = await call("tools/call", {
    name: "get_editorial_profile",
    arguments: { page_id: "emplois-immigration-tunis" },
  });
  const profile = reply.result.structuredContent;
  assert.equal(profile.market, "TN");
  assert.match(profile.dialect, /tunisien/);
  assert.equal(profile.poster.format, "4:3");
  assert.deepEqual(profile.poster.palette, ["rouge", "blanc", "jaune"]);
});
