import { lineTotals, roundMoney, type TechOrder, type TechService } from "./tech-orders";
const validMoney = (n: number) =>
  Number.isFinite(n) &&
  n >= 0 &&
  n <= 100000000 &&
  (n === 0 || roundMoney(n) > 0) &&
  Math.abs(roundMoney(n) - n) <= Number.EPSILON * Math.max(1, Math.abs(n)) * 4;
function prices(item: Pick<TechService, "priceUsd" | "rate" | "saleDzd">) {
  if (!validMoney(item.priceUsd))
    return "Prix fournisseur : montant entre 0 et 100 millions, avec 2 décimales maximum.";
  if (!validMoney(item.rate) || item.rate <= 0)
    return "Le taux DA/USD doit être strictement positif, avec 2 décimales maximum.";
  if (!validMoney(item.saleDzd))
    return "Prix de vente : montant entre 0 et 100 millions, avec 2 décimales maximum.";
  if (lineTotals(item).cost > 100000000)
    return "Le coût calculé dépasse 100 millions DA. Vérifiez le prix USD et le taux.";
  return "";
}
function url(value: string) {
  if (!value) return true;
  try {
    const u = new URL(value);
    return value.length <= 2000 && u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export function validTechDraftDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= "2000-01-01" &&
    value <= "2199-12-31"
  );
}
export function techServiceError(service: TechService) {
  if (!service.name.trim() || service.name.length > 120)
    return "Saisissez le nom du service (120 caractères maximum).";
  if (!Number.isInteger(service.months) || service.months < 1 || service.months > 36)
    return "Durée standard : entre 1 et 36 mois entiers.";
  return prices(service);
}
export function techOrderError(order: TechOrder, services: TechService[]) {
  if (!order.client.trim() || order.client.length > 180)
    return "Saisissez le nom du client (180 caractères maximum).";
  if (!url(order.facebookUrl))
    return "Le lien Facebook doit être une adresse HTTPS sans identifiants intégrés.";
  if (!order.lines.length || order.lines.length > 30)
    return "Ajoutez entre 1 et 30 services avant l’enregistrement.";
  for (const [i, line] of order.lines.entries()) {
    const prefix = `Service ${i + 1} — ${line.name} : `;
    if (!services.some((s) => s.id === line.serviceId))
      return prefix + "enregistrez d’abord ce service dans le catalogue cloud.";
    if (!validTechDraftDate(line.start) || !validTechDraftDate(line.end) || line.end <= line.start)
      return prefix + "la fin doit être une date valide après le début.";
    if (!url(line.invoiceUrl))
      return prefix + "le lien de facture doit être en HTTPS sans identifiants intégrés.";
    const error = prices(line);
    if (error) return prefix + error;
  }
  return "";
}
