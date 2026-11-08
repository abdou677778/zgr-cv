import { BadgeCheck, BadgeX, CircleHelp } from "lucide-react";
import { techOrderLabel, type TechOrder } from "@/lib/tech-orders";

/** One manual toggle per sale. An unset legacy status is never inferred from notes. */
export function TechPaymentButtons({
  order,
  disabled = false,
  onChange,
  compact = false,
}: {
  order: TechOrder;
  disabled?: boolean;
  onChange?: (status: NonNullable<TechOrder["paymentStatus"]>) => void;
  compact?: boolean;
}) {
  const paid = order.paymentStatus === "paid";
  const unknown = !order.paymentStatus;
  const next = paid ? "unpaid" : "paid";
  const text = unknown ? "À renseigner" : paid ? "Payé" : "Non payé";
  const action = `Marquer ${techOrderLabel(order)} comme ${paid ? "non payé" : "payé"}`;
  const Icon = unknown ? CircleHelp : paid ? BadgeCheck : BadgeX;
  const color = unknown
    ? "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-500"
    : paid
      ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500"
      : "border-red-600 bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500";
  return (
    <div
      role="group"
      aria-label={`Paiement de ${techOrderLabel(order)}`}
      className="inline-flex flex-nowrap items-center whitespace-nowrap"
    >
      <button
        type="button"
        aria-pressed={paid}
        aria-label={`${text} — ${action}`}
        title={`${action}. Confirmation manuelle ; montants et dates inchangés.`}
        disabled={disabled || !onChange}
        onClick={() => onChange?.(next)}
        className={`inline-flex shrink-0 ${compact ? "min-h-8" : "min-h-10"} items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-60 ${color}`}
      >
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {text}
      </button>
    </div>
  );
}
