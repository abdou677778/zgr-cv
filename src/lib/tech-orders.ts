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
  return (Date.parse(`${line.end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000 <= 3
    ? "Expire sous 3 jours"
    : "Actif";
}
export type TechState = "active" | "ending" | "inactive";
export function techOrderState(order: TechOrder, today = todayAlgiers()): TechState {
  const states = order.lines.map((line) => techLineStatus(line, today));
  return states.includes("Expire sous 3 jours")
    ? "ending"
    : states.includes("Actif")
      ? "active"
      : "inactive";
}
export const techOrderLabel = (order: Pick<TechOrder, "id">) =>
  `TECH-${order.id.slice(0, 8).toUpperCase()}`;
const normalized = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
/** Do not silently combine matching names with different Facebook contact links. */
export const techClientKey = (order: Pick<TechOrder, "client" | "facebookUrl">) =>
  JSON.stringify([normalized(order.client), order.facebookUrl.trim()]);
export function techClients(orders: TechOrder[]) {
  const entries = new Map<string, TechOrder>();
  for (const order of [...orders].sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || ""),
  )) {
    const key = techClientKey(order);
    if (!entries.has(key)) entries.set(key, order);
  }
  return [...entries]
    .map(([key, order]) => ({ key, client: order.client, facebookUrl: order.facebookUrl }))
    .sort((a, b) => a.client.localeCompare(b.client, "fr"));
}
export type TechFilters = {
  query: string;
  client: string;
  orderId: string;
  state: "" | TechState;
  serviceId: string;
  from: string;
  to: string;
  dateBasis: "start" | "end" | "created";
};
export const emptyTechFilters: TechFilters = {
  query: "",
  client: "",
  orderId: "",
  state: "",
  serviceId: "",
  from: "",
  to: "",
  dateBasis: "end",
};
export function filterTechOrders(
  orders: TechOrder[],
  filters: TechFilters,
  today = todayAlgiers(),
) {
  if (filters.from && filters.to && filters.from > filters.to) return [];
  const inRange = (date: string) =>
    !!date && (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);
  return orders
    .filter((order) => {
      if (filters.client && techClientKey(order) !== filters.client) return false;
      if (
        filters.orderId &&
        !normalized(`${order.id} ${techOrderLabel(order)}`).includes(normalized(filters.orderId))
      )
        return false;
      if (filters.state && techOrderState(order, today) !== filters.state) return false;
      if (
        filters.query &&
        !normalized(
          `${order.id} ${techOrderLabel(order)} ${order.client} ${order.lines.map((l) => l.name).join(" ")}`,
        ).includes(normalized(filters.query))
      )
        return false;
      const dates = !!(filters.from || filters.to);
      if (dates && filters.dateBasis === "created") {
        const created = new Date(order.createdAt || "");
        if (
          !Number.isFinite(created.getTime()) ||
          !inRange(
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Africa/Algiers",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(created),
          )
        )
          return false;
      }
      // Service and period constraints must describe the same subscription line.
      return order.lines.some(
        (line) =>
          (!filters.serviceId || line.serviceId === filters.serviceId) &&
          (!dates ||
            filters.dateBasis === "created" ||
            inRange(filters.dateBasis === "start" ? line.start : line.end)),
      );
    })
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}
export function newTechOrderForClient(
  client: Pick<TechOrder, "client" | "facebookUrl">,
): TechOrder {
  return {
    id: crypto.randomUUID(),
    revision: 0,
    client: client.client,
    facebookUrl: client.facebookUrl,
    notes: "",
    renewalOf: "",
    lines: [],
  };
}
