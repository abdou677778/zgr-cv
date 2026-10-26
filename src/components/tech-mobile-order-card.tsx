import type { ReactNode } from "react";
import { orderTotals, techLineStatus, type TechOrder } from "@/lib/tech-orders";
import { formatTechMoney as money, formatTechDeadline } from "@/lib/tech-order-display";

export function TechMobileOrderCard({
  order,
  today,
  renderLogo,
  menu,
}: {
  order: TechOrder;
  today: string;
  renderLogo: (serviceId: string) => ReactNode;
  menu: ReactNode;
}) {
  const value = orderTotals(order);
  return (
    <article
      aria-label={`Vente de ${order.client}`}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex min-w-0 items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50/60 py-1 pl-3 pr-1">
        <h3 className="min-w-0 break-words text-sm font-extrabold leading-5 text-indigo-700">
          {order.client}
        </h3>
        <div className="shrink-0">{menu}</div>
      </header>
      <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 p-3">
        <div className="min-w-0 space-y-2.5">
          {order.lines.map((line) => {
            const status = techLineStatus(line, today);
            const active = status === "Actif",
              ending = status === "Expire sous 3 jours",
              upcoming = status === "À venir";
            return (
              <div key={line.id} className="flex min-w-0 items-start gap-2">
                {renderLogo(line.serviceId)}
                <div className="min-w-0 flex-1">
                  <p
                    title={line.name}
                    className="truncate text-xs font-semibold leading-4 text-slate-800"
                  >
                    {line.name}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                    Fin : <time dateTime={line.end}>{formatTechDeadline(line.end)}</time>
                  </p>
                  <span
                    title={`${status} — calculé automatiquement selon les dates`}
                    className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold leading-3 ${active ? "bg-green-100 text-green-800" : ending ? "bg-amber-100 text-amber-900" : upcoming ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-800"}`}
                  >
                    {active ? "Actif" : ending ? "Expire ≤ 3 j" : upcoming ? "À venir" : "Inactif"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <dl
          aria-label="Totaux de la vente"
          className="min-w-0 space-y-1.5 border-l border-slate-100 pl-2 text-right text-[11px] tabular-nums"
        >
          <div>
            <dt className="text-[10px] text-slate-500">Coût</dt>
            <dd className="break-words font-semibold text-slate-700">{money(value.cost)}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-slate-500">Total</dt>
            <dd className="break-words font-bold text-slate-900">{money(value.sale)}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-slate-500">Marge brute</dt>
            <dd
              className={`break-words font-bold ${value.margin < 0 ? "text-red-700" : "text-emerald-700"}`}
            >
              {money(value.margin)}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
