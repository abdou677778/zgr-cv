import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Landmark,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
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
  indeedCanadaSearchUrl,
  searchCanadaOpportunities,
  type CanadaOpportunity,
  type CanadaOpportunitySearchResult,
} from "@/lib/canada-opportunities";

type Provider = "jobbank" | "indeed";

function formatDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function lmiaLabel(value: CanadaOpportunity["lmiaStatus"]) {
  if (value === "approved") return "EIMT/LMIA approuvée";
  if (value === "requested") return "EIMT/LMIA demandée";
  return "EIMT/LMIA non précisée";
}

function CanadaOpportunityCard({ opportunity }: { opportunity: CanadaOpportunity }) {
  const noAccount = !opportunity.applicationMethod.loginRequired;
  const [copied, setCopied] = useState(false);
  const contact = opportunity.applicationContact;
  const copyEmail = async () => {
    if (!contact?.email) return;
    try {
      await navigator.clipboard.writeText(contact.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
          <BadgeCheck className="h-3.5 w-3.5" /> Candidat international vérifié
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            noAccount ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-900"
          }`}
        >
          {noAccount ? "Sans compte Indeed" : "Compte requis"}
        </span>
      </div>

      <h3 className="text-base font-black leading-snug text-slate-950">{opportunity.title}</h3>
      <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-red-800">
        <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{opportunity.employer || "Employeur non indiqué"}</span>
      </p>

      <div className="mt-3 space-y-1.5 text-sm text-slate-600">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
          <span>{opportunity.location || "Lieu non indiqué"}</span>
        </p>
        {opportunity.salary ? (
          <p className="flex items-start gap-2">
            <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
            <span>{opportunity.salary}</span>
          </p>
        ) : null}
        <p className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
          <span>Publiée le {formatDate(opportunity.postedAt, "date non indiquée")}</span>
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-red-900">
        <p className="flex items-start gap-2 text-sm font-black">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Dernier délai : {formatDate(opportunity.deadlineAt, "non publié par l’employeur")}
          </span>
        </p>
      </div>

      <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-950">
        <p className="flex items-start gap-2 text-sm font-bold">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{opportunity.eligibilityEvidence}</span>
        </p>
        <p className="mt-1 text-xs font-semibold text-emerald-800">
          {lmiaLabel(opportunity.lmiaStatus)}
        </p>
      </div>

      <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sky-950">
        <p className="flex items-start gap-2 text-sm font-bold">
          {opportunity.applicationMethod.loginRequired ? (
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{opportunity.applicationMethod.label}</span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-sky-800">
          {opportunity.applicationMethod.note}
        </p>
      </div>

      {contact?.email ? (
        <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-violet-950">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-violet-700">
            <Mail className="h-4 w-4" /> E-mail officiel pour postuler
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <a
              href={`mailto:${contact.email}`}
              className="min-w-0 flex-1 break-all text-sm font-bold text-violet-950 underline decoration-violet-300 underline-offset-2"
            >
              {contact.email}
            </a>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-violet-300 bg-white text-violet-900"
              onClick={() => void copyEmail()}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> {copied ? "Copié" : "Copier"}
            </Button>
          </div>
        </div>
      ) : contact?.type === "external_form" && contact.url ? (
        <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-violet-950">
          <p className="flex items-center gap-2 text-sm font-black">
            <ExternalLink className="h-4 w-4" /> Formulaire officiel pour postuler
          </p>
          <a
            href={contact.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all text-xs font-semibold text-violet-800 underline underline-offset-2"
          >
            {contact.url}
          </a>
        </div>
      ) : contact?.phone ? (
        <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-violet-950">
          <p className="flex items-center gap-2 text-sm font-black">
            <Phone className="h-4 w-4" /> Téléphone de candidature : {contact.phone}
          </p>
        </div>
      ) : contact?.type === "mail" || contact?.type === "in_person" ? (
        <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-violet-950">
          <p className="text-sm font-black">{contact.label}</p>
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-violet-800">
            {contact.details}
          </p>
        </div>
      ) : (
        <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          Coordonnées directes non publiées : utilisez le bouton officiel ci-dessous pour suivre la
          méthode choisie par l’employeur.
        </p>
      )}

      {opportunity.applicationOptions?.length > 1 ? (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
            Autres méthodes officielles disponibles
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {opportunity.applicationOptions
              .filter(
                (option) =>
                  option.type !== contact?.type ||
                  option.url !== contact?.url ||
                  option.email !== contact?.email,
              )
              .map((option) => (
                <a
                  key={`${option.type}-${option.url}-${option.email}`}
                  href={option.url}
                  target={option.url.startsWith("http") ? "_blank" : undefined}
                  rel={option.url.startsWith("http") ? "noreferrer" : undefined}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-violet-300 hover:text-violet-800"
                  title={option.details}
                >
                  {option.label}
                  {option.loginRequired ? " · connexion requise" : ""}
                </a>
              ))}
          </div>
        </div>
      ) : null}

      {opportunity.description ? (
        <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-slate-600">
          {opportunity.description}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
        <Button asChild size="sm" variant="outline">
          <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer">
            Vérifier la fiche <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
        <Button asChild size="sm" className="bg-red-700 text-white hover:bg-red-800">
          <a href={opportunity.applicationMethod.url} target="_blank" rel="noreferrer">
            {opportunity.applicationMethod.type === "email"
              ? "Écrire à l’employeur"
              : opportunity.applicationMethod.type === "company_site" ||
                  opportunity.applicationMethod.type === "external_form"
                ? "Postuler sur le site officiel"
                : "Voir comment postuler"}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </article>
  );
}

export function CanadaOpportunitiesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [provider, setProvider] = useState<Provider>("jobbank");
  const [country, setCountry] = useState<"DZ" | "TN">("DZ");
  const [period, setPeriod] = useState<"week" | "recent">("week");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<CanadaOpportunitySearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      setResult(
        await searchCanadaOpportunities({
          country,
          period,
          query,
          limit: 18,
          signal: controller.signal,
        }),
      );
    } catch (failure) {
      if ((failure as Error).name !== "AbortError")
        setError(failure instanceof Error ? failure.message : "Recherche indisponible.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [country, period, query]);

  useEffect(() => {
    if (open && provider === "jobbank") void runSearch();
    return () => requestRef.current?.abort();
  }, [open, country, period, provider, runSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-[min(1500px,96vw)] flex-col overflow-hidden border-red-200 bg-slate-50 p-0">
        <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5 pr-14">
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-950">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-100 text-red-800">
              <BriefcaseBusiness className="h-5 w-5" />
            </span>
            Opportunités Canada
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Offres récentes, admissibilité internationale contrôlée et parcours de candidature
            clair.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 border-b border-slate-200 bg-white px-5 py-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setProvider("jobbank")}
            className={`rounded-2xl border p-4 text-left transition ${
              provider === "jobbank"
                ? "border-red-400 bg-red-50 ring-2 ring-red-100"
                : "border-slate-200 bg-white hover:border-red-200"
            }`}
          >
            <span className="flex items-center gap-2 font-black text-slate-950">
              <Landmark className="h-5 w-5 text-red-700" /> Guichet-Emplois Canada
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800">
                Recommandé
              </span>
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-600">
              Cartes automatiques issues de la source gouvernementale, vérifiées fiche par fiche.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setProvider("indeed")}
            className={`rounded-2xl border p-4 text-left transition ${
              provider === "indeed"
                ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100"
                : "border-slate-200 bg-white hover:border-blue-200"
            }`}
          >
            <span className="flex items-center gap-2 font-black text-slate-950">
              <Search className="h-5 w-5 text-blue-700" /> Indeed Canada
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase text-blue-800">
                Recherche directe
              </span>
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-600">
              Ouvre les offres les plus récentes sur Indeed sans recopier ni aspirer leurs données.
            </span>
          </button>
        </div>

        {provider === "indeed" ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-blue-700" />
                <div>
                  <h3 className="font-black text-slate-950">
                    Recherche Indeed conforme et durable
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Indeed interdit le scraping automatisé sans autorisation écrite. Le bouton ouvre
                    donc la recherche officielle triée par date. Une présence dans cette recherche
                    ne prouve pas à elle seule que l’employeur recrute hors du Canada.
                  </p>
                </div>
              </div>
              <label className="block space-y-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                Métier ou mots-clés
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ex. développeur React, comptable, cuisinier"
                  className="normal-case tracking-normal"
                />
              </label>
              <Button asChild className="w-full bg-blue-700 text-white hover:bg-blue-800">
                <a href={indeedCanadaSearchUrl(query)} target="_blank" rel="noreferrer">
                  Ouvrir Indeed — offres les plus récentes
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <strong className="block text-slate-900">Site employeur</strong>
                  <span className="text-xs text-slate-600">Souvent sans compte Indeed.</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <strong className="block text-slate-900">Indeed Apply</strong>
                  <span className="text-xs text-slate-600">Connexion généralement demandée.</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <strong className="block text-slate-900">Date limite</strong>
                  <span className="text-xs text-slate-600">
                    Ne pas l’inventer si elle est absente.
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Vérifiez dans l’offre : « international candidates », parrainage, EIMT/LMIA ou «
                with or without a valid Canadian work permit ». Écartez toute offre exigeant déjà le
                droit de travailler au Canada sans parrainage.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 border-b border-slate-200 bg-white px-5 py-4 lg:grid-cols-[180px_230px_minmax(260px,1fr)_auto]">
              <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                Pays du candidat
                <select
                  value={country}
                  onChange={(event) => setCountry(event.target.value as "DZ" | "TN")}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                >
                  <option value="DZ">Algérie</option>
                  <option value="TN">Tunisie</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                Période
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value as "week" | "recent")}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                >
                  <option value="week">Publiées ces 7 derniers jours</option>
                  <option value="recent">Offres récentes encore ouvertes</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                Filtrer les cartes chargées
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void runSearch();
                    }}
                    className="pl-9 normal-case tracking-normal"
                    placeholder="Titre, entreprise, ville…"
                  />
                </div>
              </label>
              <Button
                className="self-end bg-red-700 hover:bg-red-800"
                onClick={() => void runSearch()}
              >
                {loading ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Actualiser
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {error ? (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
              ) : null}
              {result ? (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                  <p className="font-semibold text-emerald-950">
                    <BadgeCheck className="mr-1.5 inline h-4 w-4" />
                    {result.meta.totalMatches} offre(s) ouverte(s) aux candidats internationaux
                  </p>
                  <p className="text-xs text-emerald-800">
                    Vérifiées le {new Date(result.meta.verifiedAt).toLocaleString("fr-FR")}
                    {result.meta.stale ? " · cache de secours" : ""}
                  </p>
                </div>
              ) : null}
              {loading && !result ? (
                <div className="grid min-h-64 place-items-center text-sm font-medium text-slate-500">
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="h-5 w-5 animate-spin text-red-700" /> Vérification des
                    fiches officielles…
                  </span>
                </div>
              ) : result?.opportunities.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {result.opportunities.map((opportunity) => (
                    <CanadaOpportunityCard key={opportunity.id} opportunity={opportunity} />
                  ))}
                </div>
              ) : !loading ? (
                <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <div>
                    <BriefcaseBusiness className="mx-auto mb-3 h-9 w-9 text-slate-400" />
                    <p className="font-bold text-slate-800">Aucune offre dans cette sélection.</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Essayez « offres récentes » ou retirez le filtre texte.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
              <span>
                Source : Guichet-Emplois du gouvernement du Canada · candidature humaine uniquement.
              </span>
              <a
                href={
                  result?.sources.jobBank.url ||
                  "https://www.jobbank.gc.ca/findajob/foreign-candidates"
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-red-800 hover:underline"
              >
                Ouvrir la source officielle <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
