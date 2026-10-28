import type { TechState } from "@/lib/tech-orders";
export function TechStatusTiles({
  counts,
  selected,
  onSelect,
  total,
  unit = "ventes",
}: {
  counts: Record<TechState, number>;
  selected: string;
  onSelect: (state: TechState | "") => void;
  total?: number;
  unit?: "ventes" | "clients";
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:gap-3" aria-label="Accès rapide par état">
      {(["", "active", "ending", "inactive"] as const).map((state) => {
        const count = state
          ? counts[state]
          : (total ?? counts.active + counts.ending + counts.inactive);
        const label = !state
          ? "Tous"
          : state === "active"
            ? "Actifs"
            : state === "ending"
              ? "Expire sous 3 jours"
              : "Inactifs";
        return (
          <button
            key={state}
            type="button"
            aria-label={`${label} : ${count} ${unit}`}
            aria-pressed={selected === state}
            onClick={() => onSelect(state)}
            className={`relative flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-xl border bg-white p-2 text-center shadow-sm transition hover:border-indigo-300 sm:aspect-auto sm:flex-row-reverse sm:justify-between sm:p-4 ${selected === state ? "ring-2 ring-indigo-300" : ""}`}
          >
            <span
              aria-hidden="true"
              className={`absolute left-2 top-2 h-2 w-2 rounded-full sm:static ${!state ? "bg-indigo-500" : state === "active" ? "bg-green-500" : state === "ending" ? "bg-yellow-400" : "bg-red-500"}`}
            />
            <strong className="text-xl leading-6 tabular-nums text-slate-900 sm:text-2xl">
              {count}
            </strong>
            <span className="flex min-h-6 min-w-0 items-center justify-center text-[10px] font-semibold leading-3 text-slate-600 sm:min-h-0 sm:text-xs sm:leading-4">
              {state === "ending" ? (
                <>
                  <span className="sm:hidden">Expire ≤ 3 j</span>
                  <span className="hidden sm:inline">{label}</span>
                </>
              ) : (
                label
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
