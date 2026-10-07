import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ExternalLink,
  FileText,
  LoaderCircle,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CV } from "@/lib/cv-types";
import {
  emptyOpportunityPlan,
  inferCandidateCountry,
  searchProfileOpportunities,
  type CandidateCountry,
  type OpportunityMatch,
  type OpportunityPlan,
} from "@/lib/profile-opportunities";

type Filter = "all" | "job" | "volunteer" | "program" | "selected";

function CountryFlag({ code }: { code: string }) {
  const normalized = code.toUpperCase();
  if (normalized === "CA") {
    return (
      <svg viewBox="0 0 36 24" className="h-5 w-7 rounded-[3px] shadow-sm" aria-label="Canada">
        <rect width="36" height="24" fill="#fff" />
        <rect width="8" height="24" fill="#d80621" />
        <rect x="28" width="8" height="24" fill="#d80621" />
        <path
          d="M18 4l1.2 3 2.3-1.1-.8 2.7 2.4.5-3.2 2.8.8 2.5-2.1-.5-.6 5.1-.6-5.1-2.1.5.8-2.5-3.2-2.8 2.4-.5-.8-2.7L16.8 7 18 4z"
          fill="#d80621"
        />
      </svg>
    );
  }
  if (normalized === "TN") {
    return (
      <svg viewBox="0 0 36 24" className="h-5 w-7 rounded-[3px] shadow-sm" aria-label="Tunisie">
        <rect width="36" height="24" fill="#e70013" />
        <circle cx="18" cy="12" r="7" fill="#fff" />
        <circle cx="19" cy="12" r="4.4" fill="#e70013" />
        <circle cx="20.4" cy="12" r="3.5" fill="#fff" />
        <path
          d="M19.1 8.9l.7 2.1h2.2l-1.8 1.3.7 2.1-1.8-1.3-1.8 1.3.7-2.1-1.8-1.3h2.2z"
          fill="#e70013"
        />
      </svg>
    );
  }
  if (normalized === "DZ") {
    return (
      <svg viewBox="0 0 36 24" className="h-5 w-7 rounded-[3px] shadow-sm" aria-label="Algérie">
        <rect width="18" height="24" fill="#067a46" />
        <rect x="18" width="18" height="24" fill="#fff" />
        <circle cx="18" cy="12" r="6" fill="#d21034" />
        <circle cx="19.5" cy="12" r="5" fill="#fff" />
        <path
          d="M19 8.5l.8 2.2h2.3l-1.9 1.4.7 2.2-1.9-1.4-1.9 1.4.7-2.2-1.9-1.4h2.4z"
          fill="#d21034"
        />
      </svg>
    );
  }
  const verticalFlags: Record<string, [string, string, string]> = {
    IT: ["#009246", "#ffffff", "#ce2b37"],
    FR: ["#0055a4", "#ffffff", "#ef4135"],
    BE: ["#111111", "#ffd90c", "#ef3340"],
  };
  if (verticalFlags[normalized]) {
    const [left, center, right] = verticalFlags[normalized];
    return (
      <svg viewBox="0 0 36 24" className="h-5 w-7 rounded-[3px] shadow-sm" aria-label={normalized}>
        <rect width="12" height="24" fill={left} />
        <rect x="12" width="12" height="24" fill={center} />
        <rect x="24" width="12" height="24" fill={right} />
      </svg>
    );
  }
  if (normalized === "DE") {
    return (
      <svg viewBox="0 0 36 24" className="h-5 w-7 rounded-[3px] shadow-sm" aria-label="DE">
        <rect width="36" height="8" fill="#000" />
        <rect y="8" width="36" height="8" fill="#dd0000" />
        <rect y="16" width="36" height="8" fill="#ffce00" />
      </svg>
    );
  }
  if (normalized === "EU") {
    return (
      <svg viewBox="0 0 36 24" className="h-5 w-7 rounded-[3px] shadow-sm" aria-label="Europe">
        <rect width="36" height="24" fill="#003399" />
        <circle
          cx="18"
          cy="12"
          r="5"
          fill="none"
          stroke="#ffcc00"
          strokeWidth="2"
          strokeDasharray="1.2 1.4"
        />
      </svg>
    );
  }
  return (
    <span className="grid h-5 w-7 place-items-center rounded bg-slate-100 text-[9px] font-black text-slate-600">
      {normalized || "INT"}
    </span>
  );
}

