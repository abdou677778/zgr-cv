export function techFeatureItems(value = "") {
  const seen = new Set<string>();
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[•*✓✔✅]|[-–—]|\d+[.)])\s*/, "").trim())
    .filter((line) => {
      if (!line || seen.has(line)) return false;
      seen.add(line);
      return true;
    })
    .map((text) => ({
      text,
      note: /^(?:À noter\s*:|À confirmer\s*:|Source consultée le|Conditions\s*:)/i.test(text),
    }));
}
