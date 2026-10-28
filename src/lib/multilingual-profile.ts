import { emptyCV, type CV } from "./cv-types";
import { DOCUMENT_LANGUAGES, type DocumentLanguage } from "./document-language";
import { auditMultilingualDocuments } from "./multilingual-audit";
import { synchronizeMultilingualEdit } from "./multilingual-edit-sync";

const CONTENT_KEYS = [
  "nom_complet", "telephone", "email", "adresse", "titre_poste", "cnp",
  "statut_relocation", "date_naissance", "situation_familiale", "permis_conduire",
  "service_national", "wilaya", "pays", "candidature", "objectif", "competences",
  "logiciels", "custom_sections", "langues", "additional_languages", "experiences",
  "formations", "educations", "participations", "certifications", "interets",
  "references", "lettre_motivation", "plan_developpement", "europass",
] as const satisfies readonly (keyof CV)[];

const contentJson = (cv: CV) => JSON.stringify(
  Object.fromEntries(CONTENT_KEYS.map(key => [key, cv[key]])),
  (key, value) => ["logo", "customIconDataUrl", "descriptions_format"].includes(key) ? undefined : value,
);

export function applyMultilingualEdit(
  current: Record<DocumentLanguage, CV>, language: DocumentLanguage, next: CV,
): Record<DocumentLanguage, CV> {
  if (contentJson(current[language]) === contentJson(next)) return { ...current, [language]: next };
  return synchronizeMultilingualEdit(current, language, next);
}

export function normalizeTranslationReview(value: unknown): CV["translation_review"] {
  if (!value || typeof value !== "object") return undefined;
  const source = (value as Record<string, unknown>).source_language;
  return DOCUMENT_LANGUAGES.some(({ id }) => id === source)
    ? { source_language: source as DocumentLanguage } : undefined;
}

export function multilingualProfileStatus(documents: Record<DocumentLanguage, CV>) {
  const missing = DOCUMENT_LANGUAGES.filter(({ id }) => !CONTENT_KEYS.some(key => {
    const value = documents[id][key];
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.some(item => typeof item !== "string" || item.trim());
    if (key === "langues") return Object.values(documents[id].langues).some(level => level.trim());
    return false;
  })).map(({ id }) => id);
  const populated = DOCUMENT_LANGUAGES.filter(({ id }) => !missing.includes(id));
  const conflicts: string[] = [];
  const emails = new Set(populated.map(({ id }) => documents[id].email.trim().toLowerCase()).filter(Boolean));
  if (emails.size > 1) conflicts.push("Adresses e-mail différentes entre les versions : identité à vérifier.");
  // Cross-script names may be transliterations; do not compare them as Latin names.
  const names = populated.map(({ id }) => documents[id].nom_complet.trim()).filter(name =>
    name && /^[\p{Script=Latin}\p{Mark}\s.'’-]+$/u.test(name),
  ).map(name => name.normalize("NFD").replace(/\p{Mark}/gu, "").toLowerCase()
    .split(/[^a-z]+/).filter(Boolean).sort().join(" "));
  if (new Set(names).size > 1) conflicts.push("Noms différents entre les versions : vérifier les variantes et l’identité du client.");
  const stale = populated.filter(({ id }) => documents[id].translation_review).map(({ id }) => id);
  const coverage = auditMultilingualDocuments(
    Object.fromEntries(populated.map(({ id }) => [id, documents[id]])), false,
  ).errors;
  return { missing, stale, conflicts, coverage };
}

/** A new record must never inherit another record's translations or demo data. */
export function createMultilingualProfile(
  documents: Partial<Record<DocumentLanguage, CV>> = {},
): Record<DocumentLanguage, CV> {
  return Object.fromEntries(
    DOCUMENT_LANGUAGES.map(({ id }) => [id, structuredClone(documents[id] ?? emptyCV)]),
  ) as Record<DocumentLanguage, CV>;
}
