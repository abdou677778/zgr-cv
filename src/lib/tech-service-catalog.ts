import type { TechService } from "./tech-orders";

export const TECH_CATALOG_TITLE = "Services ZGR Tech";
export const TECH_CATALOG_PAGE_SIZE = 18;
export type PublicTechService = {
  id: string;
  name: string;
  priceDzd: number;
  months: number;
  invoiceAvailable: boolean;
};
/** Explicit allow-list. Never export supplier cost, margin, client data or invoice documents. */
export function publicTechServices(services: TechService[]): PublicTechService[] {
  return services
    .filter(
      (s) =>
        s.catalogVisible !== false &&
        s.name.trim() &&
        Number.isFinite(s.saleDzd) &&
        s.saleDzd >= 0 &&
        Number.isInteger(s.months) &&
        s.months > 0,
    )
    .map((s) => ({
      id: s.id,
      name: s.name.trim(),
      priceDzd: s.saleDzd,
      months: s.months,
      invoiceAvailable: s.officialInvoiceAvailable === true,
    }))
    .sort(
      (a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }) || a.id.localeCompare(b.id),
    );
}
export function publicTechPrice(service: PublicTechService) {
  // Legacy zero prices are not advertised as a free subscription.
  return service.priceDzd > 0
    ? `${new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 2 }).format(service.priceDzd)} دج`
    : "السعر عند الطلب";
}
export function publicTechPeriod(months: number) {
  return months === 1
    ? "شهر واحد"
    : months === 2
      ? "شهران"
      : months <= 10
        ? `${months} أشهر`
        : `${months} شهراً`;
}
export function techCatalogPeriodConflict(service: PublicTechService) {
  const named = service.name.match(/\b(\d{1,2})\s*(?:months?|mois)\b/i);
  return !!named && Number(named[1]) !== service.months;
}
export function publicTechCatalogPeriod(service: PublicTechService) {
  return techCatalogPeriodConflict(service)
    ? "المدة تُؤكَّد عند الطلب"
    : publicTechPeriod(service.months);
}
export function techCatalogPages<T>(items: T[]): T[][] {
  return Array.from({ length: Math.ceil(items.length / TECH_CATALOG_PAGE_SIZE) }, (_, i) =>
    items.slice(i * TECH_CATALOG_PAGE_SIZE, (i + 1) * TECH_CATALOG_PAGE_SIZE),
  );
}
export function publicTechArabicText(services: PublicTechService[]) {
  const lines = [
    TECH_CATALOG_TITLE,
    "اشتراكات وخدمات رقمية أصلية",
    "",
    "نوفر اشتراكات أصلية فقط، بدون كراك أو حسابات غير رسمية.",
    "",
  ];
  for (const service of services) {
    lines.push(
      `• \u2068${service.name}\u2069`,
      `${service.priceDzd > 0 ? `السعر: ${publicTechPrice(service)}` : "السعر عند الطلب"} | المدة: ${publicTechCatalogPeriod(service)}`,
    );
    if (service.invoiceAvailable)
      lines.push("الفاتورة الرسمية للمورّد متاحة لهذه الخدمة، حسب تفاصيل الطلب المؤكدة.");
    lines.push("");
  }
  lines.push(
    "توفّر الفاتورة الرسمية يُؤكَّد قبل الطلب؛ ولا تُنشئ ZGR فواتير باسم المورّد.",
    "الأسعار تخص المدة الموضحة، ويُؤكَّد السعر والتوفر وشروط الاشتراك قبل الدفع.",
    "يمكنكم الاستفسار عن خدمات أخرى. راسلونا باسم الخدمة والمدة المطلوبة.",
  );
  return lines.join("\n");
}
