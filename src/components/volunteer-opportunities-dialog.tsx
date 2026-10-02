import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Globe2,
  HeartHandshake,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  inspectVolunteerOpportunity,
  searchVolunteerOpportunities,
  type VolunteerOpportunity,
  type VolunteerSearchResult,
} from "@/lib/volunteer-opportunities";

const COUNTRIES = [
  { code: "TN", label: "Tunisie" },
  { code: "DZ", label: "Algérie" },
  { code: "MA", label: "Maroc" },
  { code: "LY", label: "Libye" },
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgique" },
  { code: "IT", label: "Italie" },
  { code: "ES", label: "Espagne" },
];

const ACTIVITY_LABELS: Record<string, string> = {
  individual: "Volontariat individuel",
  teams: "Équipe de volontaires",
};

function formatDate(value: string | null, fallback = "Non indiquée") {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function OpportunityCard({ opportunity }: { opportunity: VolunteerOpportunity }) {
  const location = [opportunity.destination.town, opportunity.destination.countryName]
    .filter(Boolean)
    .join(", ");
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" /> {opportunity.eligibleCountry.name} admissible
        </span>
        {opportunity.activityType && (
          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
            {ACTIVITY_LABELS[opportunity.activityType] || opportunity.activityType}
          </span>
        )}
      </div>
      <h3 className="text-base font-black leading-snug text-slate-950">{opportunity.title}</h3>
      {opportunity.organization && (
        <p className="mt-1 text-sm font-semibold text-cyan-800">{opportunity.organization}</p>
      )}
      <div className="mt-3 space-y-1.5 text-sm text-slate-600">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
          <span>{location || "Destination non indiquée"}</span>
        </p>
        <p className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
          <span>
            Du {formatDate(opportunity.startAt)} au {formatDate(opportunity.endAt)}
          </span>
        </p>
        <p className="flex items-start gap-2 font-medium text-slate-800">
          <span className="w-4 shrink-0 text-center text-amber-600">⏱</span>
          <span>Candidature avant le {formatDate(opportunity.deadlineAt, "sans échéance")}</span>
        </p>
      </div>
      {opportunity.description && (
        <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-slate-600">
          {opportunity.description}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <span className="text-[11px] text-slate-500">ID {opportunity.id}</span>
        <Button asChild size="sm" className="bg-cyan-700 text-white hover:bg-cyan-800">
          <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer">
            Voir l’offre officielle <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </article>
  );
}

export function VolunteerOpportunitiesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [country, setCountry] = useState("TN");
  const [period, setPeriod] = useState<"week" | "recent">("week");
  const [query, setQuery] = useState("");
  const [linkToInspect, setLinkToInspect] = useState("");
  const [result, setResult] = useState<VolunteerSearchResult | null>(null);
  const [inspected, setInspected] = useState<VolunteerOpportunity | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const searchAbort = useRef<AbortController | null>(null);

  const runSearch = useCallback(async () => {
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    setLoading(true);
    setError("");
    try {
      const next = await searchVolunteerOpportunities({
        country,
        period,
        query,
        limit: 30,
        signal: controller.signal,
      });
      setResult(next);
      setInspected(null);
    } catch (failure) {
      if ((failure as Error).name !== "AbortError")
        setError(failure instanceof Error ? failure.message : "Recherche indisponible.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [country, period, query]);

  useEffect(() => {
    if (open) void runSearch();
    return () => searchAbort.current?.abort();
  }, [open, country, period, runSearch]);

  const inspectLink = async () => {
    if (!linkToInspect.trim()) return;
    setChecking(true);
    setError("");
    try {
      const next = await inspectVolunteerOpportunity({ urlOrId: linkToInspect, country });
      setInspected(next.opportunity);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Vérification impossible.");
    } finally {
      setChecking(false);
    }
  };

  const shown = useMemo(
    () => (inspected ? [inspected] : result?.opportunities || []),
    [inspected, result],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-[min(1500px,96vw)] flex-col overflow-hidden border-cyan-200 bg-slate-50 p-0">
        <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5 pr-14">
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-950">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-100 text-cyan-800">
              <HeartHandshake className="h-5 w-5" />
            </span>
            Opportunités de volontariat
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Recherche officielle et contrôle exact du pays dans « Looking for participants from ».
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 border-b border-slate-200 bg-white px-5 py-4 lg:grid-cols-[180px_220px_minmax(260px,1fr)_auto]">
          <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-slate-600">
            Pays du participant
            <select
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            >
              {COUNTRIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-slate-600">
            Période
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as "week" | "recent")}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            >
              <option value="week">Publiées ces 7 derniers jours</option>
              <option value="recent">Opportunités récentes actives</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-slate-600">
            Mots-clés
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void runSearch();
                }}
                className="pl-9 normal-case tracking-normal"
                placeholder="Titre, organisme, destination…"
              />
            </div>
          </label>
          <Button
            className="self-end bg-cyan-700 hover:bg-cyan-800"
            onClick={() => void runSearch()}
          >
            {loading ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Rechercher
          </Button>
        </div>

        <div className="border-b border-slate-200 bg-cyan-50/60 px-5 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex flex-1 items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-800" />
              <Input
                value={linkToInspect}
                onChange={(event) => setLinkToInspect(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void inspectLink();
                }}
                placeholder="Coller un lien officiel ou un ID pour vérifier son admissibilité"
                className="bg-white"
              />
              <Button variant="outline" onClick={() => void inspectLink()} disabled={checking}>
                {checking ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                Vérifier
              </Button>
            </div>
            {inspected ? (
              <Button variant="ghost" size="sm" onClick={() => setInspected(null)}>
                Revenir aux résultats
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error ? (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}
          {result && !inspected ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
              <p className="font-semibold text-emerald-900">
                <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
                {result.meta.totalMatches} opportunité(s) vérifiée(s) pour{" "}
                {result.meta.participantCountry.name}
              </p>
              <p className="text-xs text-emerald-800">
                Source actualisée le {new Date(result.meta.verifiedAt).toLocaleString("fr-FR")}
                {result.meta.stale ? " · cache de secours" : ""}
              </p>
            </div>
          ) : null}
          {loading && !result ? (
            <div className="grid min-h-64 place-items-center text-sm font-medium text-slate-500">
              <span className="flex items-center gap-2">
                <LoaderCircle className="h-5 w-5 animate-spin text-cyan-700" /> Lecture du portail
                officiel…
              </span>
            </div>
          ) : shown.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((opportunity) => (
                <OpportunityCard key={opportunity.id} opportunity={opportunity} />
              ))}
            </div>
          ) : !loading ? (
            <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <div>
                <Globe2 className="mx-auto mb-3 h-9 w-9 text-slate-400" />
                <p className="font-bold text-slate-800">
                  Aucune offre vérifiée dans cette sélection.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Essayez « opportunités récentes actives » ou retirez les mots-clés.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
          <span>Les résultats proviennent directement du Portail européen de la jeunesse.</span>
          <a
            href="https://youth.europa.eu/go-abroad/volunteering/opportunities_en"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-cyan-800 hover:underline"
          >
            Ouvrir la source officielle <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
