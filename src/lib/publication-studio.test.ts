import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLICATION_PAGES,
  buildLocalPublicationBatch,
  getBaselinePublicationEvidence,
  normalizePublicationBatch,
  publicationImagePrompt,
  publicationPrompt,
  type PublicationEvidence,
} from "./publication-studio";

const page = PUBLICATION_PAGES[0];
const evidence: PublicationEvidence[] = [
  {
    id: "official:1",
    title: "Offre officielle",
    destination: "Canada",
    source: "Source officielle",
    description: "Une offre contrôlée.",
    deadlineAt: null,
    positions: ["Technicien"],
    conditions: ["Expérience demandée"],
    requiredDocuments: ["CV"],
    applicationUrl: "https://example.com/apply",
    sourceUrl: "https://example.com/source",
    checkedAt: "2026-10-11T12:00:00.000Z",
  },
];

function tenPosts(body = "📢 معلومة موثوقة\n\n✅ الشروط واضحة\n\n#فرصة_موثوقة #ملف_ترشح") {
  return {
    posts: Array.from({ length: 10 }, (_, index) => ({
      format: "visual",
      objective: "information",
      headline: `فرصة رقم ${index + 1}`,
      body,
      comments: ["تعليق 1", "تعليق 2", "تعليق 3", "تعليق 4", "تعليق 5"],
      highlightedTerms: ["السيرة الذاتية", "آخر أجل"],
      evidenceId: "official:1",
      visual: {
        eyebrow: "فرصة موثوقة",
        title: "حضّر ملفك",
        subtitle: "راجع المصدر الرسمي",
        cta: "شوف التفاصيل",
        badges: ["سيرة ذاتية", "تقديم"],
      },
    })),
  };
}

test("builds exactly ten visual drafts from referenced evidence", () => {
  const batch = normalizePublicationBatch(tenPosts(), page, evidence, "2026-10-11T13:00:00Z");
  assert.equal(batch.posts.length, 10);
  assert.equal(batch.posts[0].sourceUrl, evidence[0].sourceUrl);
  assert.equal(batch.posts[0].deadlineAt, null);
  assert.equal(batch.posts[9].visual?.badges.length, 2);
});

test("rejects invented evidence and forbidden parentheses", () => {
  const unknown = tenPosts();
  unknown.posts[0].evidenceId = "invented:99";
  assert.throws(() => normalizePublicationBatch(unknown, page, evidence), /au lieu de 10/);
  assert.throws(
    () =>
      normalizePublicationBatch(tenPosts("Texte interdit avec parenthèses (faux)"), page, evidence),
    /parenthèses interdites/,
  );
});

