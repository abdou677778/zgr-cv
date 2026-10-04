import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CalendarClock,
  ChevronDown,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  searchAlgeriaOpportunities,
  type AlgeriaOpportunity,
  type AlgeriaOpportunitySearchResult,
} from "@/lib/algeria-opportunities";

type Provider =
  | "jobbank"
  | "indeed"
  | "europe_jobs"
  | "destination_canada"
  | "francophone_canada"
  | "pei"
  | "new_brunswick"
  | "aneti"
  | "atct"
  | "algeria"
  | "italy";

type OpportunityCategory = "all" | "jobs" | "events" | "programs";

const PROVIDERS_BY_CATEGORY: Record<OpportunityCategory, Provider[]> = {
  all: [
    "jobbank",
    "europe_jobs",
    "indeed",
    "aneti",
    "atct",
    "algeria",
    "destination_canada",
    "francophone_canada",
    "pei",
    "new_brunswick",
    "italy",
  ],
  jobs: ["jobbank", "europe_jobs", "indeed", "aneti", "atct", "algeria"],
  events: ["destination_canada"],
  programs: ["francophone_canada", "pei", "new_brunswick", "italy"],
};

const PROVIDER_LABELS: Record<Provider, string> = {
  jobbank: "Guichet-Emplois Canada",
  europe_jobs: "Emplois officiels Europe",
  indeed: "Indeed Canada",
  aneti: "ANETI International",
  atct: "ATCT Tunisia",
  algeria: "Opportunités Algérie",
  destination_canada: "Destination Canada",
  francophone_canada: "Programmes Canada francophone",
  pei: "Île-du-Prince-Édouard",
  new_brunswick: "Nouveau-Brunswick",
  italy: "Opportunités Italie",
};

const PROVIDER_CONTEXT: Record<Provider, string> = {
  jobbank: "Gouvernement du Canada · recommandé",
  europe_jobs: "EURES · Union européenne",
  indeed: "Recherche d’emploi au Canada",
  aneti: "Service public de l’emploi · Tunisie",
  atct: "Coopération technique · Tunisie",
  algeria: "Offres par wilaya · Algérie",
  destination_canada: "Événement officiel du Canada",
  francophone_canada: "Programmes officiels du Canada",
  pei: "Programme provincial · Canada",
  new_brunswick: "Programme provincial · Canada",
  italy: "Emploi et immigration · Italie",
};

type ProviderTerritory = "canada" | "europe" | "tunisia" | "algeria" | "italy";

function territoryForProvider(provider: Provider): ProviderTerritory {
  if (provider === "europe_jobs") return "europe";
  if (provider === "aneti" || provider === "atct") return "tunisia";
  if (provider === "algeria") return "algeria";
  if (provider === "italy") return "italy";
  return "canada";
}

function ProviderTerritoryMark({ provider }: { provider: Provider }) {
  const territory = territoryForProvider(provider);
  const labels: Record<ProviderTerritory, string> = {
    canada: "Drapeau du Canada",
    europe: "Emblème de l’Union européenne",
    tunisia: "Drapeau de la Tunisie",
    algeria: "Drapeau de l’Algérie",
    italy: "Drapeau de l’Italie",
  };

  return (
    <span className="grid h-8 w-11 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <svg viewBox="0 0 44 30" role="img" aria-label={labels[territory]} className="h-full w-full">
        {territory === "canada" ? (
          <>
            <rect width="44" height="30" fill="#fff" />
            <rect width="11" height="30" fill="#d80621" />
            <rect x="33" width="11" height="30" fill="#d80621" />
            <path
              d="M22 4.4l1.6 4.2 3-1.6-.8 4 3.4.2-3 3.2 1.3 2.3-4.4-.8.7 6.3h-3.6l.7-6.3-4.4.8 1.3-2.3-3-3.2 3.4-.2-.8-4 3 1.6L22 4.4z"
              fill="#d80621"
            />
          </>
        ) : territory === "europe" ? (
          <>
            <rect width="44" height="30" fill="#003399" />
            {Array.from({ length: 12 }, (_, index) => {
              const angle = (index * Math.PI) / 6 - Math.PI / 2;
              return (
                <circle
                  key={index}
                  cx={22 + Math.cos(angle) * 8.2}
                  cy={15 + Math.sin(angle) * 8.2}
                  r="1.15"
                  fill="#ffcc00"
                />
              );
            })}
          </>
        ) : territory === "tunisia" ? (
          <>
            <rect width="44" height="30" fill="#e70013" />
            <circle cx="22" cy="15" r="8" fill="#fff" />
            <circle cx="23.2" cy="15" r="5.2" fill="#e70013" />
            <circle cx="25.1" cy="15" r="4.1" fill="#fff" />
            <path
              d="M24.9 11.5l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2.1 1.1.4-2.3-1.6-1.6 2.3-.3 1-2.1z"
              fill="#e70013"
            />
          </>
        ) : territory === "algeria" ? (
          <>
            <rect width="22" height="30" fill="#006233" />
            <rect x="22" width="22" height="30" fill="#fff" />
            <circle cx="21" cy="15" r="7" fill="#d21034" />
            <circle cx="23.2" cy="15" r="5.7" fill="#fff" />
            <path
              d="M24.3 10.9l1.1 2.3 2.5.4-1.8 1.7.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.7 2.5-.4 1.1-2.3z"
              fill="#d21034"
            />
          </>
        ) : (
          <>
            <rect width="14.67" height="30" fill="#009246" />
            <rect x="14.67" width="14.67" height="30" fill="#fff" />
            <rect x="29.34" width="14.66" height="30" fill="#ce2b37" />
          </>
        )}
      </svg>
    </span>
  );
}

function ProviderIdentity({
  provider,
  compact = false,
}: {
  provider: Provider;
  compact?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3 text-left">
      <ProviderTerritoryMark provider={provider} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-slate-950">
          {PROVIDER_LABELS[provider]}
        </span>
        {!compact && (
          <span className="block truncate text-[11px] font-semibold text-slate-500">
            {PROVIDER_CONTEXT[provider]}
          </span>
        )}
      </span>
    </span>
  );
}

const DESTINATION_CANADA_CANDIDATES_URL =
  "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/travailler-canada/embaucher-etranger-temporaires/travailleurs-francophones-bilingues-exterieur-quebec/destination-canada/candidats.html";
const DESTINATION_CANADA_EVENTS_URL =
  "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/travailler-canada/embaucher-etranger-temporaires/travailleurs-francophones-bilingues-exterieur-quebec/destination-canada/a-propos.html";
const PEI_EOI_REGISTER_URL = "https://eoi.princeedwardisland.ca/ieoi/register/register";
const PEI_EOI_GUIDE_URL =
  "https://www.princeedwardisland.ca/en/service/submit-your-expression-of-interest-profile";
