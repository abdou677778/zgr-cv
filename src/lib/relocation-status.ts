import type { DocumentLanguage } from "./document-language";

export const RELOCATION_STATUS_MAX_CHARS = 33;

const GENERIC_RELOCATION_STATUS: Record<DocumentLanguage, string> = {
  fr: "Mobile géographiquement",
  en: "Open to relocate",
  es: "Disponible para reubicarse",
  de: "Umzugsbereit",
  it: "Disponibile al trasferimento",
  zh: "接受工作调动",
  ar: "مستعد للانتقال",
};

const CANADA_RELOCATION_STATUS: Record<DocumentLanguage, string> = {
  fr: "Mobile partout au Canada",
  en: "Open to relocate to Canada",
  es: "Disponible para ir a Canadá",
  de: "Umzugsbereit nach Kanada",
  it: "Disponibile per il Canada",
  zh: "可迁居加拿大",
  ar: "مستعد للانتقال إلى كندا",
};

export function defaultRelocationStatus(
  language: DocumentLanguage,
  target: "generic" | "canada" = "generic",
) {
  return target === "canada"
    ? CANADA_RELOCATION_STATUS[language]
    : GENERIC_RELOCATION_STATUS[language];
}

function normalizedStatus(value: string) {
  return value.trim().toLocaleLowerCase("fr").replace(/\s+/g, " ");
}

/**
 * A persisted multilingual profile can contain one of the old stock values in
 * the wrong language. These labels are UI defaults rather than personal prose,
 * so translating only exact known values is safe and never rewrites a custom
 * statement entered by a candidate.
 */
function knownStatusTarget(value: string): "generic" | "canada" | null {
  const candidate = normalizedStatus(value);
  if (
    Object.values(CANADA_RELOCATION_STATUS).some(
      (label) => normalizedStatus(label) === candidate,
    )
  )
    return "canada";
  if (
    Object.values(GENERIC_RELOCATION_STATUS).some(
      (label) => normalizedStatus(label) === candidate,
    )
  )
    return "generic";
  return null;
}

export function normalizeRelocationStatus(
  value: unknown,
  language: DocumentLanguage,
  options: { target?: "generic" | "canada"; fillEmpty?: boolean } = {},
) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text && options.fillEmpty)
    return defaultRelocationStatus(language, options.target ?? "generic");
  const knownTarget = knownStatusTarget(text);
  if (knownTarget) return defaultRelocationStatus(language, knownTarget);
  if (Array.from(text).length > RELOCATION_STATUS_MAX_CHARS)
    return defaultRelocationStatus(language, options.target ?? "generic");
  return text;
}
