const unique = (values: string[]) => [...new Set(values.map((value) => value.toUpperCase()))];

/** Keeps a driving licence field limited to verified licence categories. */
export function formatDrivingLicence(value: string | undefined) {
  const source = (value || "").trim();
  if (!source) return "";
  const categories = unique(
    Array.from(source.toUpperCase().replace(/PERMIS\s+DE\b/g, "PERMIS").matchAll(/(?:^|[^A-Z0-9])(AM|A1|A2|BE|C1E|CE|D1E|DE|B1|C1|D1|A|B|C|D|E)(?=$|[^A-Z0-9])/g)).map(
      (match) => match[1],
    ),
  );
  return categories.length ? `Catégories ${categories.join(" et ")}` : "";
}

/** Uses only the recognised, recruiter-friendly national-service status. */
export function formatNationalService(value: string | undefined) {
  const source = (value || "").trim().toLocaleLowerCase("fr");
  if (!source) return "";
  if (/dégag|degag|carte\s+jaune|exempt|libér[ée]|libere/.test(source)) return "Dégagé";
  if (/dispens/.test(source)) return "Dispensé";
  if (/sursis|report/.test(source)) return "Sursis";
  if (/accompli|effectu[ée]|termin[ée]/.test(source)) return "Accompli";
  if (/en\s+cours/.test(source)) return "En cours";
  return "";
}
