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

const COUNTRY_DIALING: Array<[string, string]> = [
  ["213", "algérie|algerie|algeria|الجزائر|dz"],
  ["216", "tunisie|tunis|tunesia|تونس|tn"],
  ["1", "canada|united states|usa|us|ca"],
  ["33", "france|fr"],
  ["49", "allemagne|germany|deutschland|de"],
  ["39", "italie|italy|italia|it"],
  ["34", "espagne|spain|es"],
  ["32", "belgique|belgium|be"],
  ["212", "maroc|morocco|ma"],
  ["971", "émirats|emirats|uae|ae"],
  ["966", "arabie saoudite|saudi arabia|sa"],
  ["44", "royaume-uni|united kingdom| uk|gb"],
];
const KNOWN_DIALING_CODES = COUNTRY_DIALING.map(([code]) => code).sort(
  (left, right) => right.length - left.length,
);

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

function dialingFromCountry(country: string) {
  const normalized = ` ${country.toLocaleLowerCase("fr")} `;
  return COUNTRY_DIALING.find(([, aliases]) => aliases.split("|").some((alias) => normalized.includes(alias)))?.[0] || "";
}

/**
 * Formats a verified telephone number for CV display. No country prefix is
 * guessed: unknown values are left untouched so a real number is never lost.
 */
export function formatImportedCvPhone(phone: string | undefined, country: string | undefined) {
  const source = compact(phone || "");
  if (!source) return "";
  const digits = source.replace(/\D/g, "");
  const international = /^\s*(?:\+|00|\()/.test(source);
  const explicitDigits = source.replace(/^\s*(?:\+|00|\()\s*/, "").replace(/\D/g, "");
  const detectedCode = international
    ? KNOWN_DIALING_CODES.find((code) => explicitDigits.startsWith(code)) || ""
    : "";
  const code = detectedCode || dialingFromCountry(country || "");
  if (!code || digits.length <= code.length) return source;

  let national = digits;
  if (detectedCode) national = explicitDigits.slice(detectedCode.length);
  // A local number becomes international through the explicit country context.
  if (!detectedCode && code !== "1" && national.startsWith("0")) national = national.slice(1);
  if (!national || national.length < 5) return source;
  return `(${code}) ${national}`;
}
