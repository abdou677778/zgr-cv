import { techClientKey, techLineStatus, type TechOrder } from "./tech-orders";
export type MessageGender = "neutral" | "male" | "female";
const clean = (value: string) =>
  value
    .replace(/[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const dateLabel = (value: string) => value.split("-").reverse().join("/");
export function defaultMessageLines(order: TechOrder, today: string) {
  const urgent = order.lines.filter((line) =>
    ["Expiré", "Expire sous 3 jours"].includes(techLineStatus(line, today)),
  );
  return (urgent.length ? urgent : order.lines).map((line) => line.id);
}
export function buildTechRenewalMessage(
  order: TechOrder,
  ids: string[],
  gender: MessageGender,
  today: string,
) {
  const lines = order.lines.filter((line) => ids.includes(line.id));
  if (!lines.length) return "";
  const details = lines.map((line) => {
    const name = clean(line.name),
      end = dateLabel(line.end);
    if (today >= line.end) return `• اشتراكك في ${name} كمل نهار ${end}.`;
    if (today < line.start)
      return `• اشتراكك في ${name} يبدا نهار ${dateLabel(line.start)} ويكمل نهار ${end}.`;
    return `• اشتراكك في ${name} راه ساري ويكمل نهار ${end}.`;
  });
  const offer =
    gender === "female"
      ? "حابة تجدّدي وتكمّلي تستفادي من الخدمة؟ ابعثيلنا «نجدد» ونبعثولك التفاصيل والعروض المتوفرة ✅"
      : gender === "male"
        ? "حاب تجدّد وتكمّل تستفاد من الخدمة؟ ابعثلنا «نجدد» ونبعثولك التفاصيل والعروض المتوفرة ✅"
        : "للتجديد ومواصلة الاستفادة من الخدمة، الرد بكلمة «نجدد» يكفي باش نبعثولك التفاصيل والعروض المتوفرة ✅";
  return [
    `سلام ${clean(order.client)} 👋`,
    details.join("\n"),
    offer,
    "شكراً على ثقتك في ZGR Tech 🤝",
  ].join("\n\n");
}
export function hasOtherActiveSubscription(
  source: TechOrder,
  ids: string[],
  orders: TechOrder[],
  today: string,
) {
  const services = new Set(
    source.lines.filter((line) => ids.includes(line.id)).map((line) => line.serviceId),
  );
  return orders.some(
    (order) =>
      order.id !== source.id &&
      techClientKey(order) === techClientKey(source) &&
      order.lines.some(
        (line) => services.has(line.serviceId) && line.start <= today && line.end > today,
      ),
  );
}
export function safeTechContactUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}
