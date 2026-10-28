import {
  filterTechOrders,
  techClientKey,
  techLineStatus,
  techOrdersTotals,
  type TechFilters,
  type TechOrder,
  type TechState,
} from "./tech-orders";

export function groupTechClients(orders: TechOrder[], today: string) {
  const buckets = new Map<string, TechOrder[]>();
  for (const order of orders.filter((o) => !o.deletedAt)) {
    const key = techClientKey(order);
    buckets.set(key, [...(buckets.get(key) || []), order]);
  }
  return [...buckets].map(([key, records]) => {
    const periods = records
      .flatMap((order) => order.lines.map((line) => ({ order, line })))
      .sort(
        (a, b) =>
          a.line.start.localeCompare(b.line.start) ||
          a.line.end.localeCompare(b.line.end) ||
          a.order.id.localeCompare(b.order.id),
      );
    const states = periods.map((p) => techLineStatus(p.line, today));
    const state: TechState = states.includes("Expire sous 3 jours")
      ? "ending"
      : states.includes("Actif")
        ? "active"
        : "inactive";
    const duplicates = new Set<string>();
    const seen = new Map<string, string>();
    for (const { order, line } of periods) {
      const signature = JSON.stringify([line.serviceId, line.start, line.end]);
      const previous = seen.get(signature);
      if (previous) {
        duplicates.add(previous);
        duplicates.add(`${order.id}:${line.id}`);
      }
      seen.set(signature, `${order.id}:${line.id}`);
    }
    const latest = periods.at(-1)?.order || records[0];
    return {
      key,
      orders: records,
      periods,
      latest,
      state,
      duplicates,
      totals: techOrdersTotals(records),
    };
  });
}
export type TechClientGroup = ReturnType<typeof groupTechClients>[number];

/** Match a client through any ledger record; always display its complete history. */
export function filterTechClientGroups(orders: TechOrder[], filters: TechFilters, today: string) {
  const matching = filterTechOrders(orders, { ...filters, state: "" }, today);
  const rank = new Map<string, number>();
  matching.forEach((order) => {
    const key = techClientKey(order);
    if (!rank.has(key)) rank.set(key, rank.size);
  });
  return groupTechClients(orders, today)
    .filter((group) => rank.has(group.key) && (!filters.state || group.state === filters.state))
    .sort((a, b) =>
      filters.sort === "sale-desc"
        ? b.totals.sale - a.totals.sale
        : filters.sort === "sale-asc"
          ? a.totals.sale - b.totals.sale
          : rank.get(a.key)! - rank.get(b.key)!,
    );
}
