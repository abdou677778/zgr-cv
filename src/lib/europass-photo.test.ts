import assert from "node:assert/strict";
import test from "node:test";

import { emptyCV } from "./cv-types";
import { convertCvToEuropassXml } from "./europass-xml";

test("embeds the visible profile photo as the Europass Candidate photo attachment", () => {
  const cv = structuredClone(emptyCV);
  cv.nom_complet = "Amine Bensalem";
  cv.photo = {
    dataUrl: "data:image/webp;base64,UklGRg==",
    name: "photo-profil.webp",
    width: 600,
    height: 600,
    sizeBytes: 7,
    mimeType: "image/webp",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };

  const xml = convertCvToEuropassXml(cv, "fr", {
    dataUrl: "data:image/jpeg;base64,UklGRg==",
    mimeType: "image/jpeg",
    filename: "photo-profil.jpg",
  });
  assert.match(xml, /<oa:EmbeddedData mimeCode="image\/jpeg"/);
  assert.match(xml, />UklGRg==<\/oa:EmbeddedData>/);
  assert.match(xml, /<oa:FileType[^>]*>photo<\/oa:FileType>/);
  assert.match(xml, /<AttachmentXPath>\/Candidate\/CandidatePerson<\/AttachmentXPath>/);
});
