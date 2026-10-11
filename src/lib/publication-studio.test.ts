import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLICATION_PAGES,
  normalizePublicationBatch,
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

function fivePosts(body = "معلومة موثوقة مع CV و Deadline غير منشور") {
  return {
    posts: Array.from({ length: 5 }, (_, index) => ({
      format: index < 2 ? "short" : "visual",
      objective: "information",
      headline: `فرصة رقم ${index + 1}`,
      body,
      comments: ["تعليق 1", "تعليق 2", "تعليق 3", "تعليق 4", "تعليق 5"],
      highlightedTerms: ["CV", "Deadline"],
      evidenceId: "official:1",
      visual:
        index < 2
          ? null
          : {
              eyebrow: "فرصة موثوقة",
              title: "حضّر ملفك",
              subtitle: "راجع المصدر الرسمي",
              cta: "شوف التفاصيل",
              badges: ["CV", "Apply"],
            },
    })),
  };
}

test("builds exactly five drafts from referenced evidence", () => {
  const batch = normalizePublicationBatch(fivePosts(), page, evidence, "2026-10-11T13:00:00Z");
  assert.equal(batch.posts.length, 5);
  assert.equal(batch.posts[0].sourceUrl, evidence[0].sourceUrl);
  assert.equal(batch.posts[0].deadlineAt, null);
  assert.equal(batch.posts[4].visual?.badges.length, 2);
});

test("rejects invented evidence and forbidden parentheses", () => {
  const unknown = fivePosts();
  unknown.posts[0].evidenceId = "invented:99";
  assert.throws(() => normalizePublicationBatch(unknown, page, evidence), /au lieu de 5/);
  assert.throws(
    () =>
      normalizePublicationBatch(
        fivePosts("Texte interdit avec parenthèses (faux)"),
        page,
        evidence,
      ),
    /parenthèses interdites/,
  );
});

test("the prompt carries page-specific dialect and source evidence", () => {
  const prompt = publicationPrompt(page, evidence, "CV ATS");
  assert.match(prompt, /arabe algérien/);
  assert.match(prompt, /official:1/);
  assert.match(prompt, /CV ATS/);
  assert.match(prompt, /N'invente aucune date/);
});
