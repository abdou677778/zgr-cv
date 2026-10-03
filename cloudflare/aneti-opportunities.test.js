import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectAnetiOpportunity,
  parseAnetiDetailHtml,
  parseAnetiListHtml,
  searchAnetiOpportunities,
} from "./aneti-opportunities.js";

function memoryBucket(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    async get(key) {
      if (!values.has(key)) return null;
      const value = values.get(key);
      return {
        async json() {
          return JSON.parse(value);
        },
      };
    },
    async put(key, value) {
      values.set(key, value);
    },
  };
}

const listHtml = `
  <div class="views-row"><div class="views-field views-field-title">
    <a href="/node/1055923" hreflang="fr">Opérateur socio-sanitaire</a></div>
    <div class="views-field views-field-changed">Publié: Mar 29/09/2026 - 10:24</div>
    <div class="views-field views-field-changed">Date Fin : Dim 18/10/2026 - 23:59</div>
    <div class="views-field views-field-name">ITALIE</div>
  </div><nav class="pager"></nav>`;

const detailHtml = `
  <h1 class="page-title"><span>Opérateur socio-sanitaire</span></h1>
  <article>
    <div class="field field--name-field-description field--type-text-long">
      <div class="field__label">Description de poste</div>
      <div class="field__item"><p>Postulez sur le formulaire
      <a href="https://candidatures.aneti.tn/app/inscription/69">officiel</a>.</p>
      <p>Vous devez être inscrit.e au bureau de l’emploi et sur le site avec votre n° CIN.
      Votre CV doit être enregistré sous votre CIN.</p></div>
    </div>
    <div class="field field--name-field-competences-exigees field--type-text-long">
      <div class="field__label">Profil recherché</div><div class="field__item">Diplôme requis.</div>
    </div>
    <div class="field field--name-field-langue-de-cv-exigee">
      <div class="field__label">Langue de cv exigée</div><div class="field__item">francais</div>
    </div>
    <div class="field field--name-field-domaine-et-specialite">
      <div class="field__label">Domaine de specialité</div><div class="field__item">SOINS</div>
    </div>
    <div class="field field--name-field-pays">
      <div class="field__label">Pays</div><div class="field__item">ITALIE</div>
    </div>
  </article>`;

test("parse la liste ANETI avec dates et pays", () => {
  const [item] = parseAnetiListHtml(listHtml);
  assert.equal(item.id, "1055923");
  assert.equal(item.country, "Italie");
  assert.equal(item.postedAt, "2026-09-29T10:24:00+01:00");
  assert.equal(item.deadlineAt, "2026-10-18T23:59:00+01:00");
});

test("extrait le formulaire et toutes les exigences d’inscription", () => {
  const opportunity = parseAnetiDetailHtml(detailHtml, {
    id: "1055923",
    sourceUrl: "https://aneti-international.tn/node/1055923",
  });
  assert.equal(opportunity.applicationMethod.type, "external_form");
  assert.equal(opportunity.applicationMethod.loginRequired, true);
  assert.equal(
    opportunity.applicationMethod.url,
    "https://candidatures.aneti.tn/app/inscription/69",
  );
  assert.equal(opportunity.cvLanguage, "francais");
  assert.equal(opportunity.registrationRequirements.length, 4);
});

test("recherche et inspecte une offre mise en cache", async () => {
  const opportunity = {
    ...parseAnetiDetailHtml(detailHtml, {
      id: "1055923",
      title: "Opérateur socio-sanitaire",
      country: "Italie",
      postedAt: "2026-10-02T10:00:00+01:00",
      deadlineAt: "2027-10-18T23:59:00+01:00",
      sourceUrl: "https://aneti-international.tn/node/1055923",
    }),
  };
  const env = {
    CLIENTS_BUCKET: memoryBucket({
      "public-cache/aneti-international-jobs-latest.json": JSON.stringify({
        version: 1,
        fetchedAt: new Date().toISOString(),
        scanned: 1,
        opportunities: [opportunity],
      }),
    }),
  };
  const result = await searchAnetiOpportunities(env, {
    period: "recent",
    query: "socio sanitaire",
  });
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].id, "1055923");

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(detailHtml, { status: 200 });
  try {
    const inspected = await inspectAnetiOpportunity(env, opportunity.sourceUrl);
    assert.equal(inspected.opportunity.id, "1055923");
    assert.equal(inspected.opportunity.open, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