const PEI_OUTSIDE_CANADA_URL =
  "https://www.princeedwardisland.ca/en/information/office-of-immigration/skilled-workers-outside-canada";
const PEI_EMPLOYER_RULES_URL =
  "https://www.princeedwardisland.ca/en/information/office-of-immigration/supporting-a-worker-for-immigration";
const NB_INB_URL = "https://www.inb.gnb.ca/";
const NB_IMMIGRATION_URL = "https://www.gnb.ca/en/topic/family-home-community/immigration.html";
const NB_SKILLED_WORKER_URL =
  "https://www.gnb.ca/en/topic/family-home-community/immigration/provincial-nominee-program/skilled-worker-stream.html";
const NB_NOTICES_URL =
  "https://www.gnb.ca/en/topic/family-home-community/immigration/important-notices.html";
const NB_ROUNDS_URL =
  "https://www.gnb.ca/en/topic/family-home-community/immigration/invitation-selection-rounds.html";
const ITALY_ALI_PORTAL_URL = "https://portaleservizi.dlci.interno.it/AliSportello/ali/home.htm";
const ITALY_DECREE_URL = "https://www.gazzettaufficiale.it/eli/id/2025/10/15/25A05656/SG";
const ITALY_OFFICIAL_GUIDE_URL =
  "https://prefettura.interno.gov.it/it/prefetture/belluno/immigrazione-decreto-flussi-2026-2028";
const ITALY_EURES_URL = "https://eures.europa.eu/jobseekers_it";
const ITALY_WORK_PERMIT_URL =
  "https://home-affairs.ec.europa.eu/policies/migration-and-asylum/eu-immigration-portal/employed-worker-italy_en";
const GERMANY_INTERNATIONAL_JOBS_URL =
  "https://www.make-it-in-germany.com/en/working-in-germany/job-listings/job-listings";
const GERMANY_APPLICATION_GUIDE_URL =
  "https://www.make-it-in-germany.com/en/working-in-germany/job/application";
const FINLAND_INTERNATIONAL_JOBS_URL = "https://www.workinfinland.com/en/open-jobs/";
const EURES_JOBSEEKERS_URL = "https://eures.europa.eu/jobseekers_en";
const JOB_BANK_FOREIGN_CANDIDATES_URL = "https://www.jobbank.gc.ca/findajob/foreign-candidates";
const FRANCOPHONE_MOBILITY_URL =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/special-instructions/francophone-mobility/eligibility.html";
const FRANCOPHONE_COMMUNITY_PILOT_URL =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/rural-franco-pilots/franco-immigration.html";
const FRANCOPHONE_COMMUNITY_JOBS_URL =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/rural-franco-pilots/franco-immigration/job-offer.html";
const ATLANTIC_IMMIGRATION_URL =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/atlantic-immigration.html";

function CountryFlag({ country }: { country: "IT" | "TN" | "DZ" | "CA" }) {
  const labels = { IT: "Italie", TN: "Tunisie", DZ: "Algérie", CA: "Canada" } as const;
  return (
    <svg
      viewBox="0 0 36 24"
      className="h-5 w-[30px] shrink-0 overflow-hidden rounded-sm border border-black/10 shadow-sm"
      role="img"
      aria-label={`Drapeau ${labels[country]}`}
    >
      {country === "CA" ? (
        <>
          <rect width="36" height="24" fill="#fff" />
          <rect width="8" height="24" fill="#d80621" />
          <rect x="28" width="8" height="24" fill="#d80621" />
          <path
            d="m18 4.2 1.25 3.25 2.2-1.15-.55 3.15 2.6.15-2.2 2.2.9 1.25-3.35-.65.35 5.35h-2.4l.35-5.35-3.35.65.9-1.25-2.2-2.2 2.6-.15-.55-3.15 2.2 1.15z"
            fill="#d80621"
          />
        </>
      ) : country === "IT" ? (
        <>
          <rect width="12" height="24" fill="#009246" />
          <rect x="12" width="12" height="24" fill="#fff" />
          <rect x="24" width="12" height="24" fill="#ce2b37" />
        </>
      ) : country === "TN" ? (
        <>
          <rect width="36" height="24" fill="#e70013" />
          <circle cx="18" cy="12" r="7" fill="#fff" />
          <circle cx="19.2" cy="12" r="4.7" fill="#e70013" />
          <circle cx="20.8" cy="12" r="3.8" fill="#fff" />
          <path
            d="m21.5 8.5.85 2.6h2.75l-2.22 1.62.85 2.62-2.23-1.62-2.22 1.62.85-2.62-2.23-1.62h2.75z"
            fill="#e70013"
          />
        </>
      ) : (
        <>
          <rect width="18" height="24" fill="#006233" />
          <rect x="18" width="18" height="24" fill="#fff" />
          <circle cx="18" cy="12" r="6.6" fill="#d21034" />
          <circle cx="20" cy="12" r="5.5" fill="#fff" />
          <path
            d="m20.8 7.7 1 3.05h3.2l-2.6 1.9 1 3.05-2.6-1.9-2.6 1.9 1-3.05-2.6-1.9h3.2z"
            fill="#d21034"
          />
        </>
      )}
    </svg>
  );
}

