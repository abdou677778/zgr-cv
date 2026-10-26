import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { addTechMonths, type TechLine } from "@/lib/tech-orders";
import { techSaleMonths, techSaleStartPatch, techSalePricePatch } from "@/lib/tech-sale-editor";

export function TechSaleLineFields({
  line,
  onChange,
  disabled = false,
}: {
  line: TechLine;
  onChange: (patch: Partial<TechLine>) => void;
  disabled?: boolean;
}) {
  const [months, setMonths] = useState<number | "custom">(() => techSaleMonths(line));
  const [periodOpen, setPeriodOpen] = useState(false);
  const [autoPurchase, setAutoPurchase] = useState(() => !Number.isFinite(line.priceUsd));
  const periodLabel = months === "custom" ? "Date personnalisée" : `${months} mois`;
  const dateClass = "h-10 w-full min-w-0 max-w-full px-1.5 text-xs sm:px-2 sm:text-sm";
  return (
    <div className="space-y-1.5">
      <div className="grid min-w-0 gap-2 lg:grid-cols-2 lg:gap-4">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] items-end gap-1.5">
          <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-slate-600">
            Début inclus
            <Input
              type="date"
              disabled={disabled}
              required
              min="2000-01-01"
              max="2199-12-31"
              className={dateClass}
              value={line.start}
              onChange={(event) => onChange(techSaleStartPatch(event.target.value, months))}
            />
          </label>
          <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-slate-600">
            <span title="Fin / renouveler le — date exclue">Fin / renouveler le</span>
            <Input
              type="date"
              disabled={disabled}
              required
              min={line.start}
              max="2199-12-31"
              className={dateClass}
              value={line.end}
              onChange={(event) => {
                setMonths("custom");
                onChange({ end: event.target.value });
              }}
            />
          </label>
          <Popover open={periodOpen} onOpenChange={(open) => setPeriodOpen(!disabled && open)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Ajuster la période — ${periodLabel}`}
                title={`Ajuster la période — ${periodLabel}`}
                className="flex h-10 w-9 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700"
              >
                <CalendarRange className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              collisionPadding={12}
              className="z-[160] w-60 max-w-[calc(100vw-24px)] rounded-xl p-3"
            >
              <p className="mb-2 text-xs font-semibold">Période depuis le début · {periodLabel}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((value) => (
                  <button
                    type="button"
                    key={value}
                    disabled={disabled}
                    aria-pressed={months === value}
                    className={`rounded-lg border py-2 text-xs font-semibold ${months === value ? "border-indigo-500 bg-indigo-100 text-indigo-800" : "bg-white"}`}
                    onClick={() => {
                      setMonths(value);
                      onChange({ end: addTechMonths(line.start, value) });
                      setPeriodOpen(false);
                    }}
                  >
                    {String(value).padStart(2, "0")} mois
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={disabled}
                className="mt-2 py-1 text-xs text-indigo-700"
                onClick={() => {
                  setMonths("custom");
                  setPeriodOpen(false);
                }}
              >
                Conserver une fin personnalisée
              </button>
            </PopoverContent>
          </Popover>
        </div>
        <div className="grid min-w-0 grid-cols-3 gap-1.5">
          {(
            [
              ["priceUsd", "Prix d’achat", "Prix d’achat en USD"],
              ["rate", "USD", "Taux de conversion : DA pour 1 USD"],
              ["saleDzd", "Prix de vente", "Prix de vente en DA"],
            ] as const
          ).map(([field, label, description]) => (
            <label
              key={field}
              className={`grid min-w-0 gap-1 text-[11px] font-semibold ${field === "saleDzd" ? "text-emerald-800" : "text-slate-600"}`}
            >
              <span title={description}>{label}</span>
              <Input
                type="number"
                disabled={disabled}
                required
                step="0.01"
                min={field === "rate" ? "0.01" : "0"}
                max="100000000"
                inputMode="decimal"
                aria-label={description}
                value={Number.isFinite(line[field]) ? line[field] : ""}
                className={`h-10 min-w-0 px-2 text-sm tabular-nums ${field === "saleDzd" ? "border-emerald-300 bg-emerald-50 font-bold text-emerald-900 focus-visible:ring-emerald-400" : field === "priceUsd" ? "bg-amber-50/60 text-amber-900" : "bg-white"}`}
                onChange={(event) => {
                  const value = event.target.value.trim() === "" ? NaN : Number(event.target.value);
                  if (field === "priceUsd") setAutoPurchase(!Number.isFinite(value));
                  onChange(techSalePricePatch(line, field, value, autoPurchase));
                }}
              />
            </label>
          ))}
        </div>
      </div>
      <p className="text-[10px] leading-4 text-slate-500">
        {periodLabel} · fin exclue · prix pour toute la période, sans modification automatique des
        montants.
      </p>
      {autoPurchase && (
        <p className="text-[11px] text-amber-800">
          Achat estimé = vente ÷ taux, arrondi à 0,01 USD. Vérifiez le vrai prix d’achat ; sa saisie
          manuelle arrête l’estimation.
        </p>
      )}
    </div>
  );
}