test("the prompt carries page-specific dialect and source evidence", () => {
  const prompt = publicationPrompt(page, evidence, "CV ATS");
  assert.match(prompt, /arabe algérien/);
  assert.match(prompt, /official:1/);
  assert.match(prompt, /CV ATS/);
  assert.match(prompt, /N'invente aucune date/);
  assert.match(prompt, /uniquement l'arabe/);
});

test("the local engine always creates ten safe visual Algerian publications without an API", () => {
  const batch = buildLocalPublicationBatch({
    page,
    evidence,
    focus: "technicien",
    generatedAt: "2026-10-11T14:00:00.000Z",
  });
  assert.equal(batch.posts.length, 10);
  assert.ok(batch.posts.every((post) => post.format === "visual" && post.visual));
  batch.posts.forEach((post) => {
    assert.equal(post.comments.length, 5);
    assert.equal(post.sourceUrl, evidence[0].sourceUrl);
    assert.doesNotMatch(`${post.headline}${post.body}${post.comments.join("")}`, /[()]/);
    assert.doesNotMatch(
      `${post.headline}${post.body}${post.comments.join("")}${post.highlightedTerms.join("")}${post.visual ? Object.values(post.visual).flat().join("") : ""}`,
      /[A-Za-zÀ-ÖØ-öø-ÿ]/,
    );
    assert.match(post.body, /✅/);
    assert.match(post.body.split("\n").filter(Boolean).at(-1) || "", /^#.+\s+#/);
  });
});

test("the local engine distributes a publication calendar across available evidence", () => {
  const variedEvidence = Array.from({ length: 7 }, (_, index) => ({
    ...evidence[0],
    id: `official:${index + 1}`,
    title: `Offre officielle ${index + 1}`,
    destination: `Destination ${index + 1}`,
    source: `Source officielle ${index + 1}`,
  }));
  const batch = buildLocalPublicationBatch({
    page: PUBLICATION_PAGES[1],
    evidence: variedEvidence,
  });
  const usage = new Map<string, number>();
  batch.posts.forEach((post) => usage.set(post.evidenceId, (usage.get(post.evidenceId) || 0) + 1));
  assert.ok(usage.size >= 6);
  assert.ok([...usage.values()].every((count) => count <= 2));
});

test("deadline campaigns visibly include the services offered for that opportunity", () => {
  const atct = {
    ...evidence[0],
    id: "atct:canada",
    title: "Canada — offre officielle",
    source: "Agence tunisienne de coopération technique",
    deadlineAt: "2026-10-16T22:59:00.000Z",
  };
  const batch = buildLocalPublicationBatch({ page: PUBLICATION_PAGES[1], evidence: [atct] });
  assert.match(batch.posts[0].body, /🟩 خدماتنا لهذه الفرصة/);
  assert.match(batch.posts[0].body, /سيرة ذاتية كندية/);
  assert.match(batch.posts[0].body, /آخر أجل للتسجيل هو/);
});

test("provides a safe text-free GPT image prompt for every visual draft", () => {
  const batch = buildLocalPublicationBatch({ page, evidence });
  const prompt = publicationImagePrompt(batch.posts[0], page);
  assert.match(prompt, /4:3/);
  assert.match(prompt, /1600 × 1200/);
  assert.match(prompt, /palette rouge, blanc et jaune/);
  assert.match(prompt, /Aucune promesse de visa/);
});

test("the local engine applies distinct Tunisian page voices", () => {
  const emplois = buildLocalPublicationBatch({ page: PUBLICATION_PAGES[1], evidence });
  const bissane = buildLocalPublicationBatch({ page: PUBLICATION_PAGES[2], evidence });
  assert.equal(emplois.posts.length, 10);
  assert.equal(bissane.posts.length, 10);
  assert.notEqual(emplois.posts[0].headline, bissane.posts[0].headline);
  assert.notEqual(emplois.posts[0].body, bissane.posts[0].body);
  assert.match(emplois.posts[0].body, /شنوّة الفرصة/);
  assert.match(bissane.posts[0].body, /علاش الفرصة تستحق الاهتمام/);
  assert.match(emplois.posts[0].body, /#انتداب_دولي/);
  assert.match(bissane.posts[0].body, /#فرصتك_تبدأ_من_هنا/);
});

test("the built-in verified catalog can prepare all pages without waiting for APIs", () => {
  const dz = getBaselinePublicationEvidence("DZ");
  const tn = getBaselinePublicationEvidence("TN");
  assert.ok(dz.length >= 4);
  assert.ok(tn.length >= 5);
  assert.ok(dz.every((item) => item.sourceUrl.startsWith("https://")));
  assert.ok(tn.some((item) => item.id === "baseline:thamm-plus"));
});

test("DV-2027 is a watch item, never an announced registration deadline", () => {
  const watch = getBaselinePublicationEvidence("DZ").find(
    (item) => item.id === "baseline:us-diversity-visa-2027-watch",
  );
  assert.ok(watch);
  assert.equal(watch.deadlineAt, null);
  assert.match(watch.description, /n’est pas publiée/i);
  const batch = buildLocalPublicationBatch({ page, evidence: [watch] });
  assert.match(batch.posts[0].body, /ما تسجلش/);
  assert.doesNotMatch(batch.posts[0].body, /آخر أجل للتسجيل هو/);
});

test("the local engine translates source meaning without leaking foreign-language text", () => {
  const longEvidence = [
    {
      ...evidence[0],
      title: "heavy equipment operator",
      destination: "Granada, Spain",
      source: "Portail européen de la jeunesse",
      conditions: ["English required and previous experience requested"],
    },
  ];
  const batch = buildLocalPublicationBatch({ page, evidence: longEvidence });
  assert.ok(batch.posts[0].body.length < 1_500);
  assert.match(batch.posts[0].body, /مشغّل معدات ثقيلة/);
  assert.match(batch.posts[0].body, /🇪🇺/);
  assert.match(batch.posts[0].body, /اللغة الإنجليزية/);
  assert.doesNotMatch(batch.posts[0].body, /[A-Za-zÀ-ÖØ-öø-ÿ]/);
});

test("labels team volunteering as participation, never as an ambiguous professional field", () => {
  const batch = buildLocalPublicationBatch({
    page,
    evidence: [
      {
        ...evidence[0],
        title: "Volunteer in youth office",
        destination: "Germany",
        positions: ["teams"],
      },
    ],
  });
  assert.match(batch.posts[0].body, /🤝 نوع المشاركة\nتطوّع ضمن فريق/);
  assert.doesNotMatch(batch.posts[0].body, /🔎 المجال/);
  assert.doesNotMatch(batch.posts[0].body, /المجال المهني المحدد في الإعلان/);
});

test("rejects AI output that leaks Latin text or misses final Arabic hashtags", () => {
  assert.throws(
    () =>
      normalizePublicationBatch(
        tenPosts("معلومة فيها CV\n\n#فرصة_موثوقة #ملف_ترشح"),
        page,
        evidence,
      ),
    /non arabe/,
  );
  assert.throws(
    () => normalizePublicationBatch(tenPosts("معلومة عربية بلا وسوم"), page, evidence),
    /hashtags arabes/,
  );
});
