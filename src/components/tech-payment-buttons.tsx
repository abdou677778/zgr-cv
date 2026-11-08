import { BadgeCheck, BadgeX } from "lucide-react";
import { techOrderLabel, type TechOrder } from "@/lib/tech-orders";

/** Manual ledger status, not a bank verification. Missing legacy statuses stay unknown. */
export function TechPaymentButtons({
  order,
  disabled = false,
  onChange,
}: {
  order: TechOrder;
  disabled?: boolean;
  onChange?: (status: NonNullable<TechOrder["paymentStatus"]>) => void;
}) {
  const label = techOrderLabel(order);
  return (
    <div className="space-y-1">
      <div
        role="group"
        aria-label={`Paiement de ${label}`}
        className="inline-flex flex-wrap items-center gap-1"
      >
        <button
          type="button"
          aria-pressed={order.paymentStatus === "paid"}
          aria-label={`Marquer ${label} comme payé`}
          title="Paiement confirmé manuellement — aucune vérification bancaire automatique"
          disabled={disabled || !onChange || order.paymentStatus === "paid"}
          onClick={() => onChange?.("paid")}
          className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-default ${order.paymentStatus === "paid" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"}`}
        >
          <BadgeCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
          Payé
        </button>
        <button
          type="button"
          aria-pressed={order.paymentStatus === "unpaid"}
          aria-label={`Marquer ${label} comme non payé`}
          title="Paiement non reçu ou non confirmé : saisie manuelle"
          disabled={disabled || !onChange || order.paymentStatus === "unpaid"}
          onClick={() => onChange?.("unpaid")}
          className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-default ${order.paymentStatus === "unpaid" ? "border-red-600 bg-red-600 text-white" : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-300"}`}
        >
          <BadgeX aria-hidden="true" className="h-4 w-4 shrink-0" />
          Non payé
        </button>
      </div>
      {!order.paymentStatus && (
        <span className="block text-[10px] text-slate-500">À renseigner</span>
      )}
    </div>
  );
}
