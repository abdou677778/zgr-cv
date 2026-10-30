/** Inspect the finished definition, not the UI language: mixed text can use several fonts. */
export function explicitPdfFonts(definition: unknown): string[] {
  const fonts = new Set<string>();
  const seen = new WeakSet<object>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    const node = value as Record<string, unknown>;
    if (typeof node.font === "string") fonts.add(node.font);
    Object.values(node).forEach(visit);
  };
  visit(definition);
  return [...fonts];
}
