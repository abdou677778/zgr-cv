export type DocumentLanguage = "fr" | "en" | "es" | "de" | "it" | "zh" | "ar";

export interface DocumentLanguageInfo {
  id: DocumentLanguage;
  name: string;
  shortName: string;
  locale: string;
  rtl: boolean;
}

export const DOCUMENT_LANGUAGES: ReadonlyArray<DocumentLanguageInfo> = [
  { id: "fr", name: "Français", shortName: "FR", locale: "fr-CA", rtl: false },
  { id: "en", name: "English", shortName: "EN", locale: "en-CA", rtl: false },
  { id: "es", name: "Español", shortName: "ES", locale: "es-ES", rtl: false },
  { id: "de", name: "Deutsch", shortName: "DE", locale: "de-DE", rtl: false },
  { id: "it", name: "Italiano", shortName: "IT", locale: "it-IT", rtl: false },
  { id: "zh", name: "中文", shortName: "中文", locale: "zh-CN", rtl: false },
  { id: "ar", name: "العربية", shortName: "AR", locale: "ar-DZ", rtl: true },
];

export function languageInfo(language: DocumentLanguage) {
  return DOCUMENT_LANGUAGES.find((item) => item.id === language) ?? DOCUMENT_LANGUAGES[1];
}

export function documentFont(language: DocumentLanguage) {
  return language === "zh" ? "NotoSansSC" : language === "ar" ? "NotoSansArabic" : "Calibri";
}
