import assert from "node:assert/strict";
import test from "node:test";

import {
  ALGERIA_WILAYAS,
  fetchTelegramHtml,
  parseTelegramPostHtml,
  refreshAlgeriaOpportunityCache,
  searchAlgeriaOpportunities,
  telegramPostUrl,
} from "./algeria-opportunities.js";

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

function telegramHtml(id, description) {
  return `<html><head>
    <meta property="og:url" content="https://t.me/rcrdz1/${id}">
    <meta property="og:description" content="${description.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">
  </head></html>`;
}

const boumerdesPost = telegramHtml(
  22072,
  `📢 إعــــلان تــــوظــيــف | RECRUTEMENT
🏫 مدرسة خاصة ببومرداس تعلن عن فتح منصب توظيف لفائدة:
💼 Comptable – محاسب(ة)
📍 مكان العمل:
🔹 Boumerdès – بومرداس
📩 طريقة التقديم | Candidature :
يرجى إرسال السيرة الذاتية (CV) إلى البريد الإلكتروني:
📧 recrutement.ecole@example.com
━━━━━━━━━━━━━━━━━━
هل تريد زيادة فرص قبولك؟
واتساب 0776837862`,
);

test("référence exactement les 69 wilayas officielles de 2026", () => {
  assert.equal(ALGERIA_WILAYAS.length, 69);
  assert.deepEqual(ALGERIA_WILAYAS.slice(58), [
    "Aflou",
    "Barika",
    "El Kantara",
    "Bir El Ater",
    "El Aricha",
    "Ksar Chellala",
    "Aïn Oussara",
    "Messaad",
    "Ksar El Boukhari",
    "Bou Saâda",
    "El Abiodh Sidi Cheikh",
  ]);
});

test("extrait poste, wilaya, commune et e-mail sans reprendre le contact promotionnel", () => {
  const item = parseTelegramPostHtml(boumerdesPost, 22072, "2026-10-03T12:25:00.000Z");
  assert.equal(item.title, "Comptable – محاسب(ة)");
  assert.equal(item.wilaya, "Boumerdès");
  assert.equal(item.commune, "Boumerdès – بومرداس");
  assert.deepEqual(item.positions, ["Comptable – محاسب(ة)"]);
  assert.equal(item.applicationMethod.type, "email");
  assert.equal(item.applicationMethod.email, "recrutement.ecole@example.com");
  assert.equal(item.applicationMethod.phone, null);
  assert.doesNotMatch(item.description, /0776837862/);
  assert.deepEqual(item.requiredDocuments, ["CV"]);
});

test("rattache une commune connue à sa wilaya et conserve le lieu publié", () => {
  const item = parseTelegramPostHtml(
    telegramHtml(
      22071,
      `OFFRE D'EMPLOI
🏢 Hôtel recrute
💼 Réceptionniste
📍 Lieu de travail : Bordj El Kiffan
Contact : +213 555 11 22 33`,
    ),
    22071,
  );
  assert.equal(item.wilaya, "Alger");
  assert.equal(item.commune, "Bordj El Kiffan");
  assert.equal(item.applicationMethod.type, "phone");
  assert.equal(item.applicationMethod.phone, "+213 555 11 22 33");
});

test("identifie Hassi Messaoud comme commune de Ouargla", () => {
  const item = parseTelegramPostHtml(
    telegramHtml(
      22060,
      `إعلان توظيف
🏢 SPA PROCAMP
المناصب المطلوبة
• Ingénieur HSE
• Superviseur chantier
📍 مكان العمل: Hassi Messaoud – Ouargla
للتقديم: https://jobs.example.dz/apply`,
    ),
    22060,
  );
  assert.equal(item.wilaya, "Ouargla");
  assert.equal(item.commune, "Hassi Messaoud – Ouargla");
  assert.deepEqual(item.positions, ["Ingénieur HSE", "Superviseur chantier"]);
  assert.equal(item.applicationMethod.type, "external_link");
});

