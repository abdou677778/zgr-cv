import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CalendarClock,
  CircleDollarSign,
  Copy,
  ExternalLink,
  FileText,
  Globe2,
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
  UserRoundCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  indeedCanadaSearchUrl,
  searchCanadaOpportunities,
  type CanadaOpportunity,
  type CanadaOpportunitySearchResult,
} from "@/lib/canada-opportunities";
import {
  searchAnetiOpportunities,
  type AnetiOpportunity,
  type AnetiOpportunitySearchResult,
} from "@/lib/aneti-opportunities";
import {
  searchAtctOpportunities,
  type AtctOpportunity,
  type AtctOpportunitySearchResult,
} from "@/lib/atct-opportunities";

type Provider = "jobbank" | "indeed" | "destination_canada" | "aneti" | "atct";

const DESTINATION_CANADA_CANDIDATES_URL =
  "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/travailler-canada/embaucher-etranger-temporaires/travailleurs-francophones-bilingues-exterieur-quebec/destination-canada/candidats.html";
const DESTINATION_CANADA_EVENTS_URL =
  "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/travailler-canada/embaucher-etranger-temporaires/travailleurs-francophones-bilingues-exterieur-quebec/destination-canada/a-propos.html";

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

function AnetiOpportunityCard({ opportunity }: { opportunity: AnetiOpportunity }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-sky-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
            opportunity.staleDetail ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-800"
          }`}
        >
          <BadgeCheck className="h-3.5 w-3.5" />
          {opportunity.staleDetail
            ? "Dernière fiche ANETI vérifiée (cache)"
            : "Source publique ANETI vérifiée"}
        </span>
        {opportunity.dataQuality?.status === "partial" ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
            Données partielles
          </span>
        ) : null}
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            opportunity.applicationMethod.loginRequired
              ? "bg-amber-100 text-amber-900"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {opportunity.applicationMethod.loginRequired
            ? "Inscription ANETI requise"
            : "Accès direct"}
        </span>
      </div>

      <h3 className="text-base font-black leading-snug text-slate-950">{opportunity.title}</h3>
      <div className="mt-3 space-y-1.5 text-sm text-slate-600">
        <p className="flex items-start gap-2">
          <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
          <span>{opportunity.country || "Pays non indiqué"}</span>
        </p>
        <p className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
          <span>Publiée le {formatDate(opportunity.postedAt, "date non indiquée")}</span>
        </p>
        {opportunity.cvLanguage ? (
          <p className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
            <span>Langue du CV : {opportunity.cvLanguage}</span>
          </p>
        ) : null}
      </div>

      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-red-900">
        <p className="flex items-start gap-2 text-sm font-black">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Dernier délai : {formatDate(opportunity.deadlineAt, "non publié par ANETI")}</span>
        </p>
      </div>

      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-950">
        <p className="flex items-start gap-2 text-sm font-black">
          <UserRoundCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{opportunity.applicationMethod.label}</span>
        </p>
        {opportunity.registrationRequirements.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-amber-900">
            {opportunity.registrationRequirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-amber-900">{opportunity.applicationMethod.note}</p>
        )}
      </div>

      {opportunity.speciality ? (
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-sky-800">
          {opportunity.speciality}
        </p>
      ) : null}
      {opportunity.description ? (
        <p className="mt-2 line-clamp-5 whitespace-pre-line text-sm leading-relaxed text-slate-600">
          {opportunity.description}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
        <Button asChild size="sm" variant="outline">
          <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer">
            Vérifier la fiche <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
        <Button asChild size="sm" className="bg-sky-700 text-white hover:bg-sky-800">
          <a href={opportunity.applicationMethod.url} target="_blank" rel="noreferrer">
            {opportunity.applicationMethod.type === "external_form"
              ? "Ouvrir le formulaire officiel"
              : opportunity.applicationMethod.type === "email"
                ? "Écrire pour postuler"
                : "Voir comment postuler"}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </article>
  );
}

function AtctOpportunityCard({ opportunity }: { opportunity: AtctOpportunity }) {
  const actionLabel =
    opportunity.applicationMethod.type === "email"
      ? "Écrire pour postuler"
      : opportunity.applicationMethod.type === "external_form"
        ? "Ouvrir le formulaire officiel"
        : opportunity.applicationMethod.type === "atct_portal"
          ? "Ouvrir l’espace candidat"
          : "Voir comment postuler";
  return (
    <article className="flex h-full flex-col rounded-2xl border border-teal-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
            opportunity.staleDetail ? "bg-amber-100 text-amber-900" : "bg-teal-100 text-teal-900"
          }`}
        >
          <BadgeCheck className="h-3.5 w-3.5" />
          {opportunity.staleDetail
            ? "Dernière fiche ATCT vérifiée (cache)"
            : "Source publique ATCT vérifiée"}
        </span>
        {opportunity.dataQuality?.status === "partial" ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
            Données partielles
          </span>
        ) : null}
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            opportunity.applicationMethod.loginRequired
              ? "bg-amber-100 text-amber-900"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {opportunity.applicationMethod.loginRequired ? "Compte ATCT requis" : "Accès direct"}
        </span>
      </div>

      <h3 className="text-base font-black leading-snug text-slate-950">{opportunity.title}</h3>
      <div className="mt-3 space-y-1.5 text-sm text-slate-600">
        <p className="flex items-start gap-2">
          <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
          <span>{opportunity.country || "Pays non indiqué"}</span>
        </p>
        <p className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
          <span>Publiée le {formatDate(opportunity.postedAt, "date non indiquée")}</span>
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-red-900">
        <p className="flex items-start gap-2 text-sm font-black">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Dernier délai : {formatDate(opportunity.deadlineAt, "non publié par l’ATCT")}</span>
        </p>
      </div>

      {opportunity.positions.length ? (
        <div className="mt-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-teal-950">
          <p className="text-xs font-black uppercase tracking-wide text-teal-800">
            Poste{opportunity.positions.length > 1 ? "s" : ""} à pourvoir
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs leading-relaxed">
            {opportunity.positions.slice(0, 5).map((position) => (
              <li key={position}>{position}</li>
            ))}
          </ul>
          {opportunity.positions.length > 5 ? (
            <p className="mt-1 text-xs font-bold text-teal-800">
              + {opportunity.positions.length - 5} autre(s) poste(s)
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-950">
        <p className="flex items-start gap-2 text-sm font-black">
          <UserRoundCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{opportunity.applicationMethod.label}</span>
        </p>
        {opportunity.applicationMethod.email ? (
          <a
            href={`mailto:${opportunity.applicationMethod.email}`}
            className="mt-1.5 block break-all text-sm font-bold underline underline-offset-2"
          >
            {opportunity.applicationMethod.email}
          </a>
        ) : (
          <p className="mt-1 text-xs leading-relaxed">{opportunity.applicationMethod.note}</p>
        )}
      </div>

      {opportunity.requiredDocuments.length ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          <strong>Pièces indiquées :</strong> {opportunity.requiredDocuments.join(" · ")}
        </p>
      ) : null}
      {opportunity.requirements ? (
        <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">
          {opportunity.requirements}
        </p>
      ) : opportunity.description ? (
        <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">
          {opportunity.description}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
        <Button asChild size="sm" variant="outline">
          <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer">
            Vérifier la fiche <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
        <Button asChild size="sm" className="bg-teal-700 text-white hover:bg-teal-800">
          <a href={opportunity.applicationMethod.url} target="_blank" rel="noreferrer">
            {actionLabel} <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
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
  const [anetiResult, setAnetiResult] = useState<AnetiOpportunitySearchResult | null>(null);
  const [atctResult, setAtctResult] = useState<AtctOpportunitySearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [anetiLoading, setAnetiLoading] = useState(false);
  const [atctLoading, setAtctLoading] = useState(false);
  const [error, setError] = useState("");
  const [anetiError, setAnetiError] = useState("");
  const [atctError, setAtctError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const anetiRequestRef = useRef<AbortController | null>(null);
  const atctRequestRef = useRef<AbortController | null>(null);

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

  const runAnetiSearch = useCallback(async () => {
    anetiRequestRef.current?.abort();
    const controller = new AbortController();
    anetiRequestRef.current = controller;
    setAnetiLoading(true);
    setAnetiError("");
    try {
      setAnetiResult(
        await searchAnetiOpportunities({
          period,
          query,
          limit: 24,
          signal: controller.signal,
        }),
      );
    } catch (failure) {
      if ((failure as Error).name !== "AbortError")
        setAnetiError(failure instanceof Error ? failure.message : "Recherche ANETI indisponible.");
    } finally {
      if (!controller.signal.aborted) setAnetiLoading(false);
    }
  }, [period, query]);

  const runAtctSearch = useCallback(async () => {
    atctRequestRef.current?.abort();
    const controller = new AbortController();
    atctRequestRef.current = controller;
    setAtctLoading(true);
    setAtctError("");
    try {
      setAtctResult(
        await searchAtctOpportunities({
          period,
          query,
          limit: 24,
          signal: controller.signal,
        }),
      );
    } catch (failure) {
      if ((failure as Error).name !== "AbortError")
        setAtctError(failure instanceof Error ? failure.message : "Recherche ATCT indisponible.");
    } finally {
      if (!controller.signal.aborted) setAtctLoading(false);
    }
  }, [period, query]);

  useEffect(() => {
    if (open && provider === "jobbank") void runSearch();
    return () => requestRef.current?.abort();
  }, [open, country, period, provider, runSearch]);

  useEffect(() => {
    if (open && provider === "aneti") void runAnetiSearch();
    return () => anetiRequestRef.current?.abort();
  }, [open, period, provider, runAnetiSearch]);

  useEffect(() => {
    if (open && provider === "atct") void runAtctSearch();
    return () => atctRequestRef.current?.abort();
  }, [open, period, provider, runAtctSearch]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const returnHome = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", returnHome);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", returnHome);
    };
  }, [onOpenChange, open]);

  if (!open) return null;

  return (
    <main
      aria-labelledby="international-opportunities-title"
      className="fixed inset-0 z-[100] flex min-h-0 flex-col overflow-hidden bg-slate-50"
    >
      <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-8">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="w-fit shrink-0 border-slate-300 bg-white font-bold text-slate-800 hover:bg-slate-100"
            onClick={() => onOpenChange(false)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour à l’accueil
          </Button>
          <div className="min-w-0">
            <h1
              id="international-opportunities-title"
              className="flex items-center gap-2 text-xl font-black text-slate-950 sm:text-2xl"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-800">
                <BriefcaseBusiness className="h-5 w-5" />
              </span>
              Opportunités internationales
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Canada, ANETI, ATCT, volontariat et événements officiels avec parcours de candidature
              vérifié.
            </p>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid gap-3 border-b border-slate-200 bg-white px-5 py-4 md:grid-cols-2 xl:grid-cols-5">
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
          <button
            type="button"
            onClick={() => setProvider("destination_canada")}
            className={`rounded-2xl border p-4 text-left transition ${
              provider === "destination_canada"
                ? "border-violet-400 bg-violet-50 ring-2 ring-violet-100"
                : "border-slate-200 bg-white hover:border-violet-200"
            }`}
          >
            <span className="flex items-center gap-2 font-black text-slate-950">
              <CalendarDays className="h-5 w-5 text-violet-700" /> Destination Canada
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black uppercase text-violet-800">
                Événement officiel
              </span>
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-600">
              Forum Mobilité, dates officielles et accès au formulaire candidat dès son ouverture.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setProvider("aneti")}
            className={`rounded-2xl border p-4 text-left transition ${
              provider === "aneti"
                ? "border-sky-400 bg-sky-50 ring-2 ring-sky-100"
                : "border-slate-200 bg-white hover:border-sky-200"
            }`}
          >
            <span className="flex items-center gap-2 font-black text-slate-950">
              <Globe2 className="h-5 w-5 text-sky-700" /> ANETI Tunisia
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black uppercase text-sky-800">
                Tunisie
              </span>
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-600">
              Offres publiques vérifiées avec formulaire, CIN, CV et inscription requise.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setProvider("atct")}
            className={`rounded-2xl border p-4 text-left transition ${
              provider === "atct"
                ? "border-teal-400 bg-teal-50 ring-2 ring-teal-100"
                : "border-slate-200 bg-white hover:border-teal-200"
            }`}
          >
            <span className="flex items-center gap-2 font-black text-slate-950">
              <Building2 className="h-5 w-5 text-teal-700" /> ATCT Tunisia
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-black uppercase text-teal-900">
                Officiel
              </span>
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-600">
              Recrutements internationaux officiels filtrés, avec délai et méthode de candidature.
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
        ) : provider === "destination_canada" ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mx-auto max-w-4xl space-y-5 rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-7 w-7 shrink-0 text-violet-700" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-violet-700">
                    Gouvernement du Canada · 22e édition
                  </p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">
                    Destination Canada Forum Mobilité 2026
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Événement gratuit destiné aux travailleurs qualifiés francophones ou bilingues.
                    Il permet de rencontrer des employeurs, des provinces, des territoires et des
                    organismes d’immigration francophone hors Québec.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <strong className="block text-slate-950">Bruxelles</strong>
                  <span className="mt-1 block text-sm text-slate-600">5 décembre 2026</span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <strong className="block text-slate-950">Marseille</strong>
                  <span className="mt-1 block text-sm text-slate-600">7 décembre 2026</span>
                </div>
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <strong className="block text-violet-950">Tunis</strong>
                  <span className="mt-1 block text-sm text-violet-800">10 et 11 décembre 2026</span>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-black">Inscription des candidats</p>
                <p className="mt-1 leading-relaxed">
                  La page officielle annonce une ouverture des inscriptions à l’automne. Le bouton
                  ci-dessous mène toujours vers la page gouvernementale à jour et vers le formulaire
                  officiel lorsqu’il sera publié. Les places sont limitées.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-violet-700 text-white hover:bg-violet-800">
                  <a href={DESTINATION_CANADA_CANDIDATES_URL} target="_blank" rel="noreferrer">
                    Vérifier l’inscription candidat <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={DESTINATION_CANADA_EVENTS_URL} target="_blank" rel="noreferrer">
                    Dates et informations officielles <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>

              <p className="text-xs leading-relaxed text-slate-500">
                ZGR n’invente aucun formulaire et ne collecte aucune inscription : la demande est
                toujours effectuée sur Canada.ca.
              </p>
            </div>
          </div>
        ) : provider === "aneti" ? (
          <>
            <div className="grid gap-3 border-b border-slate-200 bg-white px-5 py-4 lg:grid-cols-[230px_minmax(260px,1fr)_auto]">
              <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                Période
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value as "week" | "recent")}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="week">Publiées ces 7 derniers jours</option>
                  <option value="recent">Offres récentes encore ouvertes</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                Métier, pays ou spécialité
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void runAnetiSearch();
                    }}
                    className="pl-9 normal-case tracking-normal"
                    placeholder="Ex. aide-soignant, Italie, cuisine…"
                  />
                </div>
              </label>
              <Button
                className="self-end bg-sky-700 text-white hover:bg-sky-800"
                onClick={() => void runAnetiSearch()}
              >
                {anetiLoading ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Actualiser ANETI
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Les fiches publiques sont actualisées automatiquement. Aucun mot de passe ni cookie
                ANETI n’est conservé par ZGR ; la connexion reste personnelle au moment de postuler.
              </div>
              {anetiError ? (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {anetiError}
                </div>
              ) : null}
              {anetiResult ? (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                  <p className="font-semibold text-emerald-950">
                    <BadgeCheck className="mr-1.5 inline h-4 w-4" />
                    {anetiResult.meta.totalMatches} offre(s) ANETI vérifiée(s)
                  </p>
                  <p className="text-xs text-emerald-800">
                    Vérifiées le {new Date(anetiResult.meta.verifiedAt).toLocaleString("fr-FR")}
                    {anetiResult.meta.stale ? " · cache de secours" : ""}
                    {anetiResult.meta.detailFailures
                      ? ` · ${anetiResult.meta.detailFailures} fiche(s) conservée(s) du cache`
                      : ""}
                  </p>
                </div>
              ) : null}
              {anetiResult?.meta.staleReason ? (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  Actualisation directe indisponible : affichage temporaire du dernier cache
                  vérifié.
                </div>
              ) : null}
              {anetiLoading && !anetiResult ? (
                <div className="grid min-h-64 place-items-center text-sm font-medium text-slate-500">
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="h-5 w-5 animate-spin text-sky-700" /> Lecture des
                    fiches ANETI officielles…
                  </span>
                </div>
              ) : anetiResult?.opportunities.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {anetiResult.opportunities.map((opportunity) => (
                    <AnetiOpportunityCard key={opportunity.id} opportunity={opportunity} />
                  ))}
                </div>
              ) : !anetiLoading ? (
                <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <div>
                    <Globe2 className="mx-auto mb-3 h-9 w-9 text-slate-400" />
                    <p className="font-bold text-slate-800">
                      Aucune offre ANETI dans cette sélection.
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Choisissez « offres récentes » ou retirez le filtre texte.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
              <span>Source : Agence Nationale pour l’Emploi et le Travail Indépendant.</span>
              <a
                href={anetiResult?.meta.sourceUrl || "https://aneti-international.tn/offres"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-sky-800 hover:underline"
              >
                Ouvrir ANETI International <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </footer>
          </>
        ) : provider === "atct" ? (
          <>
            <div className="grid gap-3 border-b border-slate-200 bg-white px-5 py-4 lg:grid-cols-[230px_minmax(260px,1fr)_auto]">
              <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                Période
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value as "week" | "recent")}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  <option value="week">Publiées ces 7 derniers jours</option>
                  <option value="recent">Offres récentes encore ouvertes</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                Métier, pays ou critère
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void runAtctSearch();
                    }}
                    className="pl-9 normal-case tracking-normal"
                    placeholder="Ex. Canada, éducateur, restauration…"
                  />
                </div>
              </label>
              <Button
                className="self-end bg-teal-700 text-white hover:bg-teal-800"
                onClick={() => void runAtctSearch()}
              >
                {atctLoading ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Actualiser ATCT
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Les avis ATCT sont paginés puis relus fiche par fiche. Les marchés publics,
                concours, ateliers et annonces sans emploi sont exclus automatiquement. Aucun
                identifiant ATCT n’est enregistré par ZGR.
              </div>
              {atctError ? (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {atctError}
                </div>
              ) : null}
              {atctResult ? (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                  <p className="font-semibold text-emerald-950">
                    <BadgeCheck className="mr-1.5 inline h-4 w-4" />
                    {atctResult.meta.totalMatches} offre(s) ATCT vérifiée(s) ·{" "}
                    {atctResult.meta.excludedNotices} avis hors emploi écarté(s)
                  </p>
                  <p className="text-xs text-emerald-800">
                    Vérifiées le {new Date(atctResult.meta.verifiedAt).toLocaleString("fr-FR")}
                    {atctResult.meta.stale ? " · cache de secours" : ""}
                    {atctResult.meta.detailFailures
                      ? ` · ${atctResult.meta.detailFailures} fiche(s) conservée(s) du cache`
                      : ""}
                  </p>
                </div>
              ) : null}
              {atctResult?.meta.staleReason ? (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  Actualisation directe indisponible : affichage temporaire du dernier cache
                  vérifié.
                </div>
              ) : null}
              {atctLoading && !atctResult ? (
                <div className="grid min-h-64 place-items-center text-sm font-medium text-slate-500">
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="h-5 w-5 animate-spin text-teal-700" /> Lecture et
                    classification des avis ATCT officiels…
                  </span>
                </div>
              ) : atctResult?.opportunities.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {atctResult.opportunities.map((opportunity) => (
                    <AtctOpportunityCard key={opportunity.id} opportunity={opportunity} />
                  ))}
                </div>
              ) : !atctLoading ? (
                <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <div>
                    <Building2 className="mx-auto mb-3 h-9 w-9 text-slate-400" />
                    <p className="font-bold text-slate-800">
                      Aucune offre ATCT dans cette sélection.
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Choisissez « offres récentes » ou retirez le filtre texte.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
              <span>Source : Agence Tunisienne de Coopération Technique.</span>
              <div className="flex flex-wrap gap-3">
                <a
                  href={atctResult?.meta.candidatePortalUrl || "https://www.atct.tn/rh/fr/candidat"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:underline"
                >
                  Espace candidat <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <a
                  href={atctResult?.meta.sourceUrl || "https://www.atct.tn/fr/avis_ann"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:underline"
                >
                  Ouvrir les avis ATCT <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </footer>
          </>
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
      </div>
    </main>
  );
}
