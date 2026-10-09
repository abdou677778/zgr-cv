import assert from "node:assert/strict";
import test from "node:test";

import {
  RELOCATION_STATUS_MAX_CHARS,
  defaultRelocationStatus,
  normalizeRelocationStatus,
} from "./relocation-status";

test("keeps every localized relocation label within the 33 character contract", () => {
  for (const language of ["fr", "en", "es", "de", "it", "zh", "ar"] as const) {
    assert.ok(Array.from(defaultRelocationStatus(language)).length <= RELOCATION_STATUS_MAX_CHARS);
    assert.ok(
      Array.from(defaultRelocationStatus(language, "canada")).length <= RELOCATION_STATUS_MAX_CHARS,
    );
  }
  assert.equal(defaultRelocationStatus("en", "canada"), "Open to relocate to Canada");
  assert.equal(defaultRelocationStatus("en"), "Open to relocate");
});

test("fills an empty status and replaces overlong imported values with a complete phrase", () => {
  assert.equal(normalizeRelocationStatus("", "fr", { fillEmpty: true }), "Mobile géographiquement");
  assert.equal(normalizeRelocationStatus("x".repeat(80), "en"), "Open to relocate");
});
