import assert from "node:assert/strict";
import test from "node:test";

test("wraps Arabic into indivisible PDF lines without changing logical word order", async () => {
  const rtlModule = await import("./arabic-pdf-text.ts").catch(() => undefined);
  const source = "مهندس برمجيات متكامل طموح يتمتع بخبرة واسعة";

  assert.deepEqual(rtlModule?.toPdfRtlLines(source, 23), [
    "مهندس\u00a0برمجيات\u00a0متكامل",
    "طموح\u00a0يتمتع\u00a0بخبرة\u00a0واسعة",
  ]);
});

test("keeps mixed Arabic, Latin tokens and numbers in logical order", async () => {
  const rtlModule = await import("./arabic-pdf-text.ts").catch(() => undefined);

  assert.equal(
    rtlModule?.toPdfRtlVisualText("خبرة في React و Node.js منذ 2022", 80),
    "خبرة\u00a0في\u00a0React\u00a0و\u00a0Node.js\u00a0منذ\u00a0\u200e2202\u200e",
  );
});

test("prepares Western date digits for pdfMake's Arabic visual ordering", async () => {
  const rtlModule = await import("./arabic-pdf-text.ts").catch(() => undefined);

  assert.equal(
    rtlModule?.protectPdfRtlNumbers("2022 يونيو – 2025 أكتوبر"),
    "\u200e2202\u200e يونيو – \u200e5202\u200e أكتوبر",
  );
});