function deadlineLabel(value: string | null) {
  if (!value) return "Non publiée";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fr-FR");
}

export function ProfileOpportunitiesWorkspace({
  open,
  cv,
  plan,
  onPlanChange,
  onClose,
}: {
  open: boolean;
  cv: CV;
  plan?: OpportunityPlan;
  onPlanChange: (plan: OpportunityPlan) => void;
  onClose: () => void;
}) {
  const [candidateCountry, setCandidateCountry] = useState<CandidateCountry>(
    plan?.candidateCountry || inferCandidateCountry(cv),
  );
  const [matches, setMatches] = useState<OpportunityMatch[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [searchedAt, setSearchedAt] = useState("");

  const selected = useMemo(() => plan?.selectedOpportunities || [], [plan?.selectedOpportunities]);
  const selectedIds = useMemo(() => new Set(selected.map((item) => item.id)), [selected]);

  const runSearch = async () => {
    const controller = new AbortController();
    setLoading(true);
    setWarnings([]);
    try {
      const result = await searchProfileOpportunities({
        cv,
        candidateCountry,
        signal: controller.signal,
      });
      setMatches(result.matches);
      setWarnings(result.warnings);
      setSearchedAt(result.searchedAt);
      onPlanChange({
        ...(plan || emptyOpportunityPlan(cv, candidateCountry)),
        generatedAt: result.searchedAt,
        candidateCountry,
        targetJob: cv.titre_poste.trim(),
        noc: cv.cnp ? { code: cv.cnp.code, title: cv.cnp.title, teer: cv.cnp.teer } : undefined,
        selectedOpportunities: selected,
      });
    } catch (error) {
      setWarnings([error instanceof Error ? error.message : "Recherche indisponible."]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || matches.length || loading) return;
    void runSearch();
    // Initial search only; later updates are explicit through the Refresh button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const loweredQuery = query.trim().toLocaleLowerCase("fr");
  const displayed = (filter === "selected" ? selected : matches).filter((item) => {
    if (filter !== "all" && filter !== "selected" && item.kind !== filter) return false;
    if (!loweredQuery) return true;
    return `${item.title} ${item.employer} ${item.location} ${item.countryName}`
      .toLocaleLowerCase("fr")
      .includes(loweredQuery);
  });

  const toggleSelected = (item: OpportunityMatch) => {
    const next = selectedIds.has(item.id)
      ? selected.filter((selectedItem) => selectedItem.id !== item.id)
      : [...selected, item];
    onPlanChange({
      ...(plan || emptyOpportunityPlan(cv, candidateCountry)),
      generatedAt: searchedAt || new Date().toISOString(),
      candidateCountry,
      targetJob: cv.titre_poste.trim(),
      noc: cv.cnp ? { code: cv.cnp.code, title: cv.cnp.title, teer: cv.cnp.teer } : undefined,
      selectedOpportunities: next,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-slate-50"
      role="dialog"
      aria-modal="true"
      aria-label="Opportunités adaptées au profil"
    >
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-4 py-4 lg:px-8">
          <Button variant="outline" onClick={onClose} className="shrink-0">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour au CV
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-700">
                <BriefcaseBusiness className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-black text-slate-950 sm:text-2xl">
                  Opportunités adaptées au profil
                </h1>
                <p className="text-sm text-slate-600">
                  {cv.nom_complet || "Profil en cours"} · {cv.titre_poste || "Métier à renseigner"}
                  {cv.cnp?.code ? ` · CNP ${cv.cnp.code}` : ""}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
            <Check className="mr-1.5 inline h-4 w-4" /> {selected.length} sélectionnée(s) pour le
            PDF
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 lg:px-8">
        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[200px_1fr_auto]">
          <label className="text-xs font-black uppercase tracking-wide text-slate-600">
            Pays du candidat
            <select
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900"
              value={candidateCountry}
              onChange={(event) => setCandidateCountry(event.target.value as CandidateCountry)}
            >
              <option value="DZ">Algérie</option>
              <option value="TN">Tunisie</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-wide text-slate-600">
            Filtrer les résultats
            <div className="relative mt-1">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Métier, employeur, pays…"
                className="h-11 pl-9"
              />
            </div>
          </label>
          <Button
            onClick={() => void runSearch()}
            disabled={loading || !cv.titre_poste.trim()}
            className="self-end bg-red-700 hover:bg-red-800"
          >
            {loading ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Actualiser
          </Button>
        </section>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Toutes", matches.length],
              ["job", "Emplois", matches.filter((item) => item.kind === "job").length],
              [
                "volunteer",
                "Volontariat",
                matches.filter((item) => item.kind === "volunteer").length,
              ],
              [
                "program",
                "Programmes officiels",
                matches.filter((item) => item.kind === "program").length,
              ],
              ["selected", "Sélection PDF", selected.length],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition ${filter === id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"}`}
            >
              {label} <span className="ml-1 opacity-70">{count}</span>
            </button>
          ))}
        </div>

        {warnings.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {warnings.join(" ")} Les autres sources restent affichées.
          </div>
        ) : null}

        {loading ? (
          <div className="grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600">
            <div className="text-center">
              <LoaderCircle className="mx-auto mb-3 h-8 w-8 animate-spin text-red-700" />
              <p className="font-bold">Vérification des sources et classement du profil…</p>
            </div>
          </div>
        ) : displayed.length ? (
          <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {displayed.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const applicationUrl = item.application.email
                ? `mailto:${item.application.email}`
                : item.application.url;
              return (
                <article
                  key={item.id}
                  className={`rounded-2xl border bg-white p-4 shadow-sm transition ${isSelected ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <CountryFlag code={item.countryCode} />
                      <span className="truncate text-xs font-black uppercase tracking-wide text-slate-500">
                        {item.countryName} · {item.source}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-black ${item.status === "strong" ? "bg-emerald-100 text-emerald-800" : item.status === "partial" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}
                    >
                      {item.score}%
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-black leading-tight text-slate-950">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-red-800">{item.employer}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.location}</p>
                  <div className="mt-3 flex items-center gap-2 text-sm font-black text-red-700">
                    <CalendarClock className="h-4 w-4" /> Dernier délai :{" "}
                    {deadlineLabel(item.deadlineAt)}
                  </div>
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-700">
                    {item.reasons.slice(0, 2).map((reason) => (
                      <p key={reason} className="flex gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        {reason}
                      </p>
                    ))}
                    {item.conditions.slice(0, 2).map((condition) => (
                      <p key={condition} className="line-clamp-2">
                        • {condition}
                      </p>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {applicationUrl ? (
                      <Button asChild size="sm" className="bg-red-700 hover:bg-red-800">
                        <a
                          href={applicationUrl}
                          target={applicationUrl.startsWith("mailto:") ? undefined : "_blank"}
                          rel="noreferrer"
                        >
                          {applicationUrl.startsWith("mailto:") ? (
                            <Mail className="mr-1.5 h-4 w-4" />
                          ) : (
                            <ExternalLink className="mr-1.5 h-4 w-4" />
                          )}
                          {item.application.label}
                        </a>
                      </Button>
                    ) : null}
                    {item.sourceUrl ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                          <FileText className="mr-1.5 h-4 w-4" />
                          Source
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => toggleSelected(item)}
                      className={isSelected ? "bg-emerald-700 hover:bg-emerald-800" : ""}
                    >
                      <Check className="mr-1.5 h-4 w-4" />
                      {isSelected ? "Ajoutée au PDF" : "Ajouter au PDF"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            <div>
              <BriefcaseBusiness className="mx-auto mb-3 h-9 w-9 text-slate-400" />
              <p className="font-black text-slate-900">Aucune opportunité dans cette vue</p>
              <p className="mt-1 text-sm">Actualisez les sources ou changez le filtre.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
