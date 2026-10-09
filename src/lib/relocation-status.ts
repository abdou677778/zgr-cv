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

export function normalizeRelocationStatus(
  value: unknown,
  language: DocumentLanguage,
  options: { target?: "generic" | "canada"; fillEmpty?: boolean } = {},
) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text && options.fillEmpty)
    return defaultRelocationStatus(language, options.target ?? "generic");
  if (Array.from(text).length > RELOCATION_STATUS_MAX_CHARS)
    return defaultRelocationStatus(language, options.target ?? "generic");
  return text;
}
