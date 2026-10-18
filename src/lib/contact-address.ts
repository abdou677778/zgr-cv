/**
 * The CV contact line is intentionally concise. Street, building and apartment
 * information makes a CV harder to scan and is not useful to a recruiter.
 * This helper is only called for automated imports/AI output; direct edits in
 * the address input remain untouched by design.
 */
const POSTAL_CODE = /\b(?:\d{4,10}(?:[- ]\d{3,4})?|[A-Z]\d[A-Z][ -]?\d[A-Z]\d)\b/i;

const COUNTRY_NAMES = [
  "algérie", "algerie", "algeria", "الجزائر", "canada", "tunisie", "tunis", "tunesia", "تونس",
  "france", "allemagne", "germany", "deutschland", "italie", "italy", "italia", "espagne", "spain",
  "maroc", "morocco", "belgique", "belgium", "royaume-uni", "united kingdom", "uk", "uae",
  "émirats arabes unis", "emirats arabes unis", "arabie saoudite", "saudi arabia",
];

const compact = (value: string) => value.replace(/\s+/g, " ").trim();
const same = (left: string, right: string) => left.localeCompare(right, undefined, { sensitivity: "base" }) === 0;

function countryIn(value: string) {
  const normalized = value.toLocaleLowerCase("fr");
  return COUNTRY_NAMES.find((country) => normalized.includes(country)) || "";
}

function isStreetDetail(value: string) {
  return /(?:\b(?:cité|cite|rue|avenue|av\.|lot|bloc|bâtiment|batiment|appartement|résidence|residence|quartier|street|road|building|apartment)\b|\b(?:حي|شارع|عمارة|إقامة)\b|n[°o]|#)/iu.test(
    value,
  );
}

/** Returns `Wilaya/Province, Code postal, Pays` when those facts are known. */
export function formatImportedCvAddress(
  address: string | undefined,
  region: string | undefined,
  country: string | undefined,
  postalCode?: string | undefined,
) {
  const raw = compact(address || "");
  const explicitRegion = compact(region || "");
  const explicitCountry = compact(country || "");
  const postal = compact(postalCode || "") || raw.match(POSTAL_CODE)?.[0] || "";
  const parts = raw
    .split(/[,;\n]+/)
    .map((part) => compact(part.replace(POSTAL_CODE, "")))
    .filter(Boolean);
  const countryPart = parts.find((part) => countryIn(part));
  const detectedCountry = explicitCountry || countryPart || "";
  // If no useful component is available, preserving the original is safer
  // than guessing which part is a city and silently dropping the rest.
  if (!explicitRegion && !detectedCountry && !postal) return raw;
  const city =
    explicitRegion ||
    [...parts]
      .reverse()
      .find((part) => !isStreetDetail(part) && !countryIn(part) && !/^\d+[\d\s-]*$/.test(part)) ||
    "";
  const concise = [city, postal, detectedCountry]
    .filter((part, index, all) => part && all.findIndex((candidate) => same(candidate, part)) === index)
    .join(", ");

  // Never throw away a source address when we cannot safely identify at least
  // one of its useful contact components.
  return concise || raw;
}
