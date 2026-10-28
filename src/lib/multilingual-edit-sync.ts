import type { CV } from "./cv-types";
import { DOCUMENT_LANGUAGES, type DocumentLanguage } from "./document-language";
import { parseCvChronology, rowChronology, sortCvChronology } from "./cv-chronology";

export type PendingChanges = NonNullable<CV["pending_translations"]>;
const dated = ["experiences", "formations", "educations"] as const;
type Dated = (typeof dated)[number];
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const meaningful = (value: unknown): boolean =>
  typeof value === "string"
    ? !!value.trim()
    : Array.isArray(value)
      ? value.some(meaningful)
      : value !== null &&
        value !== undefined &&
        (typeof value !== "object" || Object.values(value).some(meaningful));
const ignored = new Set([
  "id",
  "chronology",
  "logo",
  "photo",
  "language_logos",
  "section_order",
  "translation_review",
  "pending_translations",
  "destination_canada_tunis",
]);
const editorial = (key: string) => !ignored.has(key) && !key.endsWith("_format");
const safePath = (path: string) =>
  /^[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+){0,3}$/u.test(path) &&
  path.length <= 240 &&
  !path.split(".").some((key) => ["__proto__", "constructor", "prototype"].includes(key));

export function normalizePendingChanges(value: unknown): CV["pending_translations"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: PendingChanges = {};
  for (const [path, raw] of Object.entries(value).slice(0, 1500)) {
    if (!safePath(path) || !raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (
      !DOCUMENT_LANGUAGES.some(({ id }) => id === item.source_language) ||
      !["added", "modified", "deleted"].includes(String(item.kind))
    )
      continue;
    const serialized = JSON.stringify(item.source_value);
    if (!serialized || serialized.length > 50_000) continue;
    result[path] = {
      source_language: item.source_language as DocumentLanguage,
      kind: item.kind as PendingChanges[string]["kind"],
      source_value: structuredClone(item.source_value),
    };
  }
  return Object.keys(result).length ? result : undefined;
}

function changedFields(before: object, after: object) {
  return Object.keys(after).filter(
    (key) =>
      editorial(key) &&
      !equal((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key]),
  );
}

/** New elements are copied provisionally; existing translations are never silently overwritten. */
export function synchronizeMultilingualEdit(
  current: Record<DocumentLanguage, CV>,
  language: DocumentLanguage,
  edited: CV,
): Record<DocumentLanguage, CV> {
  const previous = current[language];
  const next = structuredClone(edited);
  for (const section of dated) {
    next[section] = next[section].map((row) => {
      const old = previous[section].find((item) => item.id === row.id);
      const field = section === "experiences" ? "dates" : "date";
      const raw = (row as unknown as Record<string, unknown>)[field];
      const oldRaw = old && (old as unknown as Record<string, unknown>)[field];
      return {
        ...row,
        chronology:
          !old || raw !== oldRaw ? parseCvChronology(String(raw ?? "")) : rowChronology(row),
      };
    }) as CV[typeof section] & CV["experiences"] & CV["formations"] & CV["educations"];
  }
  const ownPending = { ...next.pending_translations };
  const events: Array<{ path: string; value: unknown; kind: "added" | "modified" | "deleted" }> =
    [];
  for (const section of dated) {
    for (const row of next[section]) {
      const old = previous[section].find((item) => item.id === row.id);
      for (const field of changedFields(old ?? {}, row))
        events.push({
          path: `${section}.${row.id}.${field}`,
          value: (row as unknown as Record<string, unknown>)[field],
          kind: old ? "modified" : "added",
        });
    }
    for (const row of previous[section])
      if (!next[section].some((item) => item.id === row.id))
        events.push({ path: `${section}.${row.id}`, value: null, kind: "deleted" });
  }
  for (const field of changedFields(previous, next).filter(
    (key) => !dated.includes(key as Dated),
  )) {
    if (field === "lettre_motivation" || field === "langues") {
      for (const key of changedFields(previous[field], next[field]))
        events.push({
          path: `${field}.${key}`,
          value: (next[field] as unknown as Record<string, unknown>)[key],
          kind: "modified",
        });
    } else events.push({ path: field, value: next[field as keyof CV], kind: "modified" });
  }
  for (const event of events)
    if (ownPending[event.path])
      ownPending[event.path] = { ...ownPending[event.path], kind: "modified" };
  next.pending_translations = Object.keys(ownPending).length ? ownPending : undefined;
  const result = { ...current, [language]: sortCvChronology(next) };
  for (const { id } of DOCUMENT_LANGUAGES) {
    if (id === language) continue;
    const target = structuredClone(current[id]);
    const pending = { ...target.pending_translations };
    for (const section of dated) {
      for (const row of next[section]) {
        if (
          !previous[section].some((item) => item.id === row.id) &&
          !target[section].some((item) => item.id === row.id)
        ) {
          (
            target[section] as Array<
              CV["experiences"][number] | CV["formations"][number] | CV["educations"][number]
            >
          ).push(structuredClone(row));
        }
        target[section] = target[section].map((item) =>
          item.id === row.id ? { ...item, chronology: row.chronology } : item,
        ) as CV[typeof section] & CV["experiences"] & CV["formations"] & CV["educations"];
      }
    }
    for (const event of events) {
      if (event.kind === "added" && !meaningful(event.value)) continue;
      const parts = event.path.split(".");
      let holder = target as unknown as Record<string, unknown>;
      let field = parts[0];
      if (dated.includes(parts[0] as Dated) && parts.length === 3) {
        const section = parts[0] as Dated;
        const row = target[section].find((item) => item.id === parts[1]);
        if (!row) continue;
        holder = row as unknown as Record<string, unknown>;
        field = parts[2];
      } else if (
        (parts[0] === "lettre_motivation" || parts[0] === "langues") &&
        parts.length === 2
      ) {
        holder = target[parts[0]] as unknown as Record<string, unknown>;
        field = parts[1];
      }
      const prior = pending[event.path];
      const provisional = prior?.kind === "added" && prior.source_language === language;
      const empty = !meaningful(holder[field]) && !prior;
      if (
        event.kind !== "deleted" &&
        !prior &&
        event.kind !== "added" &&
        equal(holder[field], event.value)
      )
        continue;
      if (event.kind !== "deleted" && (empty || provisional))
        holder[field] = structuredClone(event.value);
      pending[event.path] = {
        source_language: language,
        kind:
          event.kind === "deleted"
            ? "deleted"
            : empty || provisional || event.kind === "added"
              ? "added"
              : "modified",
        source_value: event.value === undefined ? null : structuredClone(event.value),
      };
    }
    target.pending_translations = Object.keys(pending).length ? pending : undefined;
    if (events.length) target.translation_review = { source_language: language };
    result[id] = sortCvChronology(target);
  }
  return result;
}

/** Validation acknowledges current target text; it does not copy untranslated source prose. */
export function acknowledgeTranslation(cv: CV, path: string): CV {
  if (!cv.pending_translations?.[path]) return cv;
  const next = structuredClone(cv),
    pending = { ...next.pending_translations };
  if (pending[path].kind === "deleted") {
    const [section, id] = path.split(".");
    if (dated.includes(section as Dated))
      next[section as Dated] = next[section as Dated].filter(
        (row) => row.id !== id,
      ) as CV["experiences"] & CV["formations"] & CV["educations"];
    for (const key of Object.keys(pending)) if (key.startsWith(`${path}.`)) delete pending[key];
  }
  delete pending[path];
  next.pending_translations = Object.keys(pending).length ? pending : undefined;
  // A per-field review must not falsely clear a pre-existing whole-profile warning.
  return next;
}

export function remapDatedVisibility(
  hidden: Record<string, true>,
  before: CV,
): Record<string, true> {
  const result: Record<string, true> = {};
  const mapping = {
    experience: "experiences",
    formation: "formations",
    education: "educations",
  } as const;
  for (const [path, value] of Object.entries(hidden)) {
    const match = path.match(/^(experience|formation|education)\.(\d+)(.*)$/);
    if (!match) {
      result[path] = value;
      continue;
    }
    const section = mapping[match[1] as keyof typeof mapping];
    const id = before[section][+match[2]]?.id;
    if (id) result[`${match[1]}Id.${id}${match[3]}`] = value;
  }
  return result;
}
