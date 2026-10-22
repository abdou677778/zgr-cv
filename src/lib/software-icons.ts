import { SOFTWARE_ICON_CATALOG } from "@/data/software-icon-catalog";

const LEGACY_ICON_SLUGS: Record<string, string> = {
  word: "microsoftword",
  excel: "microsoftexcel",
  powerpoint: "microsoftpowerpoint",
};

const catalogSlugs = new Set(SOFTWARE_ICON_CATALOG.map((item) => item.slug));
let sharedLogos: Record<string, string> = {};
export function setSharedSoftwareLogos(logos: Record<string, string>) {
  sharedLogos = logos;
  if (typeof window !== "undefined") window.dispatchEvent(new Event("zgr-software-logos"));
}

export function normalizeSoftwareIcon(value: string | undefined) {
  const icon = (value || "").trim().toLowerCase();
  if (!icon || icon === "generic") return "generic";
  const normalized = LEGACY_ICON_SLUGS[icon] || icon;
  if (catalogSlugs.has(normalized)) return normalized;
  const matchingTitle = SOFTWARE_ICON_CATALOG.find((item) => item.title.toLowerCase() === icon);
  if (matchingTitle) return matchingTitle.slug;
  if (/(chatgpt|gpt[- ]?4|gpt[- ]?5)/.test(icon)) return "openai";
  if (/(gemini|google ai studio|google studio)/.test(icon)) return "googlegemini";
  return "generic";
}

export function softwareIconUrl(icon: string | undefined) {
  const slug = normalizeSoftwareIcon(icon);
  return slug === "generic" ? "" : sharedLogos[slug] || `/software-icons/${slug}.svg`;
}

export { SOFTWARE_ICON_CATALOG };