function EuropeOfficialJobsPanel() {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-blue-800">
                  Emplois officiels · candidature depuis la Tunisie ou l’Algérie
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Europe — offres ouvertes aux talents internationaux
                </h2>
                <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-600">
                  Ces portails publics permettent de repérer une offre et d’envoyer un CV et une
                  lettre. L’embauche reste soumise aux critères de l’annonce, à la reconnaissance du
                  diplôme et au visa ou permis national.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black uppercase text-emerald-900">
                <BadgeCheck className="h-4 w-4" /> Sources publiques contrôlées
              </span>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <article className="flex flex-col rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-lg">
                  🇩🇪
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-amber-800">
                    Gouvernement fédéral allemand
                  </p>
                  <h3 className="text-lg font-black text-slate-950">Make it in Germany</h3>
                </div>
              </div>
              <span className="mt-3 w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-900">
                Candidatures de l’étranger explicitement acceptées
              </span>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Offres de l’Agence fédérale pour l’emploi destinées aux professionnels qualifiés
                étrangers. Les postes exigent généralement un diplôme universitaire ou une formation
                professionnelle; les emplois non qualifiés et saisonniers sont exclus.
              </p>
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                <strong>Dossier habituel :</strong> CV, lettre adaptée et justificatifs. La fiche
                précise l’envoi par courriel ou sur le site de l’employeur.
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button asChild size="sm" className="bg-amber-700 text-white hover:bg-amber-800">
                  <a href={GERMANY_INTERNATIONAL_JOBS_URL} target="_blank" rel="noreferrer">
                    Voir les offres <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={GERMANY_APPLICATION_GUIDE_URL} target="_blank" rel="noreferrer">
                    Préparer la candidature <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </article>

            <article className="flex flex-col rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-lg">
                  🇫🇮
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-blue-800">
                    Service public finlandais
                  </p>
                  <h3 className="text-lg font-black text-slate-950">Work in Finland</h3>
                </div>
              </div>
              <span className="mt-3 w-fit rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-900">
                Emplois anglophones · candidats non-UE inclus
              </span>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Portail officiel Talent Boost pour les talents internationaux, avec des postes en
                technologie, ingénierie, santé, industrie, construction et autres secteurs. Chaque
                annonce renvoie vers la candidature de l’employeur.
              </p>
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                <strong>À contrôler :</strong> certains métiers sont soumis au test du marché du
                travail; les spécialistes peuvent relever d’un permis différent.
              </div>
              <Button
                asChild
                size="sm"
                className="mt-auto w-fit bg-blue-700 text-white hover:bg-blue-800"
              >
                <a href={FINLAND_INTERNATIONAL_JOBS_URL} target="_blank" rel="noreferrer">
                  Rechercher les emplois <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            </article>

            <article className="flex flex-col rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-100 text-lg">
                  🇪🇺
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-indigo-800">
                    Autorité européenne du travail
                  </p>
                  <h3 className="text-lg font-black text-slate-950">EURES</h3>
                </div>
              </div>
              <span className="mt-3 w-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-900">
                Vérification non-UE obligatoire par offre
              </span>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Réseau officiel de 31 pays pour rechercher des emplois, contacter un employeur ou un
                conseiller et préparer son CV Europass. Une annonce EURES n’accorde pas
                automatiquement le droit de travailler à un ressortissant tunisien ou algérien.
              </p>
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
                Retenir les offres mentionnant l’acceptation des candidats hors UE ou confirmer le
                parrainage avec l’employeur avant d’envoyer le dossier.
              </div>
              <Button
                asChild
                size="sm"
                className="mt-auto w-fit bg-indigo-700 text-white hover:bg-indigo-800"
              >
                <a href={EURES_JOBSEEKERS_URL} target="_blank" rel="noreferrer">
                  Ouvrir EURES <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            </article>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-950">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Aucun portail officiel ne garantit un contrat. Ne payez jamais une « offre garantie »;
            vérifiez le domaine de l’employeur, le permis applicable et les coordonnées avant tout
            envoi de documents.
          </div>
        </div>
      </div>
      <footer className="border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
        Sources et conditions vérifiées le 3 octobre 2026 · Les listes d’emplois restent dynamiques.
      </footer>
    </>
  );
}

function FrancophoneCanadaPanel() {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 via-white to-blue-50 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-red-800">
                  Canada · parcours officiels pour candidats francophones à l’étranger
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Emploi d’abord, immigration ensuite
                </h2>
                <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-600">
                  Un Tunisien ou un Algérien peut candidater depuis son pays, mais ces programmes
                  exigent une véritable offre d’un employeur admissible. Le CV et la lettre sont
                  envoyés à l’employeur, jamais à IRCC pour « obtenir un emploi ».
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CountryFlag country="TN" />
                <CountryFlag country="DZ" />
                <CountryFlag country="CA" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <article className="flex flex-col rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-red-800">
                Permis de travail · hors Québec
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-950">Mobilité francophone</h3>
              <span className="mt-3 w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-900">
                Sans EIMT · offre obligatoire
              </span>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
                <li>• Français oral et compréhension : NCLC 5 minimum.</li>
                <li>• Emploi dans une province ou un territoire hors Québec.</li>
                <li>• Toute catégorie FEER, sauf agriculture primaire FEER 4 et 5.</li>
                <li>• L’employeur utilise le code d’exemption C16 et paie 230 CAD.</li>
              </ul>
              <Button
                asChild
                size="sm"
                className="mt-auto w-fit bg-red-700 text-white hover:bg-red-800"
              >
                <a href={FRANCOPHONE_MOBILITY_URL} target="_blank" rel="noreferrer">
                  Vérifier l’admissibilité <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            </article>

            <article className="flex flex-col rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-blue-800">
                Résidence permanente · statut ouvert
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-950">
                Projet pilote des communautés francophones
              </h3>
              <span className="mt-3 w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-900">
                Programme ouvert
              </span>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Il faut une offre d’un employeur désigné dans l’une des six communautés : Péninsule
                acadienne, Sudbury, Timmins, région du lac Supérieur, St-Pierre-Jolys ou Kelowna.
                Chaque communauté publie ses employeurs et postes disponibles.
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button asChild size="sm" className="bg-blue-700 text-white hover:bg-blue-800">
                  <a href={FRANCOPHONE_COMMUNITY_JOBS_URL} target="_blank" rel="noreferrer">
                    Trouver les employeurs <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={FRANCOPHONE_COMMUNITY_PILOT_URL} target="_blank" rel="noreferrer">
                    Conditions IRCC <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </article>

            <article className="flex flex-col rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-cyan-800">
                Résidence permanente · provinces atlantiques
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-950">
                Programme d’immigration au Canada atlantique
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Les travailleurs qualifiés vivant à l’étranger sont admissibles s’ils obtiennent une
                offre d’un employeur désigné au Nouveau-Brunswick, en Nouvelle-Écosse, à
                Terre-Neuve-et-Labrador ou à l’Île-du-Prince-Édouard.
              </p>
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
                Les restrictions provinciales et les secteurs recrutés changent. Vérifier la liste
                de l’employeur désigné avant chaque candidature.
              </div>
              <Button
                asChild
                size="sm"
                className="mt-auto w-fit bg-cyan-700 text-white hover:bg-cyan-800"
              >
                <a href={ATLANTIC_IMMIGRATION_URL} target="_blank" rel="noreferrer">
                  Ouvrir le programme officiel <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            </article>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div>
              <p className="font-black text-emerald-950">Point de départ recommandé</p>
              <p className="mt-0.5 text-sm text-emerald-900">
                Chercher uniquement les offres marquées ouvertes aux candidats internationaux, puis
                envoyer le CV et la lettre selon la méthode indiquée.
              </p>
            </div>
            <Button asChild size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800">
              <a href={JOB_BANK_FOREIGN_CANDIDATES_URL} target="_blank" rel="noreferrer">
                Offres ouvertes à l’international <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
      <footer className="border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
        Conditions IRCC vérifiées le 3 octobre 2026 · Aucun programme ne garantit une offre.
      </footer>
    </>
  );
}

