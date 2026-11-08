import { useId, useMemo, useState, type ReactNode } from "react";
import { groupTechServicePeriods, type TechClientGroup } from "@/lib/tech-client-groups";
import { lineTotals, techLineStatus, techOrderLabel } from "@/lib/tech-orders";
import { formatTechMoney as money, formatTechDeadline as date } from "@/lib/tech-order-display";
import { TechOrderClientLink, TechOrderNote, TechOrderNoteButton } from "./tech-order-details";
import { TechCompactServiceHistory, TechDuplicateNotice } from "./tech-compact-service-history";
import { TechHistoryDisclosure } from "./tech-history-disclosure";
export { TechHistoryDisclosure } from "./tech-history-disclosure";
import { TechContactBadge } from "./tech-contact-badge";
import { TechPaymentButtons } from "./tech-payment-buttons";
import { primaryTechPeriod } from "@/lib/tech-visible-period";
import type { TechOrder } from "@/lib/tech-orders";
import { TechSpreadsheetClient } from "./tech-spreadsheet-client";

export function TechClientHistory(props: Parameters<typeof TechMobileClientHistory>[0]) {
  return props.mobile ? (
    <TechMobileClientHistory {...props} />
  ) : (
    <TechSpreadsheetClient {...props} />
  );
}

function TechMobileClientHistory({
  group,
  today,
  logo,
  menu,
  onContact,
  mobile = false,
  paymentDisabled = false,
  onPaymentChange,
  rowIndex = 0,
}: {
  group: TechClientGroup;
  today: string;
  logo: (id: string) => ReactNode;
  menu: ReactNode;
  mobile?: boolean;
  onContact: (order: TechOrder) => void;
  paymentDisabled?: boolean;
  onPaymentChange?: (order: TechOrder, status: NonNullable<TechOrder["paymentStatus"]>) => void;
  rowIndex?: number;
}) {
  const [allServices, setAllServices] = useState(false);
  const serviceListId = useId();
  const services = useMemo(() => groupTechServicePeriods(group.periods), [group.periods]);
  const visibleServices = allServices ? services : services.slice(0, 2);
  const counts = `${services.length} service${services.length > 1 ? "s" : ""} · ${group.periods.length} période${group.periods.length > 1 ? "s" : ""}`;
  const band = rowIndex % 2 ? "bg-indigo-50/50" : "bg-white";
  const hiddenStates = allServices
    ? []
    : services.slice(2).map((service) => {
        const primary = primaryTechPeriod(service.periods, today);
        return primary ? techLineStatus(primary.line, today) : "";
      });
  const hiddenEnding = hiddenStates.filter((state) => state === "Expire sous 3 jours").length;
  const hiddenExpired = hiddenStates.filter((state) => state === "Expiré").length;
  const countBadge = (
    <span className="inline-flex whitespace-nowrap rounded border border-slate-200/80 bg-white/70 px-1.5 py-0.5 text-[10px] text-slate-600">
      {counts}
    </span>
  );
  const client = mobile ? (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-indigo-700">{group.latest.client}</strong>
        {countBadge}
      </div>
      <div className="mt-1">
        <TechOrderClientLink client={group.latest.client} url={group.latest.facebookUrl} />
      </div>
    </>
  ) : (
    <div className="max-w-56">
      <div className="flex min-w-0 items-center gap-1">
        <strong
          dir="auto"
          title={group.latest.client}
          className="min-w-0 flex-1 truncate text-[13px] text-indigo-700"
        >
          {group.latest.client}
        </strong>
        <TechOrderClientLink compact client={group.latest.client} url={group.latest.facebookUrl} />
        <TechOrderNoteButton client={group.latest.client} notes={group.latest.notes} />
      </div>
      {countBadge}
    </div>
  );
  const status = (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${group.state === "inactive" ? "text-red-700" : group.state === "ending" ? "text-amber-700" : "text-emerald-700"}`}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${group.state === "inactive" ? "bg-red-500" : group.state === "ending" ? "bg-amber-400" : "bg-green-500"}`}
      />
      {group.state === "inactive" ? "Inactif" : group.state === "ending" ? "Expire ≤ 3 j" : "Actif"}
    </span>
  );
  const olderUnpaid = group.orders.filter(
    (order) => order.id !== group.latest.id && order.paymentStatus === "unpaid",
  ).length;
  const payment = (
    <div className="space-y-1">
      {group.orders.length > 1 && (
        <div className="flex items-center gap-1 whitespace-nowrap text-[10px] text-slate-500">
          <span>Dernière vente</span>
          {!mobile && olderUnpaid > 0 && (
            <span
              className="text-red-700"
              title={`Historique : ${olderUnpaid} vente(s) non payée(s)`}
            >
              · hist. {olderUnpaid} impayée(s)
            </span>
          )}
        </div>
      )}
      <TechPaymentButtons
        compact={!mobile}
        order={group.latest}
        disabled={paymentDisabled}
        onChange={onPaymentChange ? (status) => onPaymentChange(group.latest, status) : undefined}
      />
      {mobile && olderUnpaid > 0 && (
        <span className="block text-[10px] text-red-700">
          Historique : {olderUnpaid} vente(s) non payée(s)
        </span>
      )}
    </div>
  );
  const historyContent = mobile ? (
    <div className="space-y-2">
      {group.duplicates.size > 0 && <TechDuplicateNotice />}
      {visibleServices.map((service) => (
        <section
          key={service.serviceId}
          aria-label={service.name}
          className="min-w-0 rounded-lg border border-slate-100 p-2"
        >
          <div className="mb-1.5 flex items-center gap-2">
            {logo(service.serviceId)}
            <strong className="min-w-0 break-words text-xs">{service.name}</strong>
          </div>
          <div className="space-y-1">
            {service.periods.map(({ order, line }) => {
              const state = techLineStatus(line, today);
              return (
                <div
                  key={`${order.id}:${line.id}`}
                  className={`flex items-center justify-between gap-2 rounded px-1 py-0.5 text-[11px] ${group.duplicates.has(`${order.id}:${line.id}`) ? "bg-amber-50 ring-1 ring-amber-400" : ""}`}
                >
                  <span className="whitespace-nowrap tabular-nums">
                    {date(line.start)} → {date(line.end)}
                  </span>
                  <span
                    className={`shrink-0 text-right font-semibold ${state === "Expiré" ? "text-red-700" : state === "Actif" ? "text-emerald-700" : state === "Expire sous 3 jours" ? "text-amber-700" : "text-slate-500"}`}
                  >
                    {state === "Expire sous 3 jours" ? "Expire ≤ 3 j" : state}
                  </span>
                </div>
              );
            })}
          </div>
          {service.periods
            .filter(
              ({ line }) =>
                techLineStatus(line, today) === "Expiré" &&
                !service.periods.some((p) => p.line.start > line.start && p.line.start <= today),
            )
            .map(({ order, line }) => (
              <TechContactBadge
                key={`${order.id}:${line.id}`}
                line={line}
                onClick={() => onContact(order)}
              />
            ))}
          <TechHistoryDisclosure>
            {() => (
              <div className="mt-1 space-y-2 border-t border-slate-100 pt-2">
                {service.periods.map(({ order, line }) => {
                  const total = lineTotals(line);
                  return (
                    <div
                      key={`${order.id}:${line.id}`}
                      className="space-y-1 rounded bg-slate-50 p-2"
                    >
                      <div className="text-[11px] font-semibold tabular-nums">
                        {date(line.start)} → {date(line.end)}
                      </div>
                      <dl className="flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
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
                      <span className="block text-[10px] text-slate-400">
                        {techOrderLabel(order)}
                      </span>
                      <TechOrderNote notes={order.notes} />
                      <TechPaymentButtons
                        order={order}
                        disabled={paymentDisabled}
                        onChange={
                          onPaymentChange ? (status) => onPaymentChange(order, status) : undefined
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </TechHistoryDisclosure>
        </section>
      ))}
    </div>
  ) : (
    <TechCompactServiceHistory
      group={group}
      today={today}
      logo={logo}
      onContact={onContact}
      paymentDisabled={paymentDisabled}
      onPaymentChange={onPaymentChange}
      maxServices={allServices ? services.length : 2}
    />
  );
  const history = (
    <div id={serviceListId} className="min-w-0">
      {historyContent}
      {services.length > 2 && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={allServices}
            aria-controls={serviceListId}
            onClick={() => setAllServices((value) => !value)}
            className="inline-flex min-h-8 items-center whitespace-nowrap rounded-md border border-indigo-200 bg-white/80 px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            {allServices
              ? "Réduire les services"
              : `+${services.length - 2} autre${services.length - 2 > 1 ? "s" : ""} service${services.length - 2 > 1 ? "s" : ""}`}
          </button>
          {!!hiddenEnding && (
            <span role="status" className="text-[10px] font-medium text-amber-800">
              {hiddenEnding} {hiddenEnding > 1 ? "expirent" : "expire"} ≤ 3 j
            </span>
          )}
          {!!hiddenExpired && (
            <span role="status" className="text-[10px] font-medium text-red-700">
              {hiddenExpired} {hiddenExpired > 1 ? "services expirés" : "service expiré"}
            </span>
          )}
        </div>
      )}
    </div>
  );
  const totals = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
      <span className="whitespace-nowrap">
        Ventes <b>{money(group.totals.sale)}</b>
      </span>
      <span className="whitespace-nowrap">Coûts {money(group.totals.cost)}</span>
      <span className="whitespace-nowrap">
        Marge{" "}
        <b className={group.totals.margin < 0 ? "text-red-700" : "text-emerald-700"}>
          {money(group.totals.margin)}
        </b>
      </span>
    </div>
  );
  if (mobile)
    return (
      <article
        className={`space-y-2 rounded-xl border border-slate-300/80 p-3 shadow-sm transition-colors focus-within:bg-indigo-100/50 ${band}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>{client}</div>
          <div>
            {status}
            {menu}
          </div>
        </div>
        {history}
        {payment}
        {totals}
      </article>
    );
  return (
    <TechSpreadsheetClient
      group={group}
      today={today}
      logo={logo}
      menu={menu}
      rowIndex={rowIndex}
      onContact={onContact}
      paymentDisabled={paymentDisabled}
      onPaymentChange={onPaymentChange}
    />
  );
}
