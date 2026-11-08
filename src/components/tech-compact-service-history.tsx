import { ChevronDown, AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { groupTechServicePeriods, type TechClientGroup } from "@/lib/tech-client-groups";
import { lineTotals, techLineStatus, techOrderLabel, type TechOrder } from "@/lib/tech-orders";
import { formatTechMoney as money, formatTechDeadline as date } from "@/lib/tech-order-display";
import { TechHistoryDisclosure } from "./tech-history-disclosure";
import { TechPaymentButtons } from "./tech-payment-buttons";
import { TechOrderNote } from "./tech-order-details";
import { TechContactBadge } from "./tech-contact-badge";
import { primaryTechPeriod } from "@/lib/tech-visible-period";
export function TechDuplicateNotice() {
  return (
    <details className="text-[11px]">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 [&::-webkit-details-marker]:hidden">
        <AlertTriangle aria-hidden="true" className="h-3 w-3" />
        Doublon à vérifier
      </summary>
      <p className="mt-1 max-w-md rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900">
        Doublons possibles : montants à vérifier avant suppression. Totaux du registre non corrigés
        automatiquement.
      </p>
    </details>
  );
}
function PeriodState({ state }: { state: ReturnType<typeof techLineStatus> }) {
  return (
    <span
      className={`shrink-0 whitespace-nowrap text-[11px] font-semibold ${state === "Expiré" ? "text-red-700" : state === "Actif" ? "text-emerald-700" : state === "Expire sous 3 jours" ? "text-amber-700" : "text-slate-500"}`}
    >
      {state === "Expire sous 3 jours" ? "Expire ≤ 3 j" : state}
    </span>
  );
}
export function TechCompactServiceHistory({
  group,
  today,
  logo,
  onContact,
  paymentDisabled,
  onPaymentChange,
  maxServices = Infinity,
}: {
  group: TechClientGroup;
  today: string;
  logo: (id: string) => ReactNode;
  onContact: (order: TechOrder) => void;
  paymentDisabled?: boolean;
  onPaymentChange?: (order: TechOrder, status: NonNullable<TechOrder["paymentStatus"]>) => void;
  maxServices?: number;
}) {
  return (
    <div className="min-w-0 space-y-1">
      {group.duplicates.size > 0 && <TechDuplicateNotice />}
      {groupTechServicePeriods(group.periods)
        .slice(0, maxServices)
        .map((service) => {
          const primary = primaryTechPeriod(service.periods, today);
          if (!primary) return null;
          const { line } = primary;
          return (
            <section
              key={service.serviceId}
              aria-label={service.name}
              className="min-w-0 rounded-md"
            >
              <TechHistoryDisclosure
                label={`Plus d’infos — ${service.name}`}
                summary={
                  <div className="flex min-h-8 items-center gap-2 whitespace-nowrap">
                    <span className="shrink-0">{logo(service.serviceId)}</span>
                    <strong
                      title={service.name}
                      dir="auto"
                      className="min-w-0 flex-1 truncate text-xs text-slate-800"
                    >
                      {service.name}
                    </strong>
                    <span className="shrink-0 text-[11px] tabular-nums">
                      {date(line.start)} → {date(line.end)}
                    </span>
                    <PeriodState state={techLineStatus(line, today)} />
                    <span
                      className="inline-flex shrink-0 items-center gap-1 text-[10px] text-indigo-700"
                      title={`${service.periods.length} période(s) — historique chronologique et détails`}
                    >
                      {service.periods.length > 1 && (
                        <span className="rounded bg-indigo-50 px-1">{service.periods.length}</span>
                      )}
                      <ChevronDown
                        aria-hidden="true"
                        className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
                      />
                    </span>
                  </div>
                }
              >
                {() => (
                  <div className="my-2 space-y-2 border-l-2 border-indigo-100 pl-3">
                    {service.periods.map(({ order, line: period }) => {
                      const total = lineTotals(period);
                      return (
                        <div
                          key={`${order.id}:${period.id}`}
                          className={`space-y-2 rounded-lg border p-3 ${group.duplicates.has(`${order.id}:${period.id}`) ? "border-amber-300 bg-amber-50" : "border-slate-100 bg-slate-50"}`}
                        >
                          <div className="flex items-center justify-between gap-3 whitespace-nowrap">
                            <span className="text-[11px] tabular-nums">
                              {date(period.start)} → {date(period.end)}
                            </span>
                            <PeriodState state={techLineStatus(period, today)} />
                          </div>
                          <dl className="flex flex-wrap gap-x-5 gap-y-2 text-[11px]">
                            <div>
                              <dt>Achat</dt>
                              <dd className="whitespace-nowrap font-semibold tabular-nums">
                                {money(total.cost)}
                              </dd>
                            </div>
                            <div>
                              <dt>Vente</dt>
                              <dd className="whitespace-nowrap font-semibold tabular-nums">
                                {money(total.sale)}
                              </dd>
                            </div>
                            <div>
                              <dt>Marge</dt>
                              <dd
                                className={`whitespace-nowrap font-semibold tabular-nums ${total.margin < 0 ? "text-red-700" : "text-emerald-700"}`}
                              >
                                {money(total.margin)}
                              </dd>
                            </div>
                          </dl>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[10px] text-slate-400">
                              {techOrderLabel(order)}
                            </span>
                            <TechPaymentButtons
                              compact
                              order={order}
                              disabled={paymentDisabled}
                              onChange={
                                onPaymentChange
                                  ? (status) => onPaymentChange(order, status)
                                  : undefined
                              }
                            />
                          </div>
                          <TechOrderNote notes={order.notes} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </TechHistoryDisclosure>
              {service.periods
                .filter(
                  (p) =>
                    techLineStatus(p.line, today) === "Expiré" &&
                    !service.periods.some(
                      (next) => next.line.start > p.line.start && next.line.start <= today,
                    ),
                )
                .map((p) => (
                  <TechContactBadge
                    key={`${p.order.id}:${p.line.id}`}
                    line={p.line}
                    onClick={() => onContact(p.order)}
                  />
                ))}
            </section>
          );
        })}
    </div>
  );
}