function ItalyOpportunitiesPanel() {
  const clickDays = [
    ["12 janvier 2027 · 09:00", "Travail saisonnier agricole"],
    ["9 février 2027 · 09:00", "Travail saisonnier tourisme et hôtellerie"],
    ["16 février 2027 · 09:00", "Travail salarié non saisonnier — secteurs autorisés"],
    ["18 février 2027 · 09:00", "Assistance familiale et aide à domicile"],
  ] as const;

  return (
    <>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-6xl space-y-5">
          <article className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
            <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-red-50 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CountryFlag country="IT" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-800">
                      République italienne · dispositif officiel
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                      Decreto Flussi 2027 — 165 850 quotas légaux
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-red-800">
                      Programme de quotas : ce ne sont pas 165 850 contrats de travail disponibles.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black uppercase text-emerald-900">
                  <BadgeCheck className="h-4 w-4" /> Source gouvernementale vérifiée
                </span>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["165 850", "Total 2027", "bg-slate-50 text-slate-950"],
                  ["89 000", "Travail saisonnier", "bg-emerald-50 text-emerald-950"],
                  ["76 200", "Travail non saisonnier", "bg-blue-50 text-blue-950"],
                  ["650", "Travail autonome", "bg-amber-50 text-amber-950"],
                ].map(([value, label, classes]) => (
                  <div key={label} className={`rounded-xl border border-slate-200 p-4 ${classes}`}>
                    <strong className="block text-2xl font-black">{value}</strong>
                    <span className="mt-1 block text-xs font-bold uppercase tracking-wide">
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="mr-auto flex items-center gap-2 font-black text-emerald-950">
                    <UserRoundCheck className="h-5 w-5" /> Pays du candidat officiellement concernés
                  </p>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-900 shadow-sm">
                    <CountryFlag country="TN" /> Tunisie
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-900 shadow-sm">
                    <CountryFlag country="DZ" /> Algérie
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-emerald-900">
                  Les deux pays figurent dans la liste officielle liée aux accords de coopération
                  migratoire. L’admissibilité finale dépend toutefois du secteur, de la catégorie,
                  du quota encore disponible et d’un véritable employeur italien.
                </p>
              </div>

              <section>
                <h3 className="flex items-center gap-2 font-black text-slate-950">
                  <CalendarClock className="h-5 w-5 text-red-700" /> Click Days 2027
                </h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {clickDays.map(([date, label]) => (
                    <div key={date} className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <strong className="block text-sm font-black text-red-900">{date}</strong>
                      <span className="mt-1 block text-sm text-red-800">{label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Heures italiennes. Les dates sont fixées par le DPCM 2026–2028 ; le calendrier de
                  préremplissage 2027 devra être contrôlé dans la future circulaire d’application.
                </p>
              </section>

              <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-red-950">
                <p className="flex items-start gap-2 font-black">
                  <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /> Le candidat ne demande pas
                  lui-même le Nulla Osta sur le portail ALI
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  L’employeur italien, son organisation professionnelle ou son mandataire autorisé
                  dépose la demande de Nulla Osta avec SPID/CIE. Après autorisation, le candidat
                  suit la procédure de visa auprès du consulat compétent. Une annonce, un quota ou
                  un paiement à un intermédiaire ne garantit jamais un contrat.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-800">
                    <Search className="h-4 w-4" /> Étape 1 · chercher un vrai employeur
                  </p>
                  <h3 className="mt-2 text-lg font-black text-blue-950">
                    Offres officielles EURES — Italie
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-blue-900">
                    Consultez les offres italiennes et vérifiez dans chaque fiche l’employeur, le
                    lieu, le contrat, la méthode de candidature et l’ouverture aux candidats hors
                    UE. EURES reste un moteur d’emploi : une fiche ne remplace pas le permis de
                    travail italien.
                  </p>
                  <Button asChild className="mt-4 bg-blue-700 text-white hover:bg-blue-800">
                    <a href={ITALY_EURES_URL} target="_blank" rel="noreferrer">
                      Rechercher sur EURES <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </section>

                <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-emerald-800">
                    <Landmark className="h-4 w-4" /> Étape 2 · procédure employeur
                  </p>
                  <h3 className="mt-2 text-lg font-black text-emerald-950">
                    Portail officiel ALI — demande de Nulla Osta
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-emerald-900">
                    Ce portail sert au dépôt administratif par l’employeur ou son mandataire. Il ne
                    permet pas au travailleur étranger de chercher un emploi ni d’envoyer
                    directement son CV pour obtenir une place.
                  </p>
                  <Button asChild className="mt-4 bg-emerald-700 text-white hover:bg-emerald-800">
                    <a href={ITALY_ALI_PORTAL_URL} target="_blank" rel="noreferrer">
                      Ouvrir le portail ALI <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </section>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-black">Préparation recommandée</p>
                <p className="mt-1 leading-relaxed">
                  CV en italien ou en anglais, lettre adaptée à l’offre, passeport valide, diplômes,
                  preuves d’expérience et coordonnées vérifiables. Refusez toute promesse de « quota
                  garanti » ou de contrat contre paiement.
                </p>
              </div>
            </div>
          </article>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
        <span>Vérifié le 3 octobre 2026 · DPCM italien du 2 octobre 2025.</span>
        <div className="flex flex-wrap gap-3">
          <a
            href={ITALY_DECREE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline"
          >
            Texte officiel <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href={ITALY_OFFICIAL_GUIDE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline"
          >
            Guide Préfecture <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href={ITALY_WORK_PERMIT_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline"
          >
            Procédure visa et permis <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </footer>
    </>
  );
}

function PrinceEdwardIslandOpportunitiesPanel() {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-6xl space-y-5">
          <article className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
            <div className="border-b border-red-100 bg-gradient-to-r from-red-50 via-white to-amber-50 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CountryFlag country="CA" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-red-800">
                      Canada · programme provincial officiel
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                      Île-du-Prince-Édouard — EOI et recrutement international
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Parcours employeur vérifié pour les travailleurs qualifiés hors Canada.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black uppercase text-emerald-900">
                  <BadgeCheck className="h-4 w-4" /> Sources PEI vérifiées
                </span>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-red-950">
                <p className="flex items-start gap-2 font-black">
                  <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /> Une déclaration d’intérêt
                  n’est ni une candidature complète, ni un emploi garanti
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  Pour le volet Travailleur qualifié hors Canada, il faut une offre à temps plein,
                  non saisonnière, dans une profession FEER 0, 1, 2 ou 3. L’employeur de l’Î.-P.-É.
                  doit obtenir l’autorisation du Bureau de l’immigration avant que le candidat crée
                  son profil EOI.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-emerald-800">
                    <BriefcaseBusiness className="h-4 w-4" /> Priorités annoncées en 2026
                  </p>
                  <h3 className="mt-2 text-lg font-black text-emerald-950">
                    Santé, métiers spécialisés et petite enfance
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-emerald-900">
                    La province priorise la santé, les métiers spécialisés, la petite enfance et
                    d’autres pénuries essentielles. Les ventes et services peuvent ne pas recevoir
                    d’invitation actuellement : la liste diffusée sur les réseaux sociaux n’est donc
                    pas une liste garantie de secteurs ouverts.
                  </p>
                </section>

                <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-800">
                    <UserRoundCheck className="h-4 w-4" /> Conditions principales
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-blue-950">
                    <li>• 18 à 59 ans et statut légal dans le pays de résidence.</li>
                    <li>• Deux ans d’expérience à temps plein sur les cinq dernières années.</li>
                    <li>• Diplôme postsecondaire d’au moins deux ans.</li>
                    <li>
                      • Français ou anglais suffisant, généralement NCLC/CLB 4 ou preuve employeur.
                    </li>
                  </ul>
                </section>
              </div>

              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                <p className="flex items-start gap-2 font-black">
                  <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0" /> « L’employeur paie tout »
                  est faux
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  L’employeur paie les frais fédéraux de conformité de 230 CAD lorsqu’ils
                  s’appliquent. Le candidat doit toutefois disposer de fonds suffisants pour ses
                  frais d’immigration, de voyage et d’installation, y compris pour sa famille. Une
                  entrevue en ligne dépend de l’employeur et n’est pas une garantie du programme.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <strong className="block text-slate-950">1. Offre et autorisation</strong>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                    Un employeur PEI admissible obtient d’abord l’autorisation provinciale.
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <strong className="block text-slate-950">2. Profil EOI gratuit</strong>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                    Le profil reste actif six mois et peut être mis à jour avant invitation.
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <strong className="block text-slate-950">3. Invitation puis demande</strong>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                    Après ITA : 30 jours pour le dossier, frais provinciaux de 300 CAD.
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-red-700 text-white hover:bg-red-800">
                  <a href={PEI_EOI_REGISTER_URL} target="_blank" rel="noreferrer">
                    Créer le profil EOI officiel <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={PEI_OUTSIDE_CANADA_URL} target="_blank" rel="noreferrer">
                    Vérifier l’admissibilité hors Canada <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={PEI_EMPLOYER_RULES_URL} target="_blank" rel="noreferrer">
                    Obligations de l’employeur <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </article>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
        <span>Vérifié le 3 octobre 2026 · Gouvernement de l’Île-du-Prince-Édouard.</span>
        <a
          href={PEI_EOI_GUIDE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-red-800 hover:underline"
        >
          Fonctionnement officiel de l’EOI <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </footer>
    </>
  );
}

function NewBrunswickOpportunitiesPanel() {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-6xl space-y-5">
          <article className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
            <div className="border-b border-red-100 bg-gradient-to-r from-red-50 via-white to-yellow-50 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CountryFlag country="CA" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-red-800">
                      Canada · Immigration Nouveau-Brunswick
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                      Nouveau-Brunswick — compte INB et voies 2026
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Conditions, restrictions et sélections provinciales contrôlées.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black uppercase text-emerald-900">
                  <BadgeCheck className="h-4 w-4" /> Sources GNB vérifiées
                </span>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-red-950">
                <p className="flex items-start gap-2 font-black">
                  <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /> Créer un compte INB ou une
                  EOI ne garantit aucune invitation
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  Les EOI restent dans le bassin jusqu’à 365 jours. La province sélectionne selon
                  ses besoins, ses quotas et ses priorités. Une nomination provinciale n’est pas la
                  résidence permanente : la décision finale appartient à IRCC.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-800">
                    <UserRoundCheck className="h-4 w-4" /> Travailleur qualifié
                  </p>
                  <h3 className="mt-2 text-lg font-black text-blue-950">Admissibilité de base</h3>
                  <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-blue-950">
                    <li>• Avoir au moins 19 ans et NCLC/CLB 4 dans les quatre compétences.</li>
                    <li>
                      • Appui d’un employeur admissible actif au Nouveau-Brunswick depuis 24 mois.
                    </li>
                    <li>• Emploi à temps plein non saisonnier et exigences CNP respectées.</li>
                    <li>
                      • La voie « professions prioritaires » exige une mission officielle du GNB.
                    </li>
                  </ul>
                </section>

                <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-emerald-800">
                    <CalendarClock className="h-4 w-4" /> Dernières sélections · septembre 2026
                  </p>
                  <h3 className="mt-2 text-lg font-black text-emerald-950">
                    Secteurs observés, pas une admissibilité universelle
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-emerald-900">
                    Construction, éducation et services sociaux, fabrication, métiers, professions
                    et TI, ventes et services, transport selon le volet. La présence d’un secteur
                    dans un tirage passé ne garantit pas sa sélection au prochain tirage.
                  </p>
                </section>
              </div>

              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                <p className="flex items-start gap-2 font-black">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" /> Restrictions officielles en
                  vigueur
                </p>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
                  <li>
                    • Depuis le 4 mai 2026, la voie Expérience NB limite ses nouvelles invitations à
                    la santé, l’éducation et la construction.
                  </li>
                  <li>
                    • Depuis le 3 février 2026, l’hébergement et la restauration (SCIAN 72) sont
                    exclus des invitations Travailleur qualifié et Entrée express, avec des
                    restrictions CNP supplémentaires.
                  </li>
                  <li>
                    • Pour les candidats hors Canada sous le Programme d’immigration au Canada
                    atlantique, les postes sont limités aux initiatives GNB en santé, éducation et
                    construction ; les nouvelles désignations d’employeurs sont suspendues pour le
                    reste de 2026.
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-black text-slate-950">Famille et résidence permanente</p>
                <p className="mt-1 leading-relaxed">
                  Le conjoint et les enfants à charge peuvent être déclarés lorsque les règles
                  fédérales du dossier le permettent. Cela ne dispense pas des preuves, frais,
                  examens et contrôles d’admissibilité applicables à chaque membre de la famille.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-red-700 text-white hover:bg-red-800">
                  <a href={NB_INB_URL} target="_blank" rel="noreferrer">
                    Créer ou ouvrir le compte INB <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={NB_SKILLED_WORKER_URL} target="_blank" rel="noreferrer">
                    Vérifier le volet qualifié <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={NB_NOTICES_URL} target="_blank" rel="noreferrer">
                    Restrictions en vigueur <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={NB_ROUNDS_URL} target="_blank" rel="noreferrer">
                    Dernières invitations <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </article>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
        <span>Vérifié le 3 octobre 2026 · Gouvernement du Nouveau-Brunswick.</span>
        <a
          href={NB_IMMIGRATION_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-red-800 hover:underline"
        >
          Portail Immigration NB <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </footer>
    </>
  );
}

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

function contentDirection(value: string): "rtl" | "ltr" {
  const arabic = (value.match(/[\u0600-\u06ff]/g) || []).length;
  const latin = (value.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  return arabic > latin ? "rtl" : "ltr";
}

function AlgeriaOfferText({
  description,
  compact = false,
}: {
  description: string;
  compact?: boolean;
}) {
  const lines = description
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const visibleLines = compact ? lines.slice(0, 4) : lines;
  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      {visibleLines.map((line, index) => {
        const direction = contentDirection(line);
        const heading =
          /^(?:📢|🔴|🚀|💼|📍|🎯|🎓|📩|🧩|⭐|☑|⚠️|📌|🏢|🏫|🏥|🏨|🛠️)/u.test(line) ||
          /^(إعلان|المناصب|المنصب|المهام|الشروط|الملف|طريقة التقديم|candidature|profil|missions?|postes?)/i.test(
            line.replace(/^[^\p{L}\p{N}]+/u, ""),
          );
        return (
          <p
            key={`${index}-${line.slice(0, 24)}`}
            dir={direction}
            lang={direction === "rtl" ? "ar" : "fr"}
            className={`${
              direction === "rtl"
                ? "text-right [font-family:Arial,'Noto_Sans_Arabic',sans-serif]"
                : "text-left"
            } [unicode-bidi:plaintext] ${
              heading ? "font-bold text-slate-900" : "text-slate-700"
            } ${compact ? "text-sm leading-relaxed" : "text-[15px] leading-8"}`}
          >
            {line}
          </p>
        );
      })}
      {compact && lines.length > visibleLines.length ? (
        <p className="text-xs font-semibold text-emerald-800">
          + {lines.length - visibleLines.length} ligne(s) dans la fiche complète
        </p>
      ) : null}
    </div>
  );
}

function AlgeriaOpportunityCard({
  opportunity,
  isAdmin,
  onDetails,
}: {
  opportunity: AlgeriaOpportunity;
  isAdmin: boolean;
  onDetails: () => void;
}) {
  const directActionLabel =
    opportunity.applicationMethod.type === "email"
      ? "Écrire pour postuler"
      : opportunity.applicationMethod.type === "phone"
        ? "Appeler le contact"
        : opportunity.applicationMethod.type === "external_link"
          ? "Ouvrir la candidature"
          : null;
  return (
    <article className="flex h-full flex-col rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">
          🇩🇿 Offre locale Algérie
        </span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-950">
          Source communautaire à vérifier
        </span>
        {opportunity.dataQuality.status === "partial" ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
            Données partielles
          </span>
        ) : null}
      </div>

      <h3 dir="auto" className="text-start text-base font-black leading-snug text-slate-950">
        {opportunity.title}
      </h3>
      <div className="mt-3 space-y-1.5 text-sm text-slate-600">
        {opportunity.employer ? (
          <p className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <span dir="auto" className="text-start [unicode-bidi:plaintext]">
              {opportunity.employer}
            </span>
          </p>
        ) : null}
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <span dir="auto" className="text-start [unicode-bidi:plaintext]">
            {opportunity.commune ||
              (opportunity.wilayas.length
                ? opportunity.wilayas.join(" · ")
                : "Wilaya non déterminée")}
          </span>
        </p>
        <p className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <span>
            Publication Telegram : {formatDate(opportunity.publishedAt, "date non exposée")}
          </span>
        </p>
      </div>

      {opportunity.positions.length ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-950">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-800">
            Poste{opportunity.positions.length > 1 ? "s" : ""}
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs leading-relaxed">
            {opportunity.positions.slice(0, 6).map((position) => (
              <li key={position} dir="auto" className="text-start [unicode-bidi:plaintext]">
                {position}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-blue-950">
        <p className="flex items-start gap-2 text-sm font-black">
          {opportunity.applicationMethod.type === "email" ? (
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          ) : opportunity.applicationMethod.type === "phone" ? (
            <Phone className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{opportunity.applicationMethod.label}</span>
        </p>
        {opportunity.applicationMethod.email ? (
          <a
            href={`mailto:${opportunity.applicationMethod.email}`}
            className="mt-1.5 block break-all text-sm font-bold underline underline-offset-2"
          >
            {opportunity.applicationMethod.email}
          </a>
        ) : null}
        {opportunity.applicationMethod.phone ? (
          <a
            href={`tel:${opportunity.applicationMethod.phone.replace(/[^+\d]/g, "")}`}
            className="mt-1.5 block text-sm font-bold underline underline-offset-2"
          >
            {opportunity.applicationMethod.phone}
          </a>
        ) : null}
        {!opportunity.applicationMethod.email && !opportunity.applicationMethod.phone ? (
          <p className="mt-1 text-xs leading-relaxed">{opportunity.applicationMethod.note}</p>
        ) : null}
      </div>

      {opportunity.requiredDocuments.length ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          <strong>Pièces mentionnées :</strong> {opportunity.requiredDocuments.join(" · ")}
        </p>
      ) : null}
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <AlgeriaOfferText description={opportunity.description} compact />
      </div>

      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
        {isAdmin ? (
          <Button asChild size="sm" variant="outline">
            <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer">
              Vérifier sur Telegram <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={onDetails}>
          <FileText className="mr-1.5 h-3.5 w-3.5" /> Plus d’infos
        </Button>
        {directActionLabel ? (
          <Button asChild size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800">
            <a href={opportunity.applicationMethod.url} target="_blank" rel="noreferrer">
              {directActionLabel} <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function AlgeriaOpportunityDetails({
  opportunity,
  isAdmin,
  onClose,
}: {
  opportunity: AlgeriaOpportunity;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const directActionLabel =
    opportunity.applicationMethod.type === "email"
      ? "Envoyer la candidature par e-mail"
      : opportunity.applicationMethod.type === "phone"
        ? "Appeler le contact"
        : opportunity.applicationMethod.type === "external_link"
          ? "Ouvrir le formulaire de candidature"
          : null;
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="algeria-opportunity-details-title"
      className="fixed inset-0 z-[130] flex min-h-0 flex-col bg-slate-50"
    >
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour aux offres
          </Button>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
              Fiche complète · Opportunité Algérie
            </p>
            <h2
              id="algeria-opportunity-details-title"
              dir="auto"
              className="truncate text-start text-lg font-black text-slate-950"
            >
              {opportunity.title}
            </h2>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Employeur</p>
              <p dir="auto" className="mt-1 text-start font-bold text-slate-950">
                {opportunity.employer || "Non indiqué dans l’annonce"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Commune / wilaya
              </p>
              <p dir="auto" className="mt-1 text-start font-bold text-slate-950">
                {opportunity.location || opportunity.wilayas.join(" · ") || "Non déterminée"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Publication
              </p>
              <p className="mt-1 font-bold text-slate-950">
                {formatDate(opportunity.publishedAt, "Date non exposée")}
              </p>
            </div>
          </div>

          {opportunity.positions.length ? (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="font-black text-emerald-950">Postes et spécialités</h3>
              <ul className="mt-2 grid gap-2 md:grid-cols-2">
                {opportunity.positions.map((position) => (
                  <li
                    key={position}
                    dir="auto"
                    className="rounded-lg bg-white px-3 py-2 text-start text-sm font-semibold text-slate-900 shadow-sm [unicode-bidi:plaintext]"
                  >
                    {position}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h3 className="mb-4 border-b border-slate-200 pb-3 text-lg font-black text-slate-950">
              Informations complètes de l’offre
            </h3>
            <AlgeriaOfferText description={opportunity.description} />
          </section>

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <h3 className="font-black text-blue-950">Candidature</h3>
            <p className="mt-1 text-sm text-blue-900">{opportunity.applicationMethod.label}</p>
            {opportunity.requiredDocuments.length ? (
              <p className="mt-2 text-sm text-blue-950">
                <strong>Pièces mentionnées :</strong> {opportunity.requiredDocuments.join(" · ")}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {directActionLabel ? (
                <Button asChild className="bg-blue-700 text-white hover:bg-blue-800">
                  <a href={opportunity.applicationMethod.url} target="_blank" rel="noreferrer">
                    {directActionLabel} <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              ) : (
                <p className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                  Aucun contact distinct n’a été extrait avec certitude.
                </p>
              )}
              {isAdmin ? (
                <Button asChild variant="outline">
                  <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer">
                    Vérifier sur Telegram <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

export function CanadaOpportunitiesDialog({
  open,
  onOpenChange,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}) {
  const [provider, setProvider] = useState<Provider>("jobbank");
  const [category, setCategory] = useState<OpportunityCategory>("all");
  const [country, setCountry] = useState<"DZ" | "TN">("DZ");
  const [period, setPeriod] = useState<"week" | "recent">("week");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<CanadaOpportunitySearchResult | null>(null);
  const [anetiResult, setAnetiResult] = useState<AnetiOpportunitySearchResult | null>(null);
  const [atctResult, setAtctResult] = useState<AtctOpportunitySearchResult | null>(null);
  const [algeriaResult, setAlgeriaResult] = useState<AlgeriaOpportunitySearchResult | null>(null);
  const [selectedAlgeriaOpportunity, setSelectedAlgeriaOpportunity] =
    useState<AlgeriaOpportunity | null>(null);
  const [algeriaWilaya, setAlgeriaWilaya] = useState("all");
  const [loading, setLoading] = useState(false);
  const [anetiLoading, setAnetiLoading] = useState(false);
  const [atctLoading, setAtctLoading] = useState(false);
  const [algeriaLoading, setAlgeriaLoading] = useState(false);
  const [error, setError] = useState("");
  const [anetiError, setAnetiError] = useState("");
  const [atctError, setAtctError] = useState("");
  const [algeriaError, setAlgeriaError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const anetiRequestRef = useRef<AbortController | null>(null);
  const atctRequestRef = useRef<AbortController | null>(null);
  const algeriaRequestRef = useRef<AbortController | null>(null);

  const changeCategory = (nextCategory: OpportunityCategory) => {
    const defaultProvider: Record<OpportunityCategory, Provider> = {
      all: "jobbank",
      jobs: "jobbank",
      events: "destination_canada",
      programs: "francophone_canada",
    };
    setCategory(nextCategory);
    setProvider(defaultProvider[nextCategory]);
  };

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

  const runAlgeriaSearch = useCallback(
    async (refresh = false) => {
      algeriaRequestRef.current?.abort();
      const controller = new AbortController();
      algeriaRequestRef.current = controller;
      setAlgeriaLoading(true);
      setAlgeriaError("");
      try {
        setAlgeriaResult(
          await searchAlgeriaOpportunities({
            period,
            wilaya: algeriaWilaya,
            query,
            limit: 60,
            refresh,
            signal: controller.signal,
          }),
        );
      } catch (failure) {
        if ((failure as Error).name !== "AbortError")
          setAlgeriaError(
            failure instanceof Error ? failure.message : "Recherche Algérie indisponible.",
          );
      } finally {
        if (!controller.signal.aborted) setAlgeriaLoading(false);
      }
    },
    [algeriaWilaya, period, query],
  );

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
    if (open && provider === "algeria") void runAlgeriaSearch();
    return () => algeriaRequestRef.current?.abort();
  }, [algeriaWilaya, open, period, provider, runAlgeriaSearch]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const returnHome = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedAlgeriaOpportunity) setSelectedAlgeriaOpportunity(null);
      else onOpenChange(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", returnHome);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", returnHome);
    };
  }, [onOpenChange, open, selectedAlgeriaOpportunity]);

  if (!open) return null;

  return (
    <main
      aria-labelledby="international-opportunities-title"
      className="fixed inset-0 z-[100] flex min-h-0 flex-col overflow-hidden bg-slate-50"
    >
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="mx-auto flex w-full max-w-[1800px] items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit shrink-0 border-slate-300 bg-white font-bold text-slate-800 hover:bg-slate-100"
            onClick={() => onOpenChange(false)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour à l’accueil
          </Button>
          <div className="min-w-0">
            <h1
              id="international-opportunities-title"
              className="flex items-center gap-2 text-lg font-black text-slate-950 sm:text-xl"
            >
              <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-100 text-red-800 sm:grid">
                <BriefcaseBusiness className="h-5 w-5" />
              </span>
              Opportunités internationales
            </h1>
            <p className="mt-0.5 hidden text-xs text-slate-600 md:block">
              Emplois Europe et Canada, recrutements officiels, événements et programmes avec
              parcours de candidature vérifié.
            </p>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <nav
          aria-label="Sources d’opportunités"
          className="shrink-0 border-b border-slate-200 bg-white px-3 py-2 sm:px-5"
        >
          <div className="mx-auto grid w-full max-w-[1800px] grid-cols-[minmax(130px,0.8fr)_minmax(175px,1.2fr)] gap-2 lg:max-w-4xl lg:grid-cols-[280px_minmax(360px,1fr)]">
            <label className="min-w-0">
              <span className="sr-only">Catégorie d’opportunités</span>
              <select
                aria-label="Catégorie d’opportunités"
                value={category}
                onChange={(event) => changeCategory(event.target.value as OpportunityCategory)}
                className="h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-slate-900 px-3 pr-8 text-sm font-black text-white focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200"
              >
                <option value="all">Toutes les catégories</option>
                <option value="jobs">Emplois avec CV</option>
                <option value="events">Événements recrutement</option>
                <option value="programs">Programmes officiels</option>
              </select>
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Source ou programme"
                  title="Ouvrir la liste des sources et programmes"
                  className="flex h-11 min-w-0 items-center justify-between gap-2 rounded-xl border border-red-300 bg-red-50 px-2.5 text-red-950 shadow-sm outline-none transition hover:bg-red-100 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                >
                  <ProviderIdentity provider={provider} compact />
                  <ChevronDown className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="z-[150] w-[min(430px,calc(100vw-1.5rem))] rounded-xl border-slate-200 bg-white p-1.5 shadow-xl"
              >
                <DropdownMenuLabel className="px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Choisir une source ou un programme
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {PROVIDERS_BY_CATEGORY[category].map((providerOption) => {
                  const selected = providerOption === provider;
                  return (
                    <DropdownMenuItem
                      key={providerOption}
                      aria-current={selected ? "true" : undefined}
                      className="min-h-12 cursor-pointer gap-3 rounded-lg px-2.5 py-2 focus:bg-red-50 data-[highlighted]:bg-red-50"
                      onSelect={() => setProvider(providerOption)}
                    >
                      <ProviderIdentity provider={providerOption} />
                      {selected && (
                        <BadgeCheck
                          className="ml-auto h-5 w-5 shrink-0 text-emerald-600"
                          aria-label="Sélection active"
                        />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>

        {provider === "europe_jobs" ? (
          <EuropeOfficialJobsPanel />
        ) : provider === "francophone_canada" ? (
          <FrancophoneCanadaPanel />
        ) : provider === "pei" ? (
          <PrinceEdwardIslandOpportunitiesPanel />
        ) : provider === "new_brunswick" ? (
          <NewBrunswickOpportunitiesPanel />
        ) : provider === "italy" ? (
          <ItalyOpportunitiesPanel />
        ) : provider === "indeed" ? (
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
        ) : provider === "algeria" ? (
          <>
            <div className="grid shrink-0 gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-5 lg:grid-cols-[190px_220px_minmax(260px,1fr)_auto]">
              <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                Période
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value as "week" | "recent")}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="week">Publiées ces 7 derniers jours</option>
                  <option value="recent">Publications récentes disponibles</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                Wilaya (69)
                <select
                  aria-label="Wilaya Algérie"
                  value={algeriaWilaya}
                  onChange={(event) => setAlgeriaWilaya(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">Toutes les wilayas</option>
                  {(algeriaResult?.wilayas || []).map((wilaya) => (
                    <option key={wilaya} value={wilaya}>
                      {wilaya}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                Poste, commune ou employeur
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void runAlgeriaSearch();
                    }}
                    className="pl-9 normal-case tracking-normal"
                    placeholder="Ex. comptable, Hassi Messaoud, école…"
                  />
                </div>
              </label>
              <Button
                className="self-end bg-emerald-700 text-white hover:bg-emerald-800"
                onClick={() => void runAlgeriaSearch(true)}
              >
                {algeriaLoading ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Charger plus d’offres
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Les annonces proviennent du canal communautaire Recrutement DZ, pas d’un organisme
                  public. Vérifiez l’employeur, le contact et la publication originale ; ne payez
                  jamais pour obtenir un poste. ZGR ne conserve aucun compte Telegram.
                </span>
              </div>
              {algeriaError ? (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {algeriaError}
                </div>
              ) : null}
              {algeriaResult ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-emerald-950">
                    <BadgeCheck className="mr-1.5 inline h-4 w-4" />
                    {algeriaResult.meta.totalMatches} annonce(s) classée(s)
                    {algeriaWilaya !== "all" ? ` · ${algeriaWilaya}` : " · 69 wilayas"}
                    {algeriaResult.meta.cachedTotal > algeriaResult.meta.totalMatches
                      ? ` · ${algeriaResult.meta.cachedTotal} dans l’historique`
                      : ""}
                  </p>
                  <p className="text-xs text-emerald-800">
                    Source relue le{" "}
                    {new Date(algeriaResult.meta.verifiedAt).toLocaleString("fr-FR")}
                    {algeriaResult.meta.stale ? " · cache de secours" : ""}
                  </p>
                </div>
              ) : null}
              {algeriaResult?.meta.staleReason ? (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  Telegram est momentanément indisponible : le dernier cache vérifié est affiché.
                </div>
              ) : null}
              {algeriaLoading && !algeriaResult ? (
                <div className="grid min-h-64 place-items-center text-sm font-medium text-slate-500">
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="h-5 w-5 animate-spin text-emerald-700" /> Lecture et
                    classement des publications Telegram…
                  </span>
                </div>
              ) : algeriaResult?.opportunities.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {algeriaResult.opportunities.map((opportunity) => (
                    <AlgeriaOpportunityCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      isAdmin={isAdmin}
                      onDetails={() => setSelectedAlgeriaOpportunity(opportunity)}
                    />
                  ))}
                </div>
              ) : !algeriaLoading ? (
                <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <div>
                    <BriefcaseBusiness className="mx-auto mb-3 h-9 w-9 text-slate-400" />
                    <p className="font-bold text-slate-800">Aucune annonce dans cette sélection.</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Essayez toutes les wilayas, « publications récentes » ou retirez le mot-clé.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
              <span>
                Source communautaire Telegram · classement ZGR par wilaya, commune et poste.
              </span>
              {isAdmin ? (
                <a
                  href={algeriaResult?.meta.sourceUrl || "https://t.me/rcrdz1"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline"
                >
                  Ouvrir la source Telegram <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </footer>
          </>
        ) : provider === "aneti" ? (
          <>
            <div className="grid shrink-0 gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-5 lg:grid-cols-[210px_minmax(260px,1fr)_auto]">
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

            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
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
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
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
            <div className="grid shrink-0 gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-5 lg:grid-cols-[210px_minmax(260px,1fr)_auto]">
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

            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
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
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
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
            <div className="grid shrink-0 gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-5 lg:grid-cols-[160px_210px_minmax(260px,1fr)_auto]">
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

            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {error ? (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
              ) : null}
              {result ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
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
      {selectedAlgeriaOpportunity ? (
        <AlgeriaOpportunityDetails
          opportunity={selectedAlgeriaOpportunity}
          isAdmin={isAdmin}
          onClose={() => setSelectedAlgeriaOpportunity(null)}
        />
      ) : null}
    </main>
  );
}
