import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TechBrandLogoImage, TechBrandLogo } from "../components/tech-brand-logo";
import { techLogoModes, validTechLogoMode } from "./tech-branding";
test("Brand logo offers circle, rounded square and square without altering the original artwork", () => {
  const classes = {
    circle: "rounded-full",
    rounded: "rounded-xl",
    square: "rounded-none",
  } as const;
  assert.equal(Object.keys(techLogoModes).length, 3);
  for (const mode of Object.keys(classes) as (keyof typeof classes)[]) {
    const html = renderToStaticMarkup(createElement(TechBrandLogoImage, { mode }));
    assert.ok(html.includes(classes[mode]));
    assert.match(html, /src="\/branding\/zgr-tech-logo.jpg"/);
    assert.match(html, /alt="ZGR Tech"/);
    assert.match(html, /object-contain/);
  }
  assert.equal(validTechLogoMode(null), "circle");
  assert.equal(validTechLogoMode("unexpected"), "circle");
  assert.equal(validTechLogoMode("rounded"), "rounded");
  assert.equal(validTechLogoMode("square"), "square");
});
test("Logo picker is accessible, defaults to circle and the published asset is a JPEG", () => {
  const html = renderToStaticMarkup(createElement(TechBrandLogo));
  assert.match(html, /Choisir l’affichage du logo ZGR Tech/);
  assert.match(html, /rounded-full/);
  const bytes = readFileSync(new URL("../../public/branding/zgr-tech-logo.jpg", import.meta.url));
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  assert.ok(bytes.length > 1000 && bytes.length < 200000);
});
