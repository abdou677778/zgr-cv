import { addTechMonths, roundMoney, type TechLine } from "./tech-orders";
export function techSaleMonths(line: TechLine): number | "custom" {
  for (let months = 1; months <= 12; months++)
    if (line.start && line.end && addTechMonths(line.start, months) === line.end) return months;
  return "custom";
}
export function techSaleStartPatch(start: string, months: number | "custom"): Partial<TechLine> {
  return months === "custom" ? { start } : { start, end: addTechMonths(start, months) };
}
export function techSalePricePatch(
  line: TechLine,
  field: "priceUsd" | "rate" | "saleDzd",
  value: number,
  inferPurchase: boolean,
): Partial<TechLine> {
  const next = { ...line, [field]: value };
  if (field === "priceUsd" || (!inferPurchase && Number.isFinite(line.priceUsd)))
    return { [field]: value };
  const purchase =
    Number.isFinite(next.saleDzd) &&
    next.saleDzd >= 0 &&
    Number.isFinite(next.rate) &&
    next.rate > 0
      ? roundMoney(next.saleDzd / next.rate)
      : NaN;
  return { [field]: value, priceUsd: purchase };
}
