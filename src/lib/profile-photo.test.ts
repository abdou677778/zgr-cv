import assert from "node:assert/strict";
import test from "node:test";

import { normalizeProfilePhoto, PROFILE_PHOTO_MAX_BYTES, profilePhotoBlob } from "./profile-photo";

test("accepts compact WebP profile-photo metadata and rejects oversized or foreign images", () => {
  const valid = normalizeProfilePhoto({
    dataUrl: "data:image/webp;base64,UklGRg==",
    name: "portrait.webp",
    width: 800,
    height: 800,
    sizeBytes: PROFILE_PHOTO_MAX_BYTES,
    mimeType: "image/webp",
    updatedAt: "2026-08-31T00:00:00.000Z",
  });

  assert.equal(valid?.mimeType, "image/webp");
  assert.equal(valid?.sizeBytes, PROFILE_PHOTO_MAX_BYTES);
  assert.equal(
    normalizeProfilePhoto({ ...valid, sizeBytes: PROFILE_PHOTO_MAX_BYTES + 1 }),
    undefined,
  );
  assert.equal(
    normalizeProfilePhoto({ ...valid, dataUrl: "data:image/png;base64,iVBORw0KGgo=" }),
    undefined,
  );
});

test("accepts R2-only metadata without embedding the photo bytes in profile JSON", () => {
  const value = normalizeProfilePhoto({
    r2Key: "clients/ZGR-20260831-ABC/photo.webp",
    name: "photo-profil.webp",
    width: 900,
    height: 900,
    sizeBytes: 100_000,
    mimeType: "image/webp",
    updatedAt: "2026-08-31T00:00:00.000Z",
  });

  assert.equal(value?.r2Key, "clients/ZGR-20260831-ABC/photo.webp");
  assert.equal(value?.dataUrl, undefined);
});

test("decodes the embedded WebP locally without a data-URL network request", async () => {
  const blob = await profilePhotoBlob({
    dataUrl: "data:image/webp;base64,UklGRg==",
    name: "portrait.webp",
    width: 160,
    height: 160,
    sizeBytes: 4,
    mimeType: "image/webp",
    updatedAt: "2026-08-31T00:00:00.000Z",
  });
  assert.equal(blob.type, "image/webp");
  assert.equal(blob.size, 4);
});
