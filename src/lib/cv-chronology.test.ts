import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCvChronology,
  sortDatedRows,
  sortCvChronology,
  reversedChronology,
} from "./cv-chronology";
import { emptyCV } from "./cv-types";
import { applyCvVisibility } from "./cv-visibility";
import { remapDatedVisibility } from "./multilingual-edit-sync";

test("seven languages resolve the same canonical months and ongoing dates", () => {
  for (const text of [
    "Janvier 2020 – Mars 2024",
    "January 2020 – March 2024",
    "Enero 2020 – Marzo 2024",
    "Januar 2020 – März 2024",
    "Gennaio 2020 – Marzo 2024",
    "2020年1月 – 2024年3月",
    "يناير ٢٠٢٠ – مارس ٢٠٢٤",
  ]) {
    assert.deepEqual(
      parseCvChronology(text),
      { start: "2020-01", end: "2024-03", ongoing: false },
      text,
    );
  }
  for (const text of [
    "2024 – En cours",
    "2024 – Present",
    "2024 – Actualidad",
    "2024 – Heute",
    "2024 – Presente",
    "2024 – 至今",
    "2024 – حتى الآن",
  ])
    assert.equal(parseCvChronology(text).ongoing, true, text);
});

test("ongoing first, then end and start dates; unknown and ambiguous dates last with stable ties", () => {
  const rows = [
    { id: "unknown", date: "" },
    { id: "old", date: "2020 – 2021" },
    { id: "new", date: "2025-03 – 2026-05" },
    { id: "ongoing", date: "2022 – en cours" },
    { id: "earlier-start", date: "2024-01 – 2026-05" },
    { id: "tie", date: "2025-03 – 2026-05" },
    { id: "ambiguous", date: "02/03/2026" },
  ];
  assert.deepEqual(
    sortDatedRows(rows).map((row) => row.id),
    ["ongoing", "new", "tie", "earlier-start", "old", "unknown", "ambiguous"],
  );
  assert.equal(rows[0].id, "unknown");
  assert.equal(parseCvChronology("5 ans").start, "");
  assert.equal(parseCvChronology("2024").start, "2024");
});

test("visibility remains tied to IDs after sorting, across languages and after a row deletion", () => {
  const cv = structuredClone(emptyCV);
  cv.experiences = ["2020", "2026"].map((dates, index) => ({
    id: `id${index}`,
    dates,
    titre: `Title${index}`,
    lieu: "",
    employeur: "",
    descriptions: ["Fact"],
  }));
  const hidden = remapDatedVisibility({ "experience.0.titre": true }, cv);
  assert.deepEqual(hidden, { "experienceId.id0.titre": true });
  const sorted = sortCvChronology(cv);
  assert.equal(
    applyCvVisibility(sorted, hidden).experiences.find((row) => row.id === "id0")!.titre,
    "",
  );
  assert.equal(
    applyCvVisibility(sorted, hidden).experiences.find((row) => row.id === "id1")!.titre,
    "Title1",
  );
  sorted.experiences = sorted.experiences.filter((row) => row.id !== "id1");
  assert.equal(applyCvVisibility(sorted, hidden).experiences[0].titre, "");
});

test("invalid calendar dates are never treated as confirmed dates; reversed ranges are detected", () => {
  for (const text of ["2026-02-30", "2026-13", "2026-04-31"])
    assert.equal(parseCvChronology(text).start, "", text);
  assert.equal(parseCvChronology("2024-02-29").start, "2024-02-29");
  assert.equal(reversedChronology(parseCvChronology("2026-05 – 2025-01")), true);
  assert.equal(reversedChronology(parseCvChronology("2026-05 – 2026")), false);
});
