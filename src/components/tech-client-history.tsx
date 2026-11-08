import type { ReactNode } from "react";
import { groupTechServicePeriods, type TechClientGroup } from "@/lib/tech-client-groups";
import { lineTotals, techLineStatus, techOrderLabel } from "@/lib/tech-orders";
import { formatTechMoney as money, formatTechDeadline as date } from "@/lib/tech-order-display";
import { TechOrderClientLink, TechOrderNote, TechOrderNoteButton } from "./tech-order-details";
import { TechCompactServiceHistory, TechDuplicateNotice } from "./tech-compact-service-history";
import { TechHistoryDisclosure } from "./tech-history-disclosure";
export { TechHistoryDisclosure } from "./tech-history-disclosure";
import { TechContactBadge } from "./tech-contact-badge";
import { TechPaymentButtons } from "./tech-payment-buttons";
import type { TechOrder } from "@/lib/tech-orders";

export function TechClientHistory({
  group,
  today,
  logo,
  menu,
  onContact,
  mobile = false,
  paymentDisabled = false,
  onPaymentChange,
}: {
  group: TechClientGroup;
  today: string;
  logo: (id: string) => ReactNode;
  menu: ReactNode;
  mobile?: boolean;
  onContact: (order: TechOrder) => void;
  paymentDisabled?: boolean;
  onPaymentChange?: (order: TechOrder, status: NonNullable<TechOrder["paymentStatus"]>) => void;
}) {
  const client = mobile ? (
    <>
      <strong className="text-indigo-700">{group.latest.client}</strong>
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
      <span className="inline-flex whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
        {group.periods.length} période(s)
      </span>
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
              · {olderUnpaid} impayée(s)
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
  const history = mobile ? (
    <div className="space-y-2">
      {group.duplicates.size > 0 && <TechDuplicateNotice />}
      {groupTechServicePeriods(group.periods).map((service) => (
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
    />
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
      <article className="space-y-2 rounded-xl border bg-white p-3">
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
    <tr className="border-t border-slate-100 align-middle hover:bg-slate-50/60">
      <td className="px-3 py-2">{client}</td>
      <td className="min-w-[420px] px-3 py-2">{history}</td>
      <td className="whitespace-nowrap px-3 py-2">{status}</td>
      <td className="min-w-[180px] px-3 py-2">{payment}</td>
      <td
        title="Coût cumulé du client"
        className="whitespace-nowrap px-3 py-2 text-right tabular-nums"
      >
        {money(group.totals.cost)}
      </td>
      <td
        title="Ventes cumulées du client"
        className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums"
      >
        {money(group.totals.sale)}
      </td>
      <td
        title="Marge brute cumulée du client"
        className={`whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums ${group.totals.margin < 0 ? "text-red-700" : "text-emerald-700"}`}
      >
        {money(group.totals.margin)}
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-right">{menu}</td>
    </tr>
  );
}
