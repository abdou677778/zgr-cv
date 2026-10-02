import assert from "node:assert/strict";
import test from "node:test";

import {
  handleVolunteerMcp,
  isCountryEligible,
  normalizeOfficialOpportunity,
  resolveParticipantCountry,
  searchVolunteerOpportunities,
} from "./volunteer-opportunities.js";

function source(overrides = {}) {
  return {
    opid: 54646,
    title: "<p>Buon cammino</p>",
    organisation_name: "KALISTRATIA ODV",
    description: "<p>Protection de l’environnement</p>",
    town: "POLIA",
    country: "IT",
    date_start: "2026-10-08T12:00:00",
    date_end: "2027-11-17T12:00:00",
    date_application_end: "2027-10-04T23:00:00",
    created: new Date().toISOString(),
    volunteer_countries: ["TN", "DZ"],
    funding_programme: { residence_countries: ["FR"] },
    ...overrides,
  };
}

test("normalise le contenu officiel et contrôle le pays par code exact", () => {
  const opportunity = normalizeOfficialOpportunity(source());
  assert.equal(opportunity.title, "Buon cammino");
  assert.equal(isCountryEligible(opportunity, "Tunisie"), true);
  assert.equal(isCountryEligible(opportunity, "TN"), true);
  assert.equal(isCountryEligible(opportunity, "France"), false);
  assert.equal(resolveParticipantCountry("Algérie"), "DZ");
});

test("utilise les pays du programme uniquement lorsque la fiche indique all", () => {
  const opportunity = normalizeOfficialOpportunity(
    source({
      volunteer_countries: ["all"],
      funding_programme: { residence_countries: ["TN", "DZ", "FR"] },
    }),
  );
  assert.equal(isCountryEligible(opportunity, "Tunisia"), true);
  assert.equal(opportunity.eligibilitySource, "funding_programme.residence_countries");
});

test("la recherche en cache ne renvoie que les offres admissibles et actives", async () => {
  const opportunities = [
    normalizeOfficialOpportunity(source()),
    normalizeOfficialOpportunity(source({ opid: 54647, volunteer_countries: ["FR"] })),
    normalizeOfficialOpportunity(
      source({ opid: 54648, date_application_end: "2020-01-01T00:00:00" }),
    ),
  ];
  const env = {
    CLIENTS_BUCKET: {
      async get() {
        return {
          async text() {
            return JSON.stringify({ fetchedAt: new Date().toISOString(), opportunities });
          },
        };
      },
    },
  };
  const result = await searchVolunteerOpportunities(env, {
    participantCountry: "TN",
    period: "week",
  });
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].id, "54646");
  assert.equal(result.opportunities[0].eligible, true);
});

test("le point MCP publie uniquement les outils de lecture", async () => {
  const initialize = await handleVolunteerMcp(
    new Request("https://example.test/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    }),
    {},
  );
  const initialized = await initialize.json();
  assert.equal(initialized.result.serverInfo.name, "zgr-volunteer-opportunities");

  const list = await handleVolunteerMcp(
    new Request("https://example.test/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    }),
    {},
  );
  const tools = (await list.json()).result.tools;
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["search_volunteer_opportunities", "inspect_volunteer_opportunity"],
  );
  assert.ok(tools.every((tool) => tool.annotations.readOnlyHint));
});
