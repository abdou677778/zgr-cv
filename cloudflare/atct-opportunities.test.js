import assert from "node:assert/strict";
import test from "node:test";

import {
  extractAtctOpportunityId,
  fetchAtctHtml,
  hasAtctNextPage,
  inspectAtctOpportunity,
  parseAtctDetailHtml,
  parseAtctListHtml,
  refreshAtctOpportunityCache,
  searchAtctOpportunities,
} from "./atct-opportunities.js";

function memoryBucket(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    async get(key) {
      if (!values.has(key)) return null;
      return {
        async json() {
          return JSON.parse(values.get(key));
        },
      };
    },
    async put(key, value) {
      values.set(key, value);
    },
  };
}

const listHtml = `
  <div class="views-row views-row-1 views-row-odd">
    <div class="elemActPage"><div class="actDiv"><div class="titleAtualite">
      <span><a href="/fr/recrutement-au-canada?fbclid=x">Recrutement au Canada</a></span>
    </div><div class="enSavoirPlus"><a href="/fr/recrutement-au-canada">En savoir plus</a></div></div></div>
  </div>
  <div class="views-row views-row-2 views-row-even">
    <div class="titleAtualite"><a href="https://www.atct.tn/fr/avis-au-public-appel-doffres">Avis au public : Appel d'offres</a></div>
  </div>
  <ul class="pager"><li><a href="/fr/avis_ann?page=1">suivant</a></li></ul>`;

const canadaDetailHtml = `
  <h1 id="page-title" class="title">Recrutement au Canada</h1>
  <div class="field field-name-field-date-avis-ann"><span content="2026-09-25T00:00:00+02:00">25 septembre 2026</span></div>
  <div class="field field-name-body"><div class="field-item">
    <p>L’ATCT informe que des entreprises canadiennes souhaitent recruter des compétences tunisiennes.</p>
    <div>Postes à pourvoir</div><ul><li>S uperviseur de restaurant</li><li>Électricien industriel</li></ul>
    <h2>Critères d’éligibilité</h2><ul><li>Deux ans d’expérience.</li><li>Diplôme requis.</li></ul>
    <h2>Modalités de candidature</h2><p>Lien d'inscription : <a href="https://forms.gle/example">formulaire</a></p>
    <p>Date limite d’inscription : 05 octobre 2099</p>
  </div></div>`;

const emailDetailHtml = `
  <h1 id="page-title">Canada : recrutement d’un Architecte IAM</h1>
  <div class="field field-name-field-date-avis-ann"><span content="2026-06-01T00:00:00+02:00">1 juin 2026</span></div>
  <div class="field field-name-body"><div class="field-item">
    <p>Une entreprise canadienne souhaite recruter un Architecte IAM.</p>
    <h2>Profil recherché</h2><p>Cinq ans d’expérience, français et anglais.</p>
    <h2>Candidature</h2><p>Envoyer un CV, une copie du diplôme et les attestations d’expérience à offres.canada@atct.tn.</p>
    <p>Date limite de réception des candidatures : 10 juin 2099.</p>
  </div></div>`;

const excludedDetailHtml = `
  <h1 id="page-title">Avis au public : Appel d’offres n° 01/2026</h1>
  <div class="field field-name-body"><p>Acquisition de matériels informatiques.</p></div>`;

test("parse la liste ATCT, déduplique et détecte la pagination", () => {
  const items = parseAtctListHtml(`${listHtml}${listHtml}`);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, "recrutement-au-canada");
  assert.equal(items[0].sourceUrl, "https://www.atct.tn/fr/recrutement-au-canada");
  assert.equal(hasAtctNextPage(listHtml, 0), true);
  assert.equal(hasAtctNextPage('<a href="?page=1">1</a>', 1), false);
});

