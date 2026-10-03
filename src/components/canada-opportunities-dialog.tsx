import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
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

type Provider =
  | "jobbank"
  | "indeed"
  | "destination_canada"
  | "pei"
  | "new_brunswick"
  | "aneti"
  | "atct"
  | "italy";

function ProviderTab({
  active,
  children,
  description,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={description}
      onClick={onClick}
      className={`flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-black whitespace-nowrap transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
        active
          ? "border-red-400 bg-red-50 text-red-950 shadow-sm ring-1 ring-red-100"
          : "border-slate-200 bg-white text-slate-800 hover:border-red-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
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
              Canada, provinces canadiennes, Italie, ANETI, ATCT, volontariat et événements
              officiels avec parcours de candidature vérifié.
            </p>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <nav
          aria-label="Sources d’opportunités"
          className="shrink-0 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 [scrollbar-width:thin] sm:px-5"
        >
          <div className="mx-auto flex w-max min-w-full max-w-[1800px] gap-2">
            <ProviderTab
              active={provider === "jobbank"}
              description="Offres gouvernementales vérifiées fiche par fiche"
              onClick={() => setProvider("jobbank")}
            >
              <Landmark className="h-4 w-4 text-red-700" /> Guichet-Emplois
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] uppercase text-emerald-800">
                Recommandé
              </span>
            </ProviderTab>
            <ProviderTab
              active={provider === "indeed"}
              description="Recherche directe des offres récentes sur Indeed Canada"
              onClick={() => setProvider("indeed")}
            >
              <Search className="h-4 w-4 text-blue-700" /> Indeed
            </ProviderTab>
            <ProviderTab
              active={provider === "destination_canada"}
              description="Forum Mobilité et inscription officielle"
              onClick={() => setProvider("destination_canada")}
            >
              <CalendarDays className="h-4 w-4 text-violet-700" /> Destination Canada
            </ProviderTab>
            <ProviderTab
              active={provider === "pei"}
              description="EOI et recrutement hors Canada à l’Île-du-Prince-Édouard"
              onClick={() => setProvider("pei")}
            >
              <CountryFlag country="CA" /> Î.-P.-É.
            </ProviderTab>
            <ProviderTab
              active={provider === "new_brunswick"}
              description="Voies provinciales et restrictions du Nouveau-Brunswick"
              onClick={() => setProvider("new_brunswick")}
            >
              <CountryFlag country="CA" /> Nouveau-Brunswick
            </ProviderTab>
            <ProviderTab
              active={provider === "aneti"}
              description="Offres publiques ANETI International"
              onClick={() => setProvider("aneti")}
            >
              <Globe2 className="h-4 w-4 text-sky-700" /> ANETI
            </ProviderTab>
            <ProviderTab
              active={provider === "atct"}
              description="Recrutements internationaux officiels ATCT"
              onClick={() => setProvider("atct")}
            >
              <Building2 className="h-4 w-4 text-teal-700" /> ATCT
            </ProviderTab>
            <ProviderTab
              active={provider === "italy"}
              description="Decreto Flussi, EURES et procédure employeur en Italie"
              onClick={() => setProvider("italy")}
            >
              <CountryFlag country="IT" /> Italie
            </ProviderTab>
          </div>
        </nav>

        {provider === "pei" ? (
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
    </main>
  );
}
