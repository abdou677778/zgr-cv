import { auditMultilingualDocuments, CV_LANGUAGES } from "./multilingual-audit";
import {
  normalizeChronology,
  parseCvChronology,
  sortDatedRows,
  reversedChronology,
} from "./cv-chronology";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {};
const strings = [
  "nom_complet",
  "titre_poste",
  "telephone",
  "email",
  "adresse",
  "statut_relocation",
  "date_naissance",
  "situation_familiale",
  "permis_conduire",
  "service_national",
  "wilaya",
  "pays",
  "candidature",
  "objectif",
];
const lists = [
  "competences",
  "participations",
  "certifications",
  "interets",
  "references",
  "plan_developpement",
];
const sections: Record<string, string[]> = {
  experiences: ["id", "dates", "lieu", "titre", "employeur"],
  formations: ["id", "date", "lieu", "titre", "institution", "competences"],
  educations: ["id", "date", "lieu", "titre", "institution", "option", "equivalence"],
  logiciels: ["id", "label", "icon"],
  custom_sections: ["id", "title"],
};
const digits = (value: unknown) =>
  String(value ?? "").replace(/[٠-٩۰-۹]/g, (digit) =>
    String(
      "٠١٢٣٤٥٦٧٨٩".includes(digit) ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit) : "۰۱۲۳۴۵۶۷۸۹".indexOf(digit),
    ),
  );
const years = (value: unknown) => (digits(value).match(/\b(?:19|20)\d{2}\b/g) ?? []).sort().join();

