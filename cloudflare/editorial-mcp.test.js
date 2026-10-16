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

test("le MCP éditorial expose les sources en lecture et une réception de brouillon explicitement sécurisée", async () => {
  const initialized = await call("initialize");
  assert.equal(initialized.result.serverInfo.name, "zgr-editorial");
  assert.match(initialized.result.instructions, /arabe algérien/i);
  assert.match(initialized.result.instructions, /arabe tunisien/i);
  assert.match(initialized.result.instructions, /multilingues et intouchables/i);

  const list = await call("tools/list", {}, 2);
  const names = list.result.tools.map((tool) => tool.name);
  assert.deepEqual(names, [
    "list_verified_opportunities",
    "get_opportunity_bundle",
    "get_editorial_profile",
    "get_official_program_watch",
    "save_publication_draft",
  ]);
  assert.ok(list.result.tools.slice(0, 4).every((tool) => tool.annotations.readOnlyHint === true));
  assert.equal(list.result.tools[4].annotations.readOnlyHint, false);
  assert.match(list.result.tools[4].description, /code de réception temporaire/i);
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
  assert.equal(profile.responseLanguage, "arabe tunisien");
});
