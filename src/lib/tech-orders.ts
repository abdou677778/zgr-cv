export type TechService = {
  id: string;
  revision: number;
  name: string;
  icon: string;
  logo: string;
  priceUsd: number;
  rate: number;
  saleDzd: number;
  months: number;
};
export type TechLine = {
  id: string;
  serviceId: string;
  name: string;
  start: string;
  end: string;
  priceUsd: number;
  rate: number;
  saleDzd: number;
  invoiceUrl: string;
  invoiceRef: string;
};
export type TechOrder = {
  id: string;
  revision: number;
  client: string;
  facebookUrl: string;
  notes: string;
  renewalOf: string;
  lines: TechLine[];
  createdAt?: string;
};
export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function lineTotals(line: Pick<TechLine, "priceUsd" | "rate" | "saleDzd">) {
  const cost = roundMoney(line.priceUsd * line.rate);
  return { cost, sale: line.saleDzd, margin: roundMoney(line.saleDzd - cost) };
}
export function orderTotals(order: TechOrder) {
  return order.lines.reduce(
    (total, line) => {
      const item = lineTotals(line);
      return {
        cost: roundMoney(total.cost + item.cost),
        sale: roundMoney(total.sale + item.sale),
        margin: roundMoney(total.margin + item.margin),
      };
    },
    { cost: 0, sale: 0, margin: 0 },
  );
}
export function todayAlgiers() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function addTechMonths(value: string, months: number) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || !Number.isInteger(months) || months < 1 || months > 36)
    return "";
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, end));
  return date.toISOString().slice(0, 10);
}
export function newTechLine(service: TechService, start = todayAlgiers()): TechLine {
  return {
    id: crypto.randomUUID(),
    serviceId: service.id,
    name: service.name,
    start,
    end: addTechMonths(start, service.months),
    priceUsd: service.priceUsd,
    rate: service.rate,
    saleDzd: service.saleDzd,
    invoiceUrl: "",
    invoiceRef: "",
  };
}
export function renewTechOrder(
  order: TechOrder,
  services: TechService[],
  months: number,
  today = todayAlgiers(),
): TechOrder {
  return {
    id: crypto.randomUUID(),
    revision: 0,
    client: order.client,
    facebookUrl: order.facebookUrl,
    notes: "",
    renewalOf: order.id,
    lines: order.lines.map((old) => {
      const service = services.find((s) => s.id === old.serviceId);
      const start = old.end > today ? old.end : today;
      const factor = service ? months / service.months : 1;
      return {
        ...old,
        id: crypto.randomUUID(),
        start,
        end: addTechMonths(start, months),
        priceUsd: roundMoney((service?.priceUsd ?? old.priceUsd) * factor),
        rate: service?.rate ?? old.rate,
        saleDzd: roundMoney((service?.saleDzd ?? old.saleDzd) * factor),
        invoiceUrl: "",
        invoiceRef: "",
      };
    }),
  };
}
export function techLineStatus(line: TechLine, today = todayAlgiers()) {
  if (today >= line.end) return "Expiré";
  if (today < line.start) return "À venir";
  return (Date.parse(`${line.end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000 <= 7
    ? "Expire sous 7 jours"
    : "Actif";
}
