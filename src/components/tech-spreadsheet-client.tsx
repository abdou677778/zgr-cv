import { Fragment, useId, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { groupTechServicePeriods, type TechClientGroup } from "@/lib/tech-client-groups";
import { lineTotals, techLineStatus, techOrderLabel, type TechOrder } from "@/lib/tech-orders";
import { formatTechMoney as money, formatTechDeadline as date } from "@/lib/tech-order-display";
import { primaryTechPeriod } from "@/lib/tech-visible-period";
import { TechOrderClientLink, TechOrderNote, TechOrderNoteButton } from "./tech-order-details";
import { TechPaymentButtons } from "./tech-payment-buttons";
import { TechContactBadge } from "./tech-contact-badge";
import { TechDuplicateNotice } from "./tech-compact-service-history";

function State({ state }: { state: ReturnType<typeof techLineStatus> }) {
  const color =
    state === "Actif"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : state === "Expiré"
        ? "bg-red-50 text-red-700 border-red-200"
        : state === "Expire sous 3 jours"
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-semibold ${color}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {state === "Expire sous 3 jours" ? "Expire ≤ 3 j" : state}
    </span>
  );
}

/** Presentation only: sums all historical lines, never rewrites a sale or its payment scope. */
export function TechSpreadsheetClient({
  group,
  today,
  logo,
  menu,
  rowIndex = 0,
  onContact,
  paymentDisabled,
  onPaymentChange,
}: {
  group: TechClientGroup;
  today: string;
  logo: (id: string) => ReactNode;
  menu: ReactNode;
  rowIndex?: number;
  onContact: (order: TechOrder) => void;
  paymentDisabled?: boolean;
  onPaymentChange?: (order: TechOrder, status: NonNullable<TechOrder["paymentStatus"]>) => void;
}) {
  const services = useMemo(() => groupTechServicePeriods(group.periods), [group.periods]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const regionId = useId();
  const subtotal = group.periods.length > 1;
  const rowSpan =
    services.length + services.filter((s) => expanded.has(s.serviceId)).length + Number(subtotal);
  const band = rowIndex % 2 ? "bg-indigo-50/50" : "bg-white";
  const cell = "border-b border-r border-indigo-100/80 px-3 py-2.5 align-middle";
  const amount = `${cell} whitespace-nowrap text-right tabular-nums`;
  const pay = (order: TechOrder) => (
    <TechPaymentButtons
      compact
      order={order}
      disabled={paymentDisabled}
      onChange={onPaymentChange ? (status) => onPaymentChange(order, status) : undefined}
    />
  );
  return (
    <>
      {services.map((service, index) => {
        const primary = primaryTechPeriod(service.periods, today)!;
        const total = service.periods.reduce(
          (sum, p) => {
            const value = lineTotals(p.line);
            return {
              cost: sum.cost + value.cost,
              sale: sum.sale + value.sale,
              margin: sum.margin + value.margin,
            };
          },
          { cost: 0, sale: 0, margin: 0 },
        );
        const open = expanded.has(service.serviceId);
        const detailId = `${regionId}-${index}`;
        const unpaid = new Set(
          service.periods
            .filter((p) => p.order.id !== primary.order.id && p.order.paymentStatus === "unpaid")
            .map((p) => p.order.id),
        ).size;
        return (
          <Fragment key={service.serviceId}>
            <tr
              data-client-band={rowIndex % 2 ? "alternate" : "base"}
              data-service-row={service.serviceId}
              className={`${index === 0 ? "border-t-2 border-indigo-200" : ""} ${band} transition-colors hover:bg-indigo-100/60 focus-within:bg-indigo-100/60`}
            >
              {index === 0 && (
                <td
                  rowSpan={rowSpan}
                  className={`${cell} w-[210px] min-w-[180px] border-l-[3px] border-l-indigo-300 bg-indigo-50/60`}
                >
                  <div className="flex items-center gap-1.5">
                    <strong
                      dir="auto"
                      title={group.latest.client}
                      className="min-w-0 flex-1 break-words text-[13px] text-indigo-700"
                    >
                      {group.latest.client}
                    </strong>
                    <TechOrderClientLink
                      compact
                      client={group.latest.client}
                      url={group.latest.facebookUrl}
                    />
                    <TechOrderNoteButton client={group.latest.client} notes={group.latest.notes} />
                  </div>
                  <span className="mt-1.5 inline-flex whitespace-nowrap rounded border border-indigo-100 bg-white/70 px-1.5 py-0.5 text-[10px] text-slate-600">
                    {services.length} service{services.length > 1 ? "s" : ""} ·{" "}
                    {group.periods.length} période{group.periods.length > 1 ? "s" : ""}
                  </span>
                  {group.duplicates.size > 0 && (
                    <div className="mt-2">
                      <TechDuplicateNotice />
                    </div>
                  )}
                </td>
              )}
              <td className={`${cell} min-w-[190px]`}>
                <section aria-label={service.name}>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0">{logo(service.serviceId)}</span>
                    <strong dir="auto" className="text-xs text-slate-800">
                      {service.name}
                    </strong>
                  </div>
                  <button
                    type="button"
                    aria-label={`Historique et détails — ${service.name}`}
                    aria-expanded={open}
                    aria-controls={detailId}
                    onClick={() =>
                      setExpanded((old) => {
                        const next = new Set(old);
                        if (next.has(service.serviceId)) next.delete(service.serviceId);
                        else next.add(service.serviceId);
                        return next;
                      })
                    }
                    className="mt-1 inline-flex min-h-6 items-center gap-1 rounded text-[10px] font-medium text-indigo-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
                  >
                    {service.periods.length > 1
                      ? `${service.periods.length} périodes · Historique`
                      : "Plus d’infos"}
                    <ChevronDown
                      aria-hidden="true"
                      className={`h-3 w-3 ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                </section>
              </td>
              <td className={`${cell} whitespace-nowrap text-[11px] tabular-nums`}>
                {date(primary.line.start)} → {date(primary.line.end)}
                {service.periods.length > 1 && (
                  <span className="mt-1 block text-[10px] text-slate-500">
                    Période en cours / dernière
                  </span>
                )}
              </td>
              <td className={`${cell} whitespace-nowrap`}>
                <State state={techLineStatus(primary.line, today)} />
                {techLineStatus(primary.line, today) === "Expiré" && (
                  <TechContactBadge line={primary.line} onClick={() => onContact(primary.order)} />
                )}
              </td>
              <td className={`${cell} min-w-[180px]`}>
                <span className="mb-1 block text-[10px] text-slate-500">
                  Vente de cette période
                </span>
                {pay(primary.order)}
                {primary.order.lines.length > 1 && (
                  <span className="mt-1 block text-[10px] text-slate-500">
                    Paiement commun à cette vente
                  </span>
                )}
                {unpaid > 0 && (
                  <span className="mt-1 block text-[10px] text-red-700">
                    Historique : {unpaid} vente(s) non payée(s)
                  </span>
                )}
              </td>
              <td className={amount}>
                {money(total.cost)}
                {service.periods.length > 1 && (
                  <span className="mt-1 block text-[10px] text-slate-500">Cumul des périodes</span>
                )}
              </td>
              <td className={`${amount} font-bold`}>{money(total.sale)}</td>
              <td
                className={`${amount} font-bold ${total.margin < 0 ? "text-red-700" : "text-emerald-700"}`}
              >
                {money(total.margin)}
              </td>
              {index === 0 && (
                <td rowSpan={rowSpan} className={`${cell} text-center`}>
                  {menu}
                </td>
              )}
            </tr>
            {open && (
              <tr id={detailId} className={band}>
                <td colSpan={7} className="border-b border-r border-indigo-100 bg-slate-50/70 p-3">
                  <div className="overflow-x-auto rounded-lg border border-indigo-100 bg-white">
                    <table className="w-full text-left text-[11px]">
                      <caption className="px-3 py-2 text-left font-semibold text-indigo-800">
                        {service.name} — historique chronologique
                      </caption>
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          {[
                            "Période",
                            "État",
                            "Paiement de la vente",
                            "Achat",
                            "Vente",
                            "Marge",
                            "Note",
                          ].map((h) => (
                            <th key={h} className="whitespace-nowrap px-3 py-2">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {service.periods.map(({ order, line }) => {
                          const t = lineTotals(line);
                          return (
                            <tr
                              key={`${order.id}:${line.id}`}
                              className={`border-t ${group.duplicates.has(`${order.id}:${line.id}`) ? "bg-amber-50" : ""}`}
                            >
                              <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                                {date(line.start)} → {date(line.end)}
                                <span className="block text-[10px] text-slate-400">
                                  {techOrderLabel(order)}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <State state={techLineStatus(line, today)} />
                              </td>
                              <td className="px-3 py-2">{pay(order)}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                                {money(t.cost)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums">
                                {money(t.sale)}
                              </td>
                              <td
                                className={`whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums ${t.margin < 0 ? "text-red-700" : "text-emerald-700"}`}
                              >
                                {money(t.margin)}
                              </td>
                              <td className="max-w-xs px-3 py-2">
                                <TechOrderNote notes={order.notes} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
      {subtotal && (
        <tr data-client-subtotal className="border-b-2 border-indigo-200 bg-indigo-100/60">
          <th
            scope="row"
            colSpan={4}
            className="border-r border-indigo-200 px-3 py-2 text-left text-[11px] font-semibold text-indigo-900"
          >
            Total client{" "}
            <span className="ml-2 font-normal text-slate-500">
              Toutes les périodes · {group.orders.length} vente(s)
            </span>
          </th>
          <td className={`${amount} font-semibold`}>{money(group.totals.cost)}</td>
          <td className={`${amount} font-bold`}>{money(group.totals.sale)}</td>
          <td
            className={`${amount} font-bold ${group.totals.margin < 0 ? "text-red-700" : "text-emerald-700"}`}
          >
            {money(group.totals.margin)}
          </td>
        </tr>
      )}
    </>
  );
}
