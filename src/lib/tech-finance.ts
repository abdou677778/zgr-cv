import { roundMoney, techOrdersTotals, type TechOrder } from "./tech-orders";
export const financeKinds = {
  sponsor: "Sponsor / publicité",
  other: "Autres frais",
  cancellation_fee: "Frais d’annulation",
  refund: "Remboursement client",
  cancellation: "Vente annulée — montant à retrancher",
  supplier_credit: "Avoir / remboursement fournisseur",
} as const;
export type FinanceKind = keyof typeof financeKinds;
export type TechFinanceEntry = {
  id: string;
  date: string;
  kind: FinanceKind;
  amountDzd: number;
  label: string;
  orderId: string;
  voided: boolean;
};
export type TechFinance = { id: "main"; revision: number; entries: TechFinanceEntry[] };
export const emptyTechFinance = (): TechFinance => ({ id: "main", revision: 0, entries: [] });
export function financeOrderDate(order: TechOrder) {
  const date = new Date(order.createdAt || "");
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Algiers",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date)
    : "";
}
export function financeMonthRange(month: string) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    Number(month.slice(0, 4)) < 2000 ||
    Number(month.slice(0, 4)) > 2199
  )
    return { from: "", to: "" };
  return {
    from: month + "-01",
    to: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
      .toISOString()
      .slice(0, 10),
  };
}
export function techFinanceStats(
  orders: TechOrder[],
  entries: TechFinanceEntry[],
  from = "",
  to = "",
) {
  const invalid = !!(from && to && from > to);
  const ranged = !!(from || to);
  const includes = (date: string) =>
    !invalid && (!ranged || (!!date && (!from || date >= from) && (!to || date <= to)));
  const selected = orders.filter((order) => includes(financeOrderDate(order)));
  const base = techOrdersTotals(selected);
  const amounts: Record<FinanceKind, number> = {
    sponsor: 0,
    other: 0,
    cancellation_fee: 0,
    refund: 0,
    cancellation: 0,
    supplier_credit: 0,
  };
  const movements = entries.filter((entry) => !entry.voided && includes(entry.date));
  for (const entry of movements)
    amounts[entry.kind] = roundMoney(amounts[entry.kind] + entry.amountDzd);
  const fees = roundMoney(amounts.sponsor + amounts.other + amounts.cancellation_fee);
  const netSales = roundMoney(base.sale - amounts.refund - amounts.cancellation);
  return {
    ...base,
    ...amounts,
    fees,
    deductions: roundMoney(fees + amounts.refund + amounts.cancellation),
    netSales,
    netMargin: roundMoney(netSales - base.cost - fees + amounts.supplier_credit),
    orders: selected.length,
    movements: movements.length,
    undatedOrders: ranged ? orders.filter((order) => !financeOrderDate(order)).length : 0,
    invalid,
  };
}
