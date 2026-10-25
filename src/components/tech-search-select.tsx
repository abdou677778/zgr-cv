import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Input } from "./ui/input";
import { techMatchesSearch } from "@/lib/tech-orders";
type Choice = { value: string; label: string; detail?: string; leading?: ReactNode };
export function TechSearchSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder = "Rechercher…",
}: {
  label: string;
  value: string;
  options: Choice[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const id = useId();
  const matches = useMemo(
    () => options.filter((o) => techMatchesSearch(`${o.label} ${o.detail || ""}`, query)),
    [options, query],
  );
  const choices = matches.slice(0, 50);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, id, active]);
  const selected = options.find((o) => o.value === value);
  const choose = (next: string) => {
    if (disabled) return;
    onChange(next);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setQuery("");
        setActive(0);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={id}
          disabled={disabled}
          className="flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-normal shadow-sm transition hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50"
        >
          {selected?.leading}
          <span className="min-w-0 flex-1 truncate">{selected?.label || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }}
        align="start"
        className="z-[150] w-[var(--radix-popover-trigger-width)] min-w-[220px] max-w-[calc(100vw-24px)] rounded-xl p-2 shadow-xl"
        collisionPadding={12}
      >
        <div className="relative mb-2">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            aria-label={`Rechercher : ${label}`}
            placeholder={placeholder}
            value={query}
            className="pl-9"
            autoComplete="off"
            disabled={disabled}
            aria-controls={id}
            aria-activedescendant={choices[active] ? `${id}-${active}` : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) =>
                  Math.max(0, Math.min(choices.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))),
                );
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (choices[active]) choose(choices[active].value);
              }
            }}
          />
        </div>
        <div
          id={id}
          role="listbox"
          aria-label={label}
          className="overflow-y-auto overscroll-contain"
          style={{
            maxHeight:
              "min(280px, max(80px, calc(var(--radix-popover-content-available-height) - 88px)))",
          }}
        >
          {choices.map((choice, i) => (
            <button
              type="button"
              disabled={disabled}
              role="option"
              id={`${id}-${i}`}
              key={choice.value}
              aria-selected={choice.value === value}
              className={`flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm ${i === active ? "bg-indigo-50" : "hover:bg-slate-50"}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(choice.value)}
            >
              {choice.leading}
              <span className="min-w-0 flex-1">
                <span className="block break-words font-medium">{choice.label}</span>
                {choice.detail && (
                  <small className="block break-all text-slate-500">{choice.detail}</small>
                )}
              </span>
              {choice.value === value && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
            </button>
          ))}
          {!choices.length && (
            <p className="p-3 text-sm text-slate-500">
              Aucun résultat. Précisez ou simplifiez votre recherche.
            </p>
          )}
        </div>
        {matches.length > 50 && (
          <p className="px-2 pt-2 text-xs text-slate-500">
            50 sur {matches.length} résultats. Précisez votre recherche.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
