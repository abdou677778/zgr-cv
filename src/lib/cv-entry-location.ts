export function cleanEntryField(value: string) {
  return value.normalize("NFC").replace(/^[\s,،;؛.]+|[\s,،;؛.]+$/gu, "");
}

/** Combine structured employer/place fields without repeating source components. */
export function cvEntryLocation(primary: string, location: string, arabic = false) {
  const key = (value: string) => value.normalize("NFD").replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase().replace(/[.\s]+$/u, "").replace(/\s+/gu, " ").trim();
  const seen = new Set<string>();
  return [primary, location].flatMap((value) => value.split(/[,،;؛]+/u))
    .map(cleanEntryField)
    .filter((value) => {
      const normalized = key(value);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    }).join(arabic ? "، " : ", ");
}
