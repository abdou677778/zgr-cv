import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TechOrderNote, TechOrderClientLink } from "../components/tech-order-details";

test("Sale notes are compact, expandable, preserve line breaks and never render client HTML", () => {
  const notes = "ملاحظة خاصة\n<script>alert(1)</script>";
  const html = renderToStaticMarkup(createElement(TechOrderNote, { notes }));
  assert.match(html, /line-clamp-2/);
  assert.match(html, /whitespace-pre-wrap/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /Voir toute la note/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(
    renderToStaticMarkup(createElement(TechOrderNote, { notes: "  " })),
    /button/,
  );
});
test("Direct client button uses the stored HTTPS link and rejects unsafe or missing URLs", () => {
  const html = renderToStaticMarkup(
    createElement(TechOrderClientLink, {
      client: "CLIENT FICTIF",
      url: "https://facebook.com/example",
    }),
  );
  assert.match(html, /href="https:\/\/facebook.com\/example"/);
  assert.match(html, /Ouvrir le profil de CLIENT FICTIF/);
  assert.match(html, /noopener noreferrer/);
  assert.match(html, /target="_blank"/);
  for (const url of [
    "",
    "javascript:alert(1)",
    "http://facebook.com/example",
    "https://user:secret@example.com",
  ])
    assert.doesNotMatch(
      renderToStaticMarkup(createElement(TechOrderClientLink, { client: "CLIENT FICTIF", url })),
      /<a\b/,
    );
});
test("Desktop and mobile reuse the same action menu with distinct trigger IDs and a ninth Note column", () => {
  const source = readFileSync(
    new URL("../components/tech-orders-workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /orderMenu\(item, "mobile"\)/);
  assert.match(source, /orderMenu\(item, "desktop"\)/);
  assert.match(source, /tech-actions-\$\{surface\}-\$\{item.id\}/);
  assert.doesNotMatch(source, /const actionsFor|const mobileMenu/);
  assert.match(source, /<TechOrderNote notes=\{item.notes\}/);
  assert.match(source, /colSpan=\{9\}/);
  assert.match(
    source,
    /document.getElementById\(triggerId\)\?\.focus\(\{ preventScroll: true \}\)/,
  );
});
