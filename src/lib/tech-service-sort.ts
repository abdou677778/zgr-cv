const serviceNameCollator = new Intl.Collator("fr", {
  sensitivity: "base",
  numeric: true,
});

/** Presentation only: preserve the cloud records and financial history. */
export function sortTechServicesByName<T extends { id: string; name: string }>(services: T[]): T[] {
  return [...services].sort(
    (a, b) => serviceNameCollator.compare(a.name.trim(), b.name.trim()) || a.id.localeCompare(b.id),
  );
}