test("extrait postes, critères, pays, échéance et formulaire externe", () => {
  const item = parseAtctDetailHtml(canadaDetailHtml, { id: "recrutement-au-canada" });
  assert.equal(item.category, "job");
  assert.equal(item.country, "Canada");
  assert.deepEqual(item.positions, ["Superviseur de restaurant", "Électricien industriel"]);
  assert.match(item.requirements, /Deux ans d’expérience/);
  assert.equal(item.deadlineAt, "2099-10-05T22:59:00.000Z");
  assert.equal(item.applicationMethod.type, "external_form");
  assert.equal(item.applicationMethod.url, "https://forms.gle/example");
  assert.equal(item.applicationMethod.loginRequired, false);
});

test("extrait une candidature par e-mail et les pièces demandées", () => {
  const item = parseAtctDetailHtml(emailDetailHtml, { id: "architecte-iam" });
  assert.equal(item.applicationMethod.type, "email");
  assert.equal(item.applicationMethod.email, "offres.canada@atct.tn");
  assert.equal(item.applicationMethod.url, "mailto:offres.canada@atct.tn");
  assert.deepEqual(item.requiredDocuments, [
    "CV",
    "Diplôme ou qualification",
    "Attestations d’expérience",
  ]);
});

test("reconnaît l’espace candidat quand une connexion ATCT est exigée", () => {
  const item = parseAtctDetailHtml(
    `<h1 id="page-title">Recrutement d'infirmiers</h1><div class="field field-name-body">
      <p>Les candidats doivent se connecter à leur espace candidat et être inscrits dans la banque des candidatures ATCT.</p>
      <p>Date limite : 12 décembre 2099.</p></div>`,
    { id: "recrutement-infirmiers" },
  );
  assert.equal(item.applicationMethod.type, "atct_portal");
  assert.equal(item.applicationMethod.loginRequired, true);
  assert.equal(item.applicationMethod.url, "https://www.atct.tn/rh/fr/candidat");
});

test("écarte appels d’offres, concours et événements des emplois", () => {
  assert.equal(
    parseAtctDetailHtml(excludedDetailHtml, { id: "appel-doffres" }).category,
    "excluded",
  );
  assert.equal(
    parseAtctDetailHtml(
      '<h1 id="page-title">Atelier virtuel d’information au Canada</h1><div class="field field-name-body">Inscription</div>',
      { id: "atelier-canada" },
    ).category,
    "excluded",
  );
  assert.equal(
    parseAtctDetailHtml(
      '<h1 id="page-title">Concours externe pour le recrutement des cadres</h1><div class="field field-name-body">Concours</div>',
      { id: "concours-externe" },
    ).category,
    "excluded",
  );
});

test("signale les échéances absentes sans inventer de date", () => {
  const item = parseAtctDetailHtml(
    '<h1 id="page-title">Offre d’emploi en Mauritanie</h1><div class="field field-name-body">Postes à pourvoir</div>',
    { id: "offre-mauritanie" },
  );
  assert.equal(item.deadlineAt, null);
  assert.equal(item.dataQuality.status, "complete");
  assert.deepEqual(item.dataQuality.missingFields, ["deadline"]);
});

test("reconnaît les échéances formulées avant le et les délais déjà clôturés", () => {
  const dated = parseAtctDetailHtml(
    '<h1 id="page-title">Recrutement international</h1><div class="field field-name-body">Remplir le formulaire électronique avant le 13/07/2099.</div>',
    { id: "recrutement-international" },
  );
  assert.equal(dated.deadlineAt, "2099-07-13T22:59:00.000Z");
  const closed = parseAtctDetailHtml(
    '<h1 id="page-title">Recrutement à Oman</h1><div class="field field-name-body">Le délai de participation est clôturé.</div>',
    { id: "recrutement-oman" },
  );
  assert.equal(closed.closedBySource, true);
});

test("ne confond pas les critères du profil avec une liste de postes", () => {
  const item = parseAtctDetailHtml(
    `<h1 id="page-title">Recrutement d’éducateurs au Canada</h1>
     <div class="field field-name-body"><div class="field-item">
       <h2>Profil recherché</h2><ul><li>Deux ans d’expérience</li><li>Français B2</li></ul>
       <h2>Processus de sélection</h2><p>Les candidatures seront étudiées.</p>
     </div></div>`,
    { id: "recrutement-educateurs-canada" },
  );
  assert.deepEqual(item.positions, []);
  assert.match(item.requirements, /Deux ans d’expérience/);
});