/** Fail-closed MCP boundary. This validates structure and invariants, not translation semantics. */
export function validateMcpJsonContract(value: unknown) {
  const root = obj(value),
    documents = obj(root.documents);
  const audit = auditMultilingualDocuments(documents);
  const errors = [...audit.errors];
  const list = (value: unknown, path: string) => {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim()))
      errors.push(`${path} : tableau de textes non vides requis ([] si absent).`);
  };
  if (root.version !== "1.0") errors.push("version : valeur 1.0 obligatoire.");
  if (!CV_LANGUAGES.includes(root.default_language as (typeof CV_LANGUAGES)[number]))
    errors.push("default_language : langue reconnue obligatoire.");
  for (const key of Object.keys(documents))
    if (!CV_LANGUAGES.includes(key as (typeof CV_LANGUAGES)[number]))
      errors.push("documents : langue inattendue.");
  const supplied = CV_LANGUAGES.filter((id) => Object.keys(obj(documents[id])).length);
  for (const language of supplied) {
    const cv = obj(documents[language]),
      path = `documents.${language}`;
    for (const key of strings)
      if (typeof cv[key] !== "string")
        errors.push(`${path}.${key} : chaîne obligatoire (vide si inconnu).`);
    if (typeof cv.nom_complet !== "string" || !cv.nom_complet.trim())
      errors.push(`${path}.nom_complet : identité obligatoire.`);
    if (cv.translation_review !== undefined)
      errors.push(
        `${path}.translation_review : version encore à vérifier ; validation humaine requise.`,
      );
    if (
      cv.pending_translations !== undefined &&
      (!cv.pending_translations ||
        typeof cv.pending_translations !== "object" ||
        Array.isArray(cv.pending_translations) ||
        Object.keys(cv.pending_translations).length > 0)
    )
      errors.push(`${path}.pending_translations : changements multilingues non résolus.`);
    for (const key of lists) list(cv[key], `${path}.${key}`);
    for (const [section, fields] of Object.entries(sections)) {
      if (!Array.isArray(cv[section])) {
        errors.push(`${path}.${section} : tableau obligatoire.`);
        continue;
      }
      if (["experiences", "formations", "educations"].includes(section)) {
        const rows = (cv[section] as unknown[]).map(obj);
        const sorted = sortDatedRows(rows);
        if (
          rows.some((row) =>
            reversedChronology(
              parseCvChronology(String(row[section === "experiences" ? "dates" : "date"] ?? "")),
            ),
          )
        )
          errors.push(`${path}.${section} : une date de fin précède la date de début.`);
        if (rows.some((row, index) => row.id !== sorted[index]?.id))
          errors.push(
            `${path}.${section} : ordre chronologique inverse obligatoire, du plus récent au plus ancien.`,
          );
        for (const row of rows)
          if (row.chronology !== undefined) {
            const canonical = normalizeChronology(row.chronology);
            if (!canonical) {
              errors.push(`${path}.${section} : chronology invalide.`);
              continue;
            }
            const parsed = parseCvChronology(
              String(row[section === "experiences" ? "dates" : "date"] ?? ""),
            );
            for (const part of ["start", "end"] as const) {
              const a = parsed[part].split("-"),
                b = canonical[part].split("-");
              if (
                parsed[part] &&
                (!canonical[part] ||
                  a.some((value, index) => b[index] !== undefined && value !== b[index]))
              )
                errors.push(`${path}.${section} : chronology contredit les dates affichées.`);
            }
          }
      }
      for (const [index, entry] of (cv[section] as unknown[]).entries()) {
        const item = obj(entry);
        for (const field of fields)
          if (typeof item[field] !== "string")
            errors.push(`${path}.${section}[${index}].${field} : chaîne obligatoire.`);
        if (section === "experiences")
          list(item.descriptions, `${path}.${section}[${index}].descriptions`);
        if (section === "custom_sections") list(item.items, `${path}.${section}[${index}].items`);
      }
    }
    for (const key of ["fr", "en", "ar", "de", "es", "kab"])
      if (typeof obj(cv.langues)[key] !== "string")
        errors.push(`${path}.langues.${key} : chaîne obligatoire.`);
    for (const key of ["date", "objet", "destinataire", "salutation", "formule_politesse"])
      if (typeof obj(cv.lettre_motivation)[key] !== "string")
        errors.push(`${path}.lettre_motivation.${key} : chaîne obligatoire.`);
    list(obj(cv.lettre_motivation).paragraphes, `${path}.lettre_motivation.paragraphes`);
  }
  // Contact formatting may vary, but not the underlying client identifiers.
  for (const key of ["email", "telephone"]) {
    const values = supplied.map((id) => obj(documents[id])[key]);
    const canonical = values.map((value) =>
      key === "email"
        ? String(value ?? "")
            .trim()
            .toLowerCase()
        : digits(value).replace(/\D/g, ""),
    );
    if (
      canonical.some(Boolean) &&
      (canonical.some((value) => !value) || new Set(canonical).size > 1)
    )
      errors.push(`${key} : coordonnées différentes ou manquantes entre les langues.`);
  }
  const latinNames = supplied
    .map((id) => obj(documents[id]).nom_complet)
    .filter(
      (name): name is string =>
        typeof name === "string" && /^[\p{Script=Latin}\p{Mark}\s.'’-]+$/u.test(name),
    )
    .map((name) =>
      name
        .normalize("NFD")
        .replace(/\p{Mark}/gu, "")
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter(Boolean)
        .sort()
        .join(" "),
    );
  if (new Set(latinNames).size > 1)
    errors.push(
      "nom_complet : identités latines divergentes ; contrôler les sources et les translittérations.",
    );
  for (const field of ["date_naissance"]) {
    const values = supplied.map((id) => years(obj(documents[id])[field]));
    if (new Set(values).size > 1)
      errors.push(`${field} : années différentes ou manquantes entre les langues.`);
  }
  for (const section of ["experiences", "formations", "educations"]) {
    const arrays = supplied.map((id) =>
      Array.isArray(obj(documents[id])[section]) ? (obj(documents[id])[section] as unknown[]) : [],
    );
    const max = Math.max(0, ...arrays.map((items) => items.length));
    for (let index = 0; index < max; index++) {
      const values = arrays.map((items) =>
        years(obj(items[index])[section === "experiences" ? "dates" : "date"]),
      );
      if (new Set(values).size > 1)
        errors.push(`${section}[${index}] : années différentes ou manquantes entre les langues.`);
    }
  }
  if (supplied.some((id) => obj(documents[id]).additional_languages !== undefined)) {
    const arrays = supplied.map((id) => obj(documents[id]).additional_languages);
    const lengths = arrays.map((items) => (Array.isArray(items) ? items.length : -1));
    if (new Set(lengths).size > 1 || lengths.includes(-1))
      errors.push(
        "additional_languages : tableau et nombre d'éléments identiques requis dans les sept langues.",
      );
    const identities: string[] = [];
    for (const [languageIndex, entries] of arrays.entries()) {
      if (!Array.isArray(entries)) continue;
      const ids = entries.map((entry) => obj(entry).id);
      if (new Set(ids).size !== ids.length)
        errors.push(
          `documents.${supplied[languageIndex]}.additional_languages : identifiants dupliqués.`,
        );
      identities.push(JSON.stringify(entries.map((entry) => [obj(entry).id, obj(entry).code])));
      for (const [index, entry] of entries.entries()) {
        for (const field of ["id", "code", "name", "level"]) {
          if (
            typeof obj(entry)[field] !== "string" ||
            (field === "id" && !String(obj(entry)[field]).trim())
          )
            errors.push(
              `documents.${supplied[languageIndex]}.additional_languages[${index}].${field} : chaîne requise.`,
            );
        }
      }
    }
    if (new Set(identities).size > 1)
      errors.push("additional_languages : identifiants, codes ou ordre divergents.");
  }
  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: audit.warnings,
    semanticReviewRequired: true,
  };
}
