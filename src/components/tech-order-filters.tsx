import { Filter, Search, X } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { TechSearchSelect } from "./tech-search-select";
import {
  emptyTechFilters,
  techDatePresets,
  techSortLabels,
  type TechFilters,
  type TechService,
  type techClients,
} from "@/lib/tech-orders";

export function TechOrderFilters({
  filters,
  clients,
  services,
  today,
  onChange,
}: {
  filters: TechFilters;
  clients: ReturnType<typeof techClients>;
  services: TechService[];
  today: string;
  onChange: (filters: TechFilters) => void;
}) {
  const set = <K extends keyof TechFilters>(key: K, value: TechFilters[K]) =>
    onChange({ ...filters, [key]: value });
  const chips = [
    filters.client
      ? {
          label: `Client : ${clients.find((client) => client.key === filters.client)?.client || "sélectionné"}`,
          reset: () => set("client", ""),
        }
      : null,
    filters.orderId
      ? { label: `Commande : ${filters.orderId}`, reset: () => set("orderId", "") }
      : null,
    filters.serviceId
      ? {
          label: `Service : ${services.find((service) => service.id === filters.serviceId)?.name || "sélectionné"}`,
          reset: () => set("serviceId", ""),
        }
      : null,
    filters.from || filters.to
      ? {
          label: `${filters.dateBasis === "end" ? "Fin" : filters.dateBasis === "start" ? "Début" : "Création"} : ${filters.from || "…"} → ${filters.to || "…"}`,
          reset: () => onChange({ ...filters, from: "", to: "" }),
        }
      : null,
  ].filter((chip) => chip !== null);
  const fieldClass = "grid min-w-0 gap-1 text-xs font-semibold text-slate-600";
  const selectClass =
    "h-10 min-w-0 rounded-xl border bg-white px-2 text-sm font-normal text-slate-900";
  return (
    <div className="space-y-2">
      <div className="relative min-w-0">
        <div className="relative mr-28 min-w-0 sm:mr-36">
          <Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            aria-label="Recherche rapide"
            value={filters.query}
            onChange={(event) => set("query", event.target.value)}
            placeholder="Client, commande, service…"
            className="pl-9 pr-9"
          />
          {!!filters.query && (
            <button
              type="button"
              aria-label="Effacer la recherche"
              onClick={() => set("query", "")}
              className="absolute right-0 top-0 flex h-10 w-9 items-center justify-center text-slate-500"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <details className="group min-w-0" id="tech-filter-controls">
          <summary
            className="absolute right-0 top-0 flex h-10 cursor-pointer list-none items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-800 [&::-webkit-details-marker]:hidden"
            aria-label={`Filtres et tri${chips.length ? ` : ${chips.length} filtre(s) avancé(s) actif(s)` : ""}`}
          >
            <Filter aria-hidden="true" className="h-4 w-4" />
            <span>
              Filtres<span className="hidden sm:inline"> et tri</span>
            </span>
            {!!chips.length && (
              <span className="rounded-full bg-indigo-700 px-1.5 text-white">{chips.length}</span>
            )}
          </summary>
          <div className="mt-2 space-y-3 rounded-xl border bg-slate-50 p-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className={fieldClass}>
                Client
                <TechSearchSelect
                  label="Filtrer par client"
                  value={filters.client}
                  options={[
                    { value: "", label: "Tous les clients" },
                    ...clients.map((client) => ({
                      value: client.key,
                      label: client.client,
                      detail: client.facebookUrl,
                    })),
                  ]}
                  onChange={(key) => set("client", key)}
                  placeholder="Nom ou lien Facebook…"
                />
              </label>
              <label className={fieldClass}>
                Commande / ID
                <Input
                  value={filters.orderId}
                  onChange={(event) => set("orderId", event.target.value)}
                  placeholder="TECH-… ou ID complet"
                />
              </label>
              <label className={fieldClass}>
                Service
                <TechSearchSelect
                  label="Filtrer par service"
                  value={filters.serviceId}
                  options={[
                    { value: "", label: "Tous les services" },
                    ...services.map((service) => ({ value: service.id, label: service.name })),
                  ]}
                  onChange={(id) => set("serviceId", id)}
                />
              </label>
              <label className={fieldClass}>
                Trier les ventes
                <select
                  className={selectClass}
                  value={filters.sort}
                  onChange={(event) => set("sort", event.target.value as TechFilters["sort"])}
                >
                  {Object.entries(techSortLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={fieldClass}>
                Date à contrôler
                <select
                  className={selectClass}
                  value={filters.dateBasis}
                  onChange={(event) =>
                    set("dateBasis", event.target.value as TechFilters["dateBasis"])
                  }
                >
                  <option value="end">Fin d’abonnement</option>
                  <option value="start">Début d’abonnement</option>
                  <option value="created">Création de la vente</option>
                </select>
              </label>
              <label className={fieldClass}>
                Du (inclus)
                <Input
                  type="date"
                  value={filters.from}
                  onChange={(event) => set("from", event.target.value)}
                />
              </label>
              <label className={fieldClass}>
                Au (inclus)
                <Input
                  type="date"
                  value={filters.to}
                  onChange={(event) => set("to", event.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Échéances :</span>
              {techDatePresets(today).map((range) => (
                <Button
                  key={range.label}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onChange({ ...filters, dateBasis: "end", from: range.from, to: range.to })
                  }
                >
                  {range.label}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onChange({ ...emptyTechFilters })}
              >
                Tout réinitialiser
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              L’état se choisit dans les cartes Tous / Actifs / Expire sous 3 jours / Inactifs en
              haut. Les filtres s’appliquent immédiatement.
            </p>
          </div>
        </details>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={chip.reset}
            aria-label={`Retirer le filtre ${chip.label}`}
            className="inline-flex max-w-full items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-indigo-800"
          >
            <span className="truncate">{chip.label}</span>
            <X className="h-3 w-3 shrink-0" />
          </button>
        ))}
        <span className="text-slate-500">Tri : {techSortLabels[filters.sort]}</span>
        {(chips.length > 0 || filters.query || filters.state || filters.sort !== "recent") && (
          <button
            type="button"
            className="px-1 py-1 font-semibold text-indigo-700"
            onClick={() => onChange({ ...emptyTechFilters })}
          >
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}
