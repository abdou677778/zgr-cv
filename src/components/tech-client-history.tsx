import type { ReactNode } from "react";
import { groupTechServicePeriods, type TechClientGroup } from "@/lib/tech-client-groups";
import { lineTotals, techLineStatus, techOrderLabel } from "@/lib/tech-orders";
import { formatTechMoney as money, formatTechDeadline as date } from "@/lib/tech-order-display";
import { TechOrderClientLink, TechOrderNote } from "./tech-order-details";
import { TechContactBadge } from "./tech-contact-badge";
import type { TechOrder } from "@/lib/tech-orders";

export function TechClientHistory({
  group,
  today,
  logo,
  menu,
  onContact,
  mobile = false,
}: {
  group: TechClientGroup;
  today: string;
  logo: (id: string) => ReactNode;
  menu: ReactNode;
  mobile?: boolean;
  onContact: (order: TechOrder) => void;
}) {
  const client = (
    <>
      <strong className="text-indigo-700">{group.latest.client}</strong>
      <div className="mt-1">
        <TechOrderClientLink client={group.latest.client} url={group.latest.facebookUrl} />
      </div>
    </>
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
  const history = (
    <div className="space-y-2">
      {group.duplicates.size > 0 && (
        <p role="status" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          Doublons possibles : montants à vérifier avant suppression. Totaux du registre non
          corrigés automatiquement.
        </p>
      )}
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
          <details className="group mt-1.5 text-xs text-slate-600">
            <summary className="cursor-pointer rounded py-1 font-medium text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
              Plus d’infos
            </summary>
            <div className="mt-1 space-y-2 border-t border-slate-100 pt-2">
              {service.periods.map(({ order, line }) => {
                const total = lineTotals(line);
                return (
                  <div key={`${order.id}:${line.id}`} className="space-y-1 rounded bg-slate-50 p-2">
                    <div className="text-[11px] font-semibold tabular-nums">
                      {date(line.start)} → {date(line.end)}
                    </div>
                    <dl className="grid grid-cols-3 gap-1 text-[11px]">
                      <div>
                        <dt>Achat</dt>
                        <dd className="font-semibold">{money(total.cost)}</dd>
                      </div>
                      <div>
                        <dt>Vente</dt>
                        <dd className="font-semibold">{money(total.sale)}</dd>
                      </div>
                      <div>
                        <dt>Marge</dt>
                        <dd
                          className={`font-semibold ${total.margin < 0 ? "text-red-700" : "text-emerald-700"}`}
                        >
                          {money(total.margin)}
                        </dd>
                      </div>
                    </dl>
                    <span className="block text-[10px] text-slate-400">
                      {techOrderLabel(order)}
                    </span>
                    <TechOrderNote notes={order.notes} />
                  </div>
                );
              })}
            </div>
          </details>
        </section>
      ))}
    </div>
  );
  const totals = (
    <div className="text-xs">
      Ventes <b>{money(group.totals.sale)}</b> · Coûts {money(group.totals.cost)} · Marge{" "}
      <b className={group.totals.margin < 0 ? "text-red-700" : "text-emerald-700"}>
        {money(group.totals.margin)}
      </b>
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
        {totals}
      </article>
    );
  return (
    <tr className="border-t align-top">
      <td className="px-4 py-4">{group.periods.length} période(s)</td>
      <td className="px-4 py-4">{client}</td>
      <td className="px-4 py-4">{status}</td>
      <td className="min-w-80 px-4 py-4">{history}</td>
      <td className="px-4 py-4 text-right">{money(group.totals.cost)}</td>
      <td className="px-4 py-4 text-right font-bold">{money(group.totals.sale)}</td>
      <td
        className={`px-4 py-4 text-right font-bold ${group.totals.margin < 0 ? "text-red-700" : "text-emerald-700"}`}
      >
        {money(group.totals.margin)}
      </td>
      <td className="max-w-60 px-4 py-4">
        <TechOrderNote notes={group.latest.notes} />
      </td>
      <td className="px-4 py-4">{menu}</td>
    </tr>
  );
}
