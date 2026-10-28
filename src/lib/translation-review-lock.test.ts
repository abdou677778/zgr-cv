import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TranslationChangesProvider,
  TranslationChangeNotice,
} from "../components/translation-change-review";
import { emptyCV, type CV } from "./cv-types";

test("approved/read-only profiles expose changes but cannot acknowledge or delete them", () => {
  const cv: CV = {
    ...structuredClone(emptyCV),
    pending_translations: {
      objectif: { source_language: "fr", kind: "modified", source_value: "Updated source" },
    },
  };
  let calls = 0;
  const html = renderToStaticMarkup(
    createElement(TranslationChangesProvider, {
      cv,
      readOnly: true,
      onAcknowledge: () => {
        calls++;
      },
      children: createElement(TranslationChangeNotice),
    }),
  );
  assert.match(html, /Updated source/);
  assert.match(html, /<button[^>]*disabled/);
  assert.equal(calls, 0);
  assert.equal(cv.pending_translations!.objectif.source_value, "Updated source");
});
