import type { ReactNode } from "react";
import type { TechClientGroup } from "@/lib/tech-client-groups";
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
      {group.periods.map(({ order, line }) => {
        const total = lineTotals(line);
        return (
          <div
            key={`${order.id}:${line.id}`}
            className={`rounded-lg border p-2 ${group.duplicates.has(`${order.id}:${line.id}`) ? "border-amber-400" : "border-slate-100"}`}
          >
            <div className="flex items-start gap-2">
              {logo(line.serviceId)}
              <div className="min-w-0 flex-1 text-xs">
                <strong>{line.name}</strong>
                <div>
                  {date(line.start)} → {date(line.end)}
                </div>
                <div
                  className={
                    techLineStatus(line, today) === "Expiré" ? "text-red-700" : "text-indigo-700"
                  }
                >
                  {techLineStatus(line, today)}
                </div>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-600">
              <span>Coût {money(total.cost)}</span>
              <span>
                Vente <b>{money(total.sale)}</b>
              </span>
              <span>
                Marge <b>{money(total.margin)}</b>
              </span>
            </div>
            {techLineStatus(line, today) === "Expiré" &&
              !group.periods.some(
                (p) =>
                  p.line.serviceId === line.serviceId &&
                  p.line.start > line.start &&
                  p.line.start <= today,
              ) && <TechContactBadge line={line} onClick={() => onContact(order)} />}
            <details className="mt-1 text-xs text-slate-500">
              <summary className="cursor-pointer">Note / référence de cette période</summary>
              <span>{techOrderLabel(order)}</span>
              <TechOrderNote notes={order.notes} />
            </details>
          </div>
        );
      })}
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