test("extrait uniquement des identifiants appartenant au domaine ATCT", () => {
  assert.equal(extractAtctOpportunityId("recrutement-au-canada"), "recrutement-au-canada");
  assert.equal(
    extractAtctOpportunityId("https://www.atct.tn/fr/recrutement-au-canada?fbclid=x"),
    "recrutement-au-canada",
  );
  assert.equal(
    extractAtctOpportunityId(
      "https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.atct.tn%2Ffr%2Frecrutement-au-canada",
    ),
    "recrutement-au-canada",
  );
  assert.equal(extractAtctOpportunityId("https://example.com/fr/recrutement-au-canada"), null);
});

test("réessaie les erreurs temporaires et refuse une source hors ATCT", async () => {
  let attempts = 0;
  const result = await fetchAtctHtml("https://www.atct.tn/fr/avis_ann", async () => {
    attempts += 1;
    if (attempts < 3)
      return new Response("temporaire", { status: 503, headers: { "Retry-After": "0" } });
    return new Response("<html>ok</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  });
  assert.equal(attempts, 3);
  assert.equal(result.body, "<html>ok</html>");
  await assert.rejects(
    () => fetchAtctHtml("https://example.com/fr/avis_ann", async () => new Response("x")),
    /non autorisée/,
  );
});

test("la recherche filtre les annonces fermées et interroge postes et critères", async () => {
  const active = parseAtctDetailHtml(canadaDetailHtml, { id: "recrutement-au-canada" });
  const closed = { ...active, id: "ancienne-offre", closedBySource: true };
  const env = {
    CLIENTS_BUCKET: memoryBucket({
      "public-cache/atct-international-jobs-latest.json": JSON.stringify({
        version: 2,
        fetchedAt: new Date().toISOString(),
        scanned: 2,
        excludedNotices: 0,
        opportunities: [active, closed],
      }),
    }),
  };
  const result = await searchAtctOpportunities(env, { period: "recent", query: "electricien" });
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].id, "recrutement-au-canada");
});

test("l’actualisation conserve une ancienne fiche lorsqu’un détail échoue", async () => {
  const previous = parseAtctDetailHtml(canadaDetailHtml, { id: "avis-au-public-appel-doffres" });
  const bucket = memoryBucket({
    "public-cache/atct-international-jobs-latest.json": JSON.stringify({
      version: 2,
      fetchedAt: "2026-10-02T00:00:00.000Z",
      opportunities: [previous],
    }),
  });
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.includes("/avis_ann?"))
      return new Response(listHtml, { status: 200, headers: { "Content-Type": "text/html" } });
    if (value.endsWith("/fr/recrutement-au-canada"))
      return new Response(canadaDetailHtml, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    return new Response("introuvable", { status: 404 });
  };
  try {
    const refreshed = await refreshAtctOpportunityCache({ CLIENTS_BUCKET: bucket });
    assert.equal(refreshed.detailFailures, 1);
    assert.equal(refreshed.classifiedJobs, 2);
    assert.equal(
      refreshed.opportunities.some((item) => item.staleDetail),
      true,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("l’inspection emploie explicitement le cache si ATCT ne répond plus", async () => {
  const cached = parseAtctDetailHtml(canadaDetailHtml, { id: "recrutement-au-canada" });
  const env = {
    CLIENTS_BUCKET: memoryBucket({
      "public-cache/atct-international-jobs-latest.json": JSON.stringify({
        version: 2,
        fetchedAt: new Date().toISOString(),
        opportunities: [cached],
      }),
    }),
  };
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("erreur", { status: 503 });
  try {
    const result = await inspectAtctOpportunity(env, "recrutement-au-canada");
    assert.equal(result.meta.live, false);
    assert.equal(result.opportunity.staleDetail, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
