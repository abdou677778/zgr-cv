import type { TechState } from "@/lib/tech-orders";
export function TechStatusTiles({
  counts,
  selected,
  onSelect,
}: {
  counts: Record<TechState, number>;
  selected: string;
  onSelect: (state: TechState) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Accès rapide par état">
      {(["active", "ending", "inactive"] as TechState[]).map((state) => {
        const label =
          state === "active" ? "Actifs" : state === "ending" ? "Expire sous 3 jours" : "Inactifs";
        return (
          <button
            key={state}
            type="button"
            aria-label={`${label} : ${counts[state]} ventes`}
            aria-pressed={selected === state}
            onClick={() => onSelect(state)}
            className={`relative flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-xl border bg-white p-2 text-center shadow-sm transition hover:border-indigo-300 sm:aspect-auto sm:flex-row-reverse sm:justify-between sm:p-4 ${selected === state ? "ring-2 ring-indigo-300" : ""}`}
          >
            <span
              aria-hidden="true"
              className={`absolute left-2 top-2 h-2 w-2 rounded-full sm:static ${state === "active" ? "bg-green-500" : state === "ending" ? "bg-yellow-400" : "bg-red-500"}`}
            />
            <strong className="text-xl leading-6 tabular-nums text-slate-900 sm:text-2xl">
              {counts[state]}
            </strong>
            <span className="flex min-h-6 min-w-0 items-center justify-center text-[10px] font-semibold leading-3 text-slate-600 sm:min-h-0 sm:text-xs sm:leading-4">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
