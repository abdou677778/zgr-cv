import type { CV } from "./cv-types";
import { CLIENTS_API_ENDPOINT } from "./auth-client";
import { replaceSharedSoftwareLogo } from "./shared-software-logos";
import { pdfLogo } from "./software-icons-pdf";

export const LANGUAGE_LOGO_KEYS = ["fr", "en", "ar", "de", "es", "kab"] as const;
export type LanguageLogoKey = typeof LANGUAGE_LOGO_KEYS[number];
const endpoint = CLIENTS_API_ENDPOINT.replace(/\/clients$/, "/language-logos");
let logos: Record<string, string> = {};
let loading: Promise<void> | undefined;
export const sharedLanguageLogo = (key: LanguageLogoKey) => logos[key];
export function loadLanguageLogos(force = false) {
  if (!loading || force) loading = (async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error("Bibliothèque des langues indisponible.");
    logos = (await response.json()).logos || {};
    window.dispatchEvent(new Event("zgr-language-logos"));
  })().catch(() => { loading = undefined; });
  return loading;
}
export async function saveLanguageLogo(key: LanguageLogoKey, file: File) {
  await replaceSharedSoftwareLogo(key, file, endpoint);
  await loadLanguageLogos(true);
}
export async function prepareLanguageLogos(cv: CV): Promise<CV> {
  await loadLanguageLogos();
  const prepared = { ...cv.language_logos };
  await Promise.all(LANGUAGE_LOGO_KEYS.map(async key => {
    const selected = cv.language_logos?.[key];
    const source = selected?.customIconDataUrl || sharedLanguageLogo(selected?.icon || key);
    if (!source) return;
    try { prepared[key] = { ...selected, customIconDataUrl: await pdfLogo(source, true) }; }
    catch { prepared[key] = { icon: selected?.icon }; }
  }));
  return { ...cv, language_logos: prepared };
}
