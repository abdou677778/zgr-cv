/** Combine structured employer/place fields without repeating source components. */
export function cvEntryLocation(primary: string, location: string, arabic = false) {
  const key = (value: string) => value.normalize("NFD").replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase().replace(/[.\s]+$/u, "").replace(/\s+/gu, " ").trim();
  const seen = new Set<string>();
  return [primary, location].flatMap((value) => value.split(/[,،;؛]+/u))
    .map((value) => value.trim().replace(/[.،,;؛]+$/u, "").trim())
    .filter((value) => {
      const normalized = key(value);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    }).join(arabic ? "، " : ", ");
}
