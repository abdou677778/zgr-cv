import { MessageCircle, MessageCircleCheck } from "lucide-react";
import { techContactAt, type TechLine } from "@/lib/tech-orders";

export function TechContactBadge({ line, onClick }: { line: TechLine; onClick?: () => void }) {
  const at = techContactAt(line);
  const date = at
    ? new Intl.DateTimeFormat("fr-DZ", {
        timeZone: "Africa/Algiers",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(at))
    : "";
  const Icon = at ? MessageCircleCheck : MessageCircle;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={
        at
          ? `Contact confirmé manuellement le ${date}`
          : "Préparer le message puis confirmer le contact"
      }
      className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold disabled:opacity-100 ${at ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}`}
    >
      <Icon aria-hidden="true" className="h-3 w-3" />
      {at ? `Contacté · ${date}` : "À contacter"}
    </button>
  );
}
