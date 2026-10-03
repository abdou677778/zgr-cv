import assert from "node:assert/strict";
import test from "node:test";

import {
  extractAnetiOpportunityId,
  fetchAnetiHtml,
  hasAnetiNextPage,
  inspectAnetiOpportunity,
  parseAnetiDetailHtml,
  parseAnetiListHtml,
  refreshAnetiOpportunityCache,
  searchAnetiOpportunities,
} from "./aneti-opportunities.js";

function memoryBucket(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
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

test("tolère les classes réordonnées, URL absolues, libellés anglais et doublons", () => {
  const html = `
    <div data-row="1" class="card views-row featured">
      <div class="views-field-title"><a hreflang="en" href="https://www.aneti-international.tn/en/node/1056001?ref=list">Technicien &eacute;lectrique</a></div>
      <div class="views-field-changed">Published: Thu 01-10-2026 at 08:05</div>
      <div>End date: 21.10.2026 - 17:30</div>
      <div class="label views-field-name value">MAURITANIE</div>
    </div>
    <div class="views-row"><a href="/node/1056001">copie</a></div>`;
  const items = parseAnetiListHtml(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Technicien électrique");
  assert.equal(items[0].country, "Mauritanie");
  assert.equal(items[0].postedAt, "2026-10-01T08:05:00+01:00");
  assert.equal(items[0].deadlineAt, "2026-10-21T17:30:00+01:00");
  assert.equal(items[0].sourceUrl, "https://aneti-international.tn/node/1056001");
});

test("détecte la pagination sans dépendre du nombre de cartes", () => {
  assert.equal(
    hasAnetiNextPage(
      '<nav><a class="pager__item--next" href="/offres?page=1">Suivant</a></nav>',
      0,
    ),
    true,
  );
  assert.equal(hasAnetiNextPage('<a href="/offres?page=1">1</a>', 1), false);
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
  assert.equal(opportunity.dataQuality.status, "complete");
});

test("accepte les futurs alias de champs et signale les données partielles", () => {
  const html = `
    <meta content="Développeur logiciel | Aneti internationnal" property="og:title">
    <article>
      <div class="field field--name-field-description-poste"><div class="field__item">Mission cloud.</div></div>
      <div class="field field--name-field-country"><div class="field__item">CANADA</div></div>
      <div class="field field--name-field-langue-cv"><div class="field__item">anglais</div></div>
    </article>`;
  const opportunity = parseAnetiDetailHtml(html, { id: "1056002" });
  assert.equal(opportunity.title, "Développeur logiciel");
  assert.equal(opportunity.country, "Canada");
  assert.equal(opportunity.cvLanguage, "anglais");
  assert.equal(opportunity.dataQuality.status, "complete");

  const partial = parseAnetiDetailHtml("<title>Offre | Aneti internationnal</title>", {
    id: "1056003",
  });
  assert.equal(partial.dataQuality.status, "partial");
  assert.deepEqual(partial.dataQuality.missingFields, ["country", "content"]);
});

test("distingue formulaire direct, e-mail officiel et connexion obligatoire", () => {
  const direct = parseAnetiDetailHtml(
    `<h1 class="page-title">Offre directe</h1><article>
      <div class="field field--name-field-description"><a href="https://candidatures.aneti.tn/app/inscription/70">Remplir le formulaire</a></div>
      <div class="field field--name-field-pays">FRANCE</div></article>`,
    { id: "1056004" },
  );
  assert.equal(direct.applicationMethod.type, "external_form");
  assert.equal(direct.applicationMethod.loginRequired, false);

  const byEmail = parseAnetiDetailHtml(
    `<h1 class="page-title">Offre par courrier</h1><article>
      <div class="field field--name-field-description">Envoyez votre CV à <a href="mailto:jobs@example.org">jobs@example.org</a></div>
      <div class="field field--name-field-pays">FRANCE</div></article>`,
    { id: "1056005" },
  );
  assert.equal(byEmail.applicationMethod.type, "email");
  assert.equal(byEmail.applicationMethod.url, "mailto:jobs@example.org");
  assert.equal(byEmail.applicationMethod.loginRequired, false);
});

test("extrait uniquement un identifiant ANETI sûr, y compris depuis Facebook", () => {
  assert.equal(extractAnetiOpportunityId("1055923"), "1055923");
  assert.equal(
    extractAnetiOpportunityId(
      "https://l.facebook.com/l.php?u=https%3A%2F%2Faneti-international.tn%2Fnode%2F1055923%3Ffbclid%3Dx&h=123456",
    ),
    "1055923",
  );
  assert.equal(extractAnetiOpportunityId("https://example.com/order/1055923"), null);
});

test("réessaie les erreurs temporaires et refuse les redirections hors ANETI", async () => {
  let attempts = 0;
  const fetched = await fetchAnetiHtml("https://aneti-international.tn/offres", async () => {
    attempts += 1;
    if (attempts < 3)
      return new Response("temporaire", { status: 503, headers: { "Retry-After": "0" } });
    return new Response("<html>ok</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  });
  assert.equal(attempts, 3);
  assert.equal(fetched.body, "<html>ok</html>");

  await assert.rejects(
    () => fetchAnetiHtml("https://example.com/offres", async () => new Response("x")),
    /non autorisée/,
  );
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
        version: 2,
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
  globalThis.fetch = async () =>
    new Response(detailHtml, { status: 200, headers: { "Content-Type": "text/html" } });
  try {
    const inspected = await inspectAnetiOpportunity(env, opportunity.sourceUrl);
    assert.equal(inspected.opportunity.id, "1055923");
    assert.equal(inspected.opportunity.open, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("filtre les offres expirées sans masquer celles dont ANETI omet l’échéance", async () => {
  const base = parseAnetiDetailHtml(detailHtml, {
    id: "1055923",
    postedAt: new Date().toISOString(),
    sourceUrl: "https://aneti-international.tn/node/1055923",
  });
  const env = {
    CLIENTS_BUCKET: memoryBucket({
      "public-cache/aneti-international-jobs-latest.json": JSON.stringify({
        version: 2,
        fetchedAt: new Date().toISOString(),
        scanned: 3,
        opportunities: [
          { ...base, id: "1055923", deadlineAt: "2020-01-01T00:00:00+01:00" },
          { ...base, id: "1055924", deadlineAt: null },
          { ...base, id: "1055925", deadlineAt: "2099-01-01T00:00:00+01:00" },
        ],
      }),
    }),
  };
  const result = await searchAnetiOpportunities(env, { period: "recent" });
  assert.deepEqual(
    result.opportunities.map((item) => item.id),
    ["1055924", "1055925"],
  );
});

test("conserve une ancienne fiche vérifiée si un détail échoue pendant l’actualisation", async () => {
  const previous = parseAnetiDetailHtml(detailHtml, {
    id: "1055924",
    title: "Ancienne fiche vérifiée",
    country: "Italie",
    sourceUrl: "https://aneti-international.tn/node/1055924",
  });
  const bucket = memoryBucket({
    "public-cache/aneti-international-jobs-latest.json": JSON.stringify({
      version: 2,
      fetchedAt: "2026-10-02T00:00:00.000Z",
      scanned: 2,
      opportunities: [previous],
    }),
  });
  const secondRow = listHtml
    .replaceAll("1055923", "1055924")
    .replace("Opérateur socio-sanitaire", "Ancienne fiche vérifiée");
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.includes("/offres?"))
      return new Response(`${listHtml}${secondRow}`, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    if (value.endsWith("/node/1055923"))
      return new Response(detailHtml, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    return new Response("introuvable", { status: 404 });
  };
  try {
    const refreshed = await refreshAnetiOpportunityCache({ CLIENTS_BUCKET: bucket });
    assert.equal(refreshed.opportunities.length, 2);
    assert.equal(refreshed.detailFailures, 1);
    assert.equal(refreshed.opportunities.find((item) => item.id === "1055924").staleDetail, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("l’inspection retourne explicitement le cache lorsque la relecture directe échoue", async () => {
  const cached = parseAnetiDetailHtml(detailHtml, {
    id: "1055923",
    title: "Opérateur socio-sanitaire",
    sourceUrl: "https://aneti-international.tn/node/1055923",
  });
  const env = {
    CLIENTS_BUCKET: memoryBucket({
      "public-cache/aneti-international-jobs-latest.json": JSON.stringify({
        version: 2,
        fetchedAt: new Date().toISOString(),
        scanned: 1,
        opportunities: [cached],
      }),
    }),
  };
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("introuvable", { status: 404 });
  try {
    const result = await inspectAnetiOpportunity(env, cached.sourceUrl);
    assert.equal(result.meta.live, false);
    assert.equal(result.opportunity.staleDetail, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