test("conserve toutes les wilayas d’une offre multi-régions sans confondre Algérie avec Alger", () => {
  const item = parseTelegramPostHtml(
    telegramHtml(
      22067,
      `إعلان توظيف في الجزائر
💼 Business Development Manager
📍 مكان العمل:
🔹 M’Sila – المسيلة
🔹 Jijel – جيجل
إرسال CV عبر LinkedIn`,
    ),
    22067,
  );
  assert.deepEqual(item.wilayas, ["M’Sila", "Jijel"]);
  assert.equal(item.wilaya, "M’Sila");
  assert.match(item.commune, /M’Sila.*Jijel/);
});

test("signale honnêtement les champs absents au lieu de les inventer", () => {
  const item = parseTelegramPostHtml(
    telegramHtml(
      22050,
      "Une entreprise recrute plusieurs profils. Consultez la publication pour les détails.",
    ),
    22050,
  );
  assert.equal(item.wilaya, null);
  assert.equal(item.applicationMethod.type, "source_only");
  assert.equal(item.dataQuality.status, "partial");
  assert.deepEqual(item.dataQuality.missingFields, ["wilaya", "poste", "contact_candidature"]);
});

test("refuse les domaines et canaux externes", async () => {
  assert.equal(telegramPostUrl(22072), "https://t.me/rcrdz1/22072");
  await assert.rejects(
    () => fetchTelegramHtml("https://example.com/rcrdz1/22072", async () => new Response("x")),
    /non autorisée/,
  );
  await assert.rejects(
    () => fetchTelegramHtml("https://t.me/autre/22072", async () => new Response("x")),
    /non autorisé/,
  );
});

test("filtre le cache par wilaya, commune et poste", async () => {
  const boumerdes = parseTelegramPostHtml(boumerdesPost, 22072, new Date().toISOString());
  const ouargla = parseTelegramPostHtml(
    telegramHtml(
      22060,
      "💼 Ingénieur HSE\n📍 Lieu de travail : Hassi Messaoud – Ouargla\n📧 hse@example.com",
    ),
    22060,
    new Date().toISOString(),
  );
  const bucket = memoryBucket({
    "public-cache/algeria-telegram-jobs-latest.json": JSON.stringify({
      version: 2,
      fetchedAt: new Date().toISOString(),
      highWaterMark: 22072,
      scanned: 26,
      opportunities: [boumerdes, ouargla],
    }),
  });
  const byWilaya = await searchAlgeriaOpportunities(
    { CLIENTS_BUCKET: bucket },
    { period: "recent", wilaya: "Ouargla" },
  );
  assert.equal(byWilaya.opportunities.length, 1);
  assert.equal(byWilaya.opportunities[0].id, "22060");
  const byQuery = await searchAlgeriaOpportunities(
    { CLIENTS_BUCKET: bucket },
    { period: "recent", query: "comptable boumerdes" },
  );
  assert.equal(byQuery.opportunities.length, 1);
  assert.equal(byQuery.opportunities[0].id, "22072");
});

test("conserve le cache vérifié quand aucun nouveau message n’est publié", async () => {
  const cached = parseTelegramPostHtml(boumerdesPost, 22072, "2026-10-03T12:25:00.000Z");
  const bucket = memoryBucket({
    "public-cache/algeria-telegram-jobs-latest.json": JSON.stringify({
      version: 2,
      fetchedAt: "2026-10-03T00:00:00.000Z",
      highWaterMark: 22072,
      scanned: 26,
      opportunities: [cached],
    }),
  });
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("absent", { status: 404 });
  try {
    const refreshed = await refreshAlgeriaOpportunityCache({ CLIENTS_BUCKET: bucket });
    assert.equal(refreshed.highWaterMark, 22072);
    assert.equal(refreshed.opportunities.length, 1);
    assert.equal(refreshed.scanned, 4);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
