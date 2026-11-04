import test from "node:test";
import assert from "node:assert/strict";
import { softwareLogoSubset } from "./software-logo-subset.js";
test("Targeted logo read stays bounded, deduplicates slugs and never lists the full catalog", async () => {
  const keys = [];
  let active = 0,
    peak = 0;
  const bucket = {
    get: async (key) => {
      keys.push(key);
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      return {
        text: async () =>
          JSON.stringify({ slug: key.split("/").at(-1).replace(".json", ""), dataUrl: "logo" }),
      };
    },
  };
  const slugs = Array.from({ length: 20 }, (_, i) => `s-${i}`);
  const logos = await softwareLogoSubset(bucket, [...slugs, slugs[0]].join(","));
  assert.equal(Object.keys(logos).length, 20);
  assert.equal(keys.length, 20);
  assert.ok(peak <= 8);
  assert.ok(keys.every((k) => k.startsWith("software-logos/current/")));
  await assert.rejects(() => softwareLogoSubset(bucket, "../orders"), /invalide/);
  await assert.rejects(
    () => softwareLogoSubset(bucket, Array.from({ length: 81 }, (_, i) => `s-${i}`).join(",")),
    /invalide/,
  );
});
