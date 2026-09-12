import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudCheck,
  Database,
  Download,
  ExternalLink,
  GitCompareArrows,
  History,
  LoaderCircle,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserRoundPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  applyCloudCommit,
  deleteClientProfile,
  deleteCloudProfile,
  getCloudProfileVersion,
  getCloudProfile,
  getClientProfile,
  listCloudProfileVersions,
  listCloudProfiles,
  listCloudTrash,
  listClientProfiles,
  putCloudProfile,
  purgeCloudTrashProfile,
  restoreCloudTrashProfile,
  restoreCloudProfileVersion,
  saveClientProfile,
  synchronizeClientProfiles,
  type ClientProfile,
  type ClientProfileSummary,
  type CloudProfilePagination,
  type CloudProfileVersion,
  type TrashedClientProfile,
} from "@/lib/client-profile-db";
import { CLIENTS_API_ENDPOINT, getAdminSession, type SessionUser } from "@/lib/auth-client";

export type ClientSyncStatus = {
  state: "idle" | "syncing" | "synced" | "local" | "conflict";
  message: string;
};

const CLIENT_PAGE_SIZE = 20;
const EMPTY_PAGINATION: CloudProfilePagination = {
  page: 1,
  pageSize: CLIENT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasPrevious: false,
  hasNext: false,
};

type ProfileDifference = {
  key: string;
  label: string;
  before: string;
  after: string;
};

type ProfileComparison = {
  fromRevision: number;
  toRevision: number;
  differences: ProfileDifference[];
};

const COMPARISON_LABELS: Record<string, string> = {
  cvByLanguage: "CV",
  hiddenElements: "Éléments masqués",
  documentKind: "Type de document",
  templateId: "Modèle",
  templateColors: "Palette",
  templateDesign: "Design",
  sectionAppearance: "Titres des sections",
  nom_complet: "Nom complet",
  titre_poste: "Poste",
  telephone: "Téléphone",
  email: "E-mail",
  adresse: "Adresse",
  statut_relocation: "Statut / Relocation",
  date_naissance: "Date de naissance",
  situation_familiale: "Situation familiale",
  permis_conduire: "Permis de conduire",
  service_national: "Service national",
  wilaya: "Wilaya / Province",
  pays: "Pays",
  candidature: "Candidature",
  objectif: "Objectif",
  competences: "Compétences",
  logiciels: "Logiciels",
  langues: "Langues",
  experiences: "Expériences",
  formations: "Formations",
  educations: "Éducation",
  participations: "Participations",
  certifications: "Certifications",
  interets: "Centres d’intérêt",
  references: "Références",
  lettre_motivation: "Lettre de motivation",
  plan_developpement: "Plan professionnel",
  titre: "Titre",
  dates: "Dates",
  date: "Date",
  lieu: "Lieu",
  employeur: "Employeur",
  institution: "Institution",
  descriptions: "Responsabilités",
  option: "Option",
  equivalence: "Équivalence",
  name: "Nom du profil",
  phone: "Téléphone du profil",
  language: "Langue active",
};

const LANGUAGE_LABELS: Record<string, string> = {
  fr: "Français",
  en: "Anglais",
  ar: "Arabe",
  de: "Allemand",
  es: "Espagnol",
  kab: "Kabyle",
};

const COMPARISON_IGNORED_FIELDS = new Set([
  "version",
  "revision",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
  "restoredFromRevision",
  "restoredFromTrash",
  "photoAsset",
  "photo",
  "dataUrl",
  "id",
]);
const COMPARISON_ROOT_IGNORED_FIELDS = new Set(["name", "email", "phone"]);

function comparisonLabel(key: string) {
  if (LANGUAGE_LABELS[key]) return LANGUAGE_LABELS[key];
  if (COMPARISON_LABELS[key]) return COMPARISON_LABELS[key];
  const spaced = key.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toLocaleUpperCase("fr") + spaced.slice(1);
}

function comparisonText(value: unknown) {
  if (value === null || value === undefined || value === "") return "Vide";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenComparableProfile(profile: ClientProfile) {
  const flattened = new Map<string, { label: string; value: string }>();

  const visit = (value: unknown, keySegments: string[], labelSegments: string[]): void => {
    if (Array.isArray(value)) {
      if (!value.length) {
        flattened.set(keySegments.join("."), {
          label: labelSegments.join(" › "),
          value: "Vide",
        });
        return;
      }
      if (value.every((item) => item === null || typeof item !== "object")) {
        flattened.set(keySegments.join("."), {
          label: labelSegments.join(" › "),
          value: value.map(comparisonText).join("\n"),
        });
        return;
      }
      value.forEach((item, index) => {
        if (!item || typeof item !== "object") return;
        const record = item as Record<string, unknown>;
        const identity = comparisonText(record.id ?? index + 1);
        const itemLabel = comparisonText(
          record.titre ??
            record.label ??
            record.institution ??
            record.employeur ??
            `Élément ${index + 1}`,
        );
        visit(record, [...keySegments, identity], [...labelSegments, itemLabel]);
      });
      return;
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>).filter(
        ([key]) =>
          !COMPARISON_IGNORED_FIELDS.has(key) &&
          !(keySegments.length === 0 && COMPARISON_ROOT_IGNORED_FIELDS.has(key)),
      );
      if (!entries.length && keySegments.length) {
        flattened.set(keySegments.join("."), {
          label: labelSegments.join(" › "),
          value: "Vide",
        });
      }
      entries.forEach(([key, child]) =>
        visit(child, [...keySegments, key], [...labelSegments, comparisonLabel(key)]),
      );
      return;
    }
    flattened.set(keySegments.join("."), {
      label: labelSegments.join(" › "),
      value: comparisonText(value),
    });
  };

  visit(profile, [], []);
  return flattened;
}

function compareProfiles(before: ClientProfile, after: ClientProfile): ProfileDifference[] {
  const beforeFields = flattenComparableProfile(before);
  const afterFields = flattenComparableProfile(after);
  return [...new Set([...beforeFields.keys(), ...afterFields.keys()])]
    .map((key) => ({
      key,
      label: afterFields.get(key)?.label || beforeFields.get(key)?.label || key,
      before: beforeFields.get(key)?.value || "Vide",
      after: afterFields.get(key)?.value || "Vide",
    }))
    .filter((difference) => difference.before !== difference.after)
    .sort((left, right) => left.label.localeCompare(right.label, "fr"));
}

export function ClientDatabaseDialog({
  open,
  onOpenChange,
  user,
  activeProfileId,
  onOpenProfile,
  onDownloadPdf,
  onSyncStatusChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SessionUser;
  activeProfileId: string | null;
  onOpenProfile: (profile: ClientProfile) => void;
  onDownloadPdf: (profile: ClientProfile) => Promise<void>;
  onSyncStatusChange?: (status: ClientSyncStatus) => void;
}) {
  const [profiles, setProfiles] = useState<ClientProfileSummary[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [conflictIds, setConflictIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [ownerFilter, setOwnerFilter] = useState<"all" | "created" | "updated" | "involved">("all");
  const [pagination, setPagination] = useState<CloudProfilePagination>(EMPTY_PAGINATION);
  const [indexSource, setIndexSource] = useState<"d1" | "r2" | "r2-backfill" | "local">("local");
  const [historyProfileId, setHistoryProfileId] = useState<string | null>(null);
  const [historyVersions, setHistoryVersions] = useState<CloudProfileVersion[]>([]);
  const [comparisonFrom, setComparisonFrom] = useState(0);
  const [comparisonTo, setComparisonTo] = useState(0);
  const [profileComparison, setProfileComparison] = useState<ProfileComparison | null>(null);
  const [trashItems, setTrashItems] = useState<TrashedClientProfile[]>([]);
  const [trashRetentionDays, setTrashRetentionDays] = useState(30);
  const [trashLoading, setTrashLoading] = useState(false);
  const pageRequestRef = useRef(0);
  const canWrite = user.permissions.clientsWrite;
  const canDelete = user.permissions.clientsDelete;
  const canRestore = user.permissions.clientsRestore;
  const canDownload = user.permissions.clientsDownload;

  const loadTrash = useCallback(async () => {
    if (!canDelete) return;
    setTrashLoading(true);
    try {
      const trash = await listCloudTrash();
      setTrashItems(trash.items);
      setTrashRetentionDays(trash.retentionDays);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chargement de la corbeille impossible.");
    } finally {
      setTrashLoading(false);
    }
  }, [canDelete]);

  const loadLocalPage = useCallback(async () => {
    const query = search.trim().toLocaleLowerCase("fr");
    const username = user.username.toLocaleLowerCase("fr");
    const matching = (await listClientProfiles()).filter((profile) => {
      const created = profile.createdBy?.username.toLocaleLowerCase("fr") ?? "";
      const updated = profile.updatedBy?.username.toLocaleLowerCase("fr") ?? "";
      if (ownerFilter === "created" && created !== username) return false;
      if (ownerFilter === "updated" && updated !== username) return false;
      if (ownerFilter === "involved" && created !== username && updated !== username) return false;
      if (!query) return true;
      return [
        profile.id,
        profile.name,
        profile.email,
        profile.phone,
        profile.createdBy?.displayName,
        profile.createdBy?.username,
        profile.updatedBy?.displayName,
        profile.updatedBy?.username,
      ].some((value) =>
        String(value ?? "")
          .toLocaleLowerCase("fr")
          .includes(query),
      );
    });
    const totalPages = Math.max(1, Math.ceil(matching.length / CLIENT_PAGE_SIZE));
    const resolvedPage = Math.min(page, totalPages);
    const offset = (resolvedPage - 1) * CLIENT_PAGE_SIZE;
    setProfiles(matching.slice(offset, offset + CLIENT_PAGE_SIZE));
    setPagination({
      page: resolvedPage,
      pageSize: CLIENT_PAGE_SIZE,
      total: matching.length,
      totalPages,
      hasPrevious: resolvedPage > 1,
      hasNext: resolvedPage < totalPages,
    });
    setIndexSource("local");
  }, [ownerFilter, page, search, user.username]);

  const loadPage = useCallback(
    async (automatic = false) => {
      const requestId = ++pageRequestRef.current;
      setBusy("page");
      if (!automatic) setMessage("");
      try {
        const token = getAdminSession();
        if (!token) throw new Error("La session cloud a expiré.");
        const result = await listCloudProfiles(CLIENTS_API_ENDPOINT, token, {
          query: search,
          owner: ownerFilter,
          page,
          pageSize: CLIENT_PAGE_SIZE,
        });
        if (requestId !== pageRequestRef.current) return;
        setProfiles(result.profiles);
        setPagination(result.pagination ?? EMPTY_PAGINATION);
        setIndexSource(result.indexSource ?? "r2");
        if (result.pagination && result.pagination.page !== page) {
          setPage(result.pagination.page);
        }
        onSyncStatusChange?.({
          state: "synced",
          message: `Index partagé consulté à ${new Date().toLocaleTimeString("fr-DZ")}.`,
        });
      } catch (error) {
        if (requestId !== pageRequestRef.current) return;
        await loadLocalPage();
        onSyncStatusChange?.({
          state: "local",
          message:
            error instanceof Error
              ? `Mode local : ${error.message}`
              : "Mode local : index partagé indisponible.",
        });
        if (!automatic) {
          setMessage(
            error instanceof Error
              ? `Affichage du cache local. ${error.message}`
              : "Affichage du cache local.",
          );
        }
      } finally {
        if (requestId === pageRequestRef.current) setBusy("");
      }
    },
    [loadLocalPage, onSyncStatusChange, ownerFilter, page, search],
  );

  const synchronize = useCallback(async () => {
    if (!canWrite) {
      await loadPage(false);
      setMessage(
        "Index partagé actualisé en lecture seule. Aucun changement local n’a été envoyé.",
      );
      return;
    }
    setBusy("cloud");
    setMessage("");
    onSyncStatusChange?.({ state: "syncing", message: "Synchronisation complète en cours…" });
    try {
      const token = getAdminSession();
      if (!token) throw new Error("La session du compte a expiré. Reconnectez-vous.");
      const result = await synchronizeClientProfiles(CLIENTS_API_ENDPOINT, token);
      await loadPage(true);
      if (result.conflicts) {
        setConflictIds(result.conflictIds);
        const conflictSet = new Set(result.conflictIds);
        const conflictProfiles = (await listClientProfiles()).filter((profile) =>
          conflictSet.has(profile.id),
        );
        setProfiles((current) => [
          ...conflictProfiles,
          ...current.filter((profile) => !conflictSet.has(profile.id)),
        ]);
        onSyncStatusChange?.({
          state: "conflict",
          message: `${result.conflicts} conflit(s) détecté(s). Les versions locales ont été conservées.`,
        });
      } else {
        setConflictIds([]);
        onSyncStatusChange?.({
          state: "synced",
          message: `Base synchronisée à ${new Date().toLocaleTimeString("fr-DZ")}.`,
        });
      }
      setMessage(
        result.conflicts
          ? `Synchronisation partielle : ${result.conflicts} conflit(s) détecté(s). Les versions locales concernées ont été conservées.`
          : `Synchronisation terminée : ${result.uploaded} envoyé(s), ${result.downloaded} récupéré(s), ${result.removed} supprimé(s), ${result.total} profil(s).`,
      );
    } catch (error) {
      await loadLocalPage();
      onSyncStatusChange?.({
        state: "local",
        message:
          error instanceof Error
            ? `Mode local : ${error.message}`
            : "Mode local : base partagée indisponible.",
      });
      setMessage(
        error instanceof Error
          ? `Les données locales restent disponibles. ${error.message}`
          : "Les données locales restent disponibles, mais la base partagée est indisponible.",
      );
    } finally {
      setBusy("");
    }
  }, [canWrite, loadLocalPage, loadPage, onSyncStatusChange]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void loadPage(true), search.trim() ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [loadPage, open, search]);

  useEffect(() => {
    if (open && canDelete) void loadTrash();
  }, [canDelete, loadTrash, open]);

  const resolveProfile = async (summary: ClientProfileSummary) => {
    const local = await getClientProfile(summary.id);
    if (
      local &&
      (local.revision ?? 0) >= (summary.revision ?? 0) &&
      local.updatedAt >= summary.updatedAt
    )
      return local;
    const token = getAdminSession();
    if (!token) throw new Error("Profil local introuvable et session cloud expirée.");
    const cloud = await getCloudProfile(CLIENTS_API_ENDPOINT, token, summary.id);
    await saveClientProfile(cloud);
    return cloud;
  };

  const openProfile = async (summary: ClientProfileSummary) => {
    setBusy(summary.id);
    try {
      const profile = await resolveProfile(summary);
      onOpenProfile(profile);
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ouverture impossible.");
    } finally {
      setBusy("");
    }
  };

  const download = async (summary: ClientProfileSummary) => {
    setBusy(`pdf:${summary.id}`);
    try {
      const profile = await resolveProfile(summary);
      await onDownloadPdf(profile);
      setMessage(`PDF généré pour ${profile.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF impossible à générer.");
    } finally {
      setBusy("");
    }
  };

  const remove = async (profile: ClientProfileSummary) => {
    if (!canDelete) {
      setMessage("Seul un administrateur peut supprimer un profil client.");
      return;
    }
    if (
      !confirm(`Déplacer « ${profile.name} » (${profile.id}) dans la corbeille pendant 30 jours ?`)
    )
      return;
    setBusy(`delete:${profile.id}`);
    try {
      const token = getAdminSession();
      if (!token) throw new Error("La session du compte a expiré. Reconnectez-vous.");
      await deleteCloudProfile(CLIENTS_API_ENDPOINT, token, profile.id);
      await deleteClientProfile(profile.id);
      await Promise.all([loadPage(true), loadTrash()]);
      setMessage("Profil placé dans la corbeille pour 30 jours et retiré des navigateurs.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setBusy("");
    }
  };

  const restoreFromTrash = async (item: TrashedClientProfile) => {
    if (!confirm(`Restaurer « ${item.name} » dans la base clients active ?`)) return;
    setBusy(`trash-restore:${item.id}`);
    setMessage("");
    try {
      const result = await restoreCloudTrashProfile(item.id);
      await saveClientProfile(result.profile);
      await Promise.all([loadPage(true), loadTrash()]);
      setMessage(`« ${item.name} » a été restauré avec une nouvelle révision.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Restauration impossible.");
    } finally {
      setBusy("");
    }
  };

  const purgeFromTrash = async (item: TrashedClientProfile) => {
    const expected = `SUPPRIMER ${item.id}`;
    const confirmation = window.prompt(
      `Cette action efface définitivement le CV, sa photo et son historique. Saisissez exactement :\n${expected}`,
    );
    if (confirmation === null) return;
    setBusy(`trash-purge:${item.id}`);
    setMessage("");
    try {
      await purgeCloudTrashProfile(item.id, confirmation);
      await loadTrash();
      setMessage(`Les données archivées de « ${item.name} » ont été supprimées définitivement.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Suppression définitive impossible.");
    } finally {
      setBusy("");
    }
  };

  const acceptCloudVersion = async (profile: ClientProfileSummary) => {
    if (
      !confirm(
        `Remplacer les changements locaux non synchronisés de « ${profile.name} » par la version partagée ?`,
      )
    )
      return;
    setBusy(`cloud-version:${profile.id}`);
    try {
      const token = getAdminSession();
      if (!token) throw new Error("La session du compte a expiré. Reconnectez-vous.");
      const cloud = await getCloudProfile(CLIENTS_API_ENDPOINT, token, profile.id);
      await saveClientProfile(cloud);
      const remainingConflicts = conflictIds.filter((id) => id !== profile.id);
      setConflictIds(remainingConflicts);
      await loadPage(true);
      if (activeProfileId === profile.id) onOpenProfile(cloud);
      onSyncStatusChange?.({
        state: remainingConflicts.length ? "conflict" : "synced",
        message: remainingConflicts.length
          ? `${remainingConflicts.length} autre(s) conflit(s) restent à résoudre.`
          : `Version partagée ${cloud.revision ?? 0} récupérée.`,
      });
      setMessage(`Version partagée récupérée pour ${profile.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Récupération cloud impossible.");
    } finally {
      setBusy("");
    }
  };

  const publishLocalVersion = async (profile: ClientProfileSummary) => {
    if (!canWrite) {
      setMessage("Votre rôle est limité à la lecture.");
      return;
    }
    if (
      !confirm(
        `Publier volontairement votre version locale de « ${profile.name} » à la place de la version partagée actuelle ?`,
      )
    )
      return;
    setBusy(`publish-local:${profile.id}`);
    try {
      const token = getAdminSession();
      if (!token) throw new Error("La session du compte a expiré. Reconnectez-vous.");
      const [local, cloud] = await Promise.all([
        getClientProfile(profile.id),
        getCloudProfile(CLIENTS_API_ENDPOINT, token, profile.id),
      ]);
      if (!local) throw new Error("Version locale introuvable.");
      const candidate: ClientProfile = {
        ...local,
        revision: cloud.revision ?? 0,
        createdAt: cloud.createdAt,
        createdBy: cloud.createdBy,
        updatedAt: new Date().toISOString(),
      };
      const commit = await putCloudProfile(CLIENTS_API_ENDPOINT, token, candidate);
      const committed = applyCloudCommit(candidate, commit);
      await saveClientProfile(committed);
      const remainingConflicts = conflictIds.filter((id) => id !== profile.id);
      setConflictIds(remainingConflicts);
      await loadPage(true);
      if (activeProfileId === profile.id) onOpenProfile(committed);
      onSyncStatusChange?.({
        state: remainingConflicts.length ? "conflict" : "synced",
        message: remainingConflicts.length
          ? `${remainingConflicts.length} autre(s) conflit(s) restent à résoudre.`
          : `Votre version a été publiée comme révision ${committed.revision ?? 0}.`,
      });
      setMessage(`Votre version locale de ${profile.name} est maintenant la version partagée.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Publication de la version locale impossible.",
      );
    } finally {
      setBusy("");
    }
  };

  const toggleHistory = async (profile: ClientProfileSummary) => {
    if (historyProfileId === profile.id) {
      setHistoryProfileId(null);
      setHistoryVersions([]);
      setProfileComparison(null);
      return;
    }
    setBusy(`history:${profile.id}`);
    setMessage("");
    try {
      const token = getAdminSession();
      if (!token) throw new Error("La session du compte a expiré. Reconnectez-vous.");
      const result = await listCloudProfileVersions(CLIENTS_API_ENDPOINT, token, profile.id);
      setHistoryProfileId(profile.id);
      setHistoryVersions(result.versions);
      const currentRevision = result.currentRevision;
      const previousRevision =
        result.versions.find((version) => version.revision < currentRevision)?.revision ??
        currentRevision;
      setComparisonFrom(previousRevision);
      setComparisonTo(currentRevision);
      setProfileComparison(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Historique impossible à charger.");
    } finally {
      setBusy("");
    }
  };

  const compareHistoryVersions = async (profile: ClientProfileSummary) => {
    if (!comparisonFrom || !comparisonTo || comparisonFrom === comparisonTo) {
      setMessage("Choisissez deux révisions différentes à comparer.");
      return;
    }
    const fromRevision = Math.min(comparisonFrom, comparisonTo);
    const toRevision = Math.max(comparisonFrom, comparisonTo);
    setBusy(`compare:${profile.id}`);
    setMessage("");
    try {
      const token = getAdminSession();
      if (!token) throw new Error("La session du compte a expiré. Reconnectez-vous.");
      const [before, after] = await Promise.all([
        getCloudProfileVersion(CLIENTS_API_ENDPOINT, token, profile.id, fromRevision),
        getCloudProfileVersion(CLIENTS_API_ENDPOINT, token, profile.id, toRevision),
      ]);
      setComparisonFrom(fromRevision);
      setComparisonTo(toRevision);
      setProfileComparison({
        fromRevision,
        toRevision,
        differences: compareProfiles(before.profile, after.profile),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Comparaison impossible.");
    } finally {
      setBusy("");
    }
  };

  const restoreVersion = async (profile: ClientProfileSummary, revision: number) => {
    if (!canRestore) {
      setMessage("Seul un administrateur peut restaurer une ancienne révision.");
      return;
    }
    if (
      !confirm(
        `Restaurer la révision ${revision} de « ${profile.name} » ? La version actuelle restera dans l’historique.`,
      )
    )
      return;
    setBusy(`restore:${profile.id}:${revision}`);
    setMessage("");
    try {
      const token = getAdminSession();
      if (!token) throw new Error("La session du compte a expiré. Reconnectez-vous.");
      const restored = await restoreCloudProfileVersion(
        CLIENTS_API_ENDPOINT,
        token,
        profile.id,
        revision,
        profile.revision ?? 0,
      );
      const cloud = await getCloudProfile(CLIENTS_API_ENDPOINT, token, profile.id);
      await saveClientProfile(cloud);
      if (activeProfileId === profile.id) onOpenProfile(cloud);
      const history = await listCloudProfileVersions(CLIENTS_API_ENDPOINT, token, profile.id);
      setHistoryVersions(history.versions);
      setComparisonFrom(revision);
      setComparisonTo(history.currentRevision);
      setProfileComparison(null);
      await loadPage(true);
      onSyncStatusChange?.({
        state: "synced",
        message: `Révision ${revision} restaurée comme nouvelle révision ${restored.profile.revision}.`,
      });
      setMessage(
        `Révision ${revision} restaurée. La version partagée est maintenant la révision ${restored.profile.revision}.`,
      );
    } catch (error) {
      await loadPage(true);
      setMessage(error instanceof Error ? error.message : "Restauration impossible.");
    } finally {
      setBusy("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> Base de données clients
          </DialogTitle>
          <DialogDescription>
            Recherche et pagination rapides avec Cloudflare D1. Les CV et photos restent stockés
            dans R2 et sont téléchargés uniquement lorsque vous ouvrez une fiche.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <section className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="ID, nom, email, téléphone ou utilisateur"
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Actualiser la base"
                onClick={() => void loadPage(false)}
                disabled={Boolean(busy)}
              >
                <RefreshCw className={busy === "page" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <select
                value={ownerFilter}
                onChange={(event) => {
                  setOwnerFilter(event.target.value as "all" | "created" | "updated" | "involved");
                  setPage(1);
                }}
                className="h-9 rounded-md border bg-background px-3 text-xs font-medium shadow-sm outline-none focus:ring-2 focus:ring-ring"
                aria-label="Filtrer les profils par utilisateur"
              >
                <option value="all">Tous les profils</option>
                <option value="involved">Mes profils associés</option>
                <option value="created">Créés par moi</option>
                <option value="updated">Modifiés par moi</option>
              </select>
              <span className="text-xs text-muted-foreground">
                {pagination.total} profil(s) · page {pagination.page}/{pagination.totalPages}
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border">
              {profiles.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  {busy === "cloud" || busy === "page" ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" /> Chargement de l’index
                      clients…
                    </span>
                  ) : (
                    "Aucun profil ne correspond à cette recherche ou à ce filtre."
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {profiles.map((profile) => (
                    <article
                      key={profile.id}
                      className={`space-y-3 p-4 ${activeProfileId === profile.id ? "bg-primary/5" : "bg-background"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{profile.name || "Profil sans nom"}</h3>
                          <p className="font-mono text-xs text-muted-foreground">{profile.id}</p>
                          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                            Révision serveur {profile.revision ?? 0}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {profile.email || profile.phone || "Coordonnées non renseignées"} · Mis
                            à jour {new Date(profile.updatedAt).toLocaleString("fr-DZ")}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                              <UserRoundPlus className="h-3.5 w-3.5 text-emerald-600" />
                              Créé par {profile.createdBy?.displayName || "non enregistré"}
                              {profile.createdBy?.username
                                ? ` (${profile.createdBy.username})`
                                : ""}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <PencilLine className="h-3.5 w-3.5 text-violet-600" />
                              Modifié par {profile.updatedBy?.displayName || "non enregistré"}
                              {profile.updatedBy?.username
                                ? ` (${profile.updatedBy.username})`
                                : ""}
                            </span>
                          </div>
                        </div>
                        {activeProfileId === profile.id && (
                          <span className="rounded-full bg-primary px-2 py-1 text-[11px] text-primary-foreground">
                            Profil ouvert
                          </span>
                        )}
                        {profile.hasPhoto && (
                          <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700">
                            Photo WebP
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void openProfile(profile)}
                          disabled={Boolean(busy)}
                        >
                          {busy === profile.id && (
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          <ExternalLink className="mr-2 h-4 w-4" />{" "}
                          {canWrite ? "Ouvrir et modifier" : "Ouvrir en lecture"}
                        </Button>
                        {canDownload && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void download(profile)}
                            disabled={Boolean(busy)}
                          >
                            {busy === `pdf:${profile.id}` ? (
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="mr-2 h-4 w-4" />
                            )}
                            Télécharger PDF
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void toggleHistory(profile)}
                          disabled={Boolean(busy)}
                        >
                          {busy === `history:${profile.id}` ? (
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <History className="mr-2 h-4 w-4" />
                          )}
                          Historique
                        </Button>
                        {canDelete && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Supprimer ${profile.name}`}
                            onClick={() => void remove(profile)}
                            disabled={Boolean(busy)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                      {historyProfileId === profile.id && (
                        <section className="space-y-3 rounded-md border bg-slate-50 p-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-800">
                              Timeline des modifications
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Consultez l’auteur de chaque version et comparez précisément les
                              changements.
                            </p>
                          </div>

                          {historyVersions.length > 1 && (
                            <div className="rounded-md border bg-white p-3">
                              <p className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                                <GitCompareArrows className="h-3.5 w-3.5 text-primary" /> Comparer
                                deux révisions
                              </p>
                              <div className="mt-2 grid items-end gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
                                <label className="space-y-1 text-[10px] font-medium text-slate-600">
                                  Version de départ
                                  <select
                                    aria-label="Version de départ"
                                    className="h-8 w-full rounded-md border bg-background px-2 text-xs text-foreground"
                                    value={comparisonFrom}
                                    onChange={(event) => {
                                      setComparisonFrom(Number(event.target.value));
                                      setProfileComparison(null);
                                    }}
                                  >
                                    {historyVersions.map((version) => (
                                      <option key={version.revision} value={version.revision}>
                                        Révision {version.revision}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <span className="hidden pb-2 text-slate-400 sm:block">→</span>
                                <label className="space-y-1 text-[10px] font-medium text-slate-600">
                                  Version d’arrivée
                                  <select
                                    aria-label="Version d’arrivée"
                                    className="h-8 w-full rounded-md border bg-background px-2 text-xs text-foreground"
                                    value={comparisonTo}
                                    onChange={(event) => {
                                      setComparisonTo(Number(event.target.value));
                                      setProfileComparison(null);
                                    }}
                                  >
                                    {historyVersions.map((version) => (
                                      <option key={version.revision} value={version.revision}>
                                        Révision {version.revision}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8"
                                  disabled={Boolean(busy) || comparisonFrom === comparisonTo}
                                  onClick={() => void compareHistoryVersions(profile)}
                                >
                                  {busy === `compare:${profile.id}` ? (
                                    <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <GitCompareArrows className="mr-1.5 h-3.5 w-3.5" />
                                  )}
                                  Comparer
                                </Button>
                              </div>
                            </div>
                          )}

                          {profileComparison && (
                            <section
                              aria-label="Résultat de la comparaison"
                              className="rounded-md border border-sky-200 bg-sky-50/70 p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-sky-950">
                                  Révision {profileComparison.fromRevision} → révision{" "}
                                  {profileComparison.toRevision}
                                </p>
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-sky-800">
                                  {profileComparison.differences.length} changement(s)
                                </span>
                              </div>
                              {profileComparison.differences.length ? (
                                <div className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
                                  {profileComparison.differences.map((difference) => (
                                    <article
                                      key={difference.key}
                                      className="rounded border bg-white p-2"
                                    >
                                      <p className="text-[10px] font-semibold text-slate-700">
                                        {difference.label}
                                      </p>
                                      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                                        <div className="rounded bg-red-50 px-2 py-1.5">
                                          <span className="text-[9px] font-bold uppercase tracking-wide text-red-700">
                                            Avant
                                          </span>
                                          <p className="mt-0.5 whitespace-pre-wrap break-words text-[10px] text-slate-700">
                                            {difference.before}
                                          </p>
                                        </div>
                                        <div className="rounded bg-emerald-50 px-2 py-1.5">
                                          <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                                            Après
                                          </span>
                                          <p className="mt-0.5 whitespace-pre-wrap break-words text-[10px] text-slate-700">
                                            {difference.after}
                                          </p>
                                        </div>
                                      </div>
                                    </article>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-2 rounded bg-white px-3 py-2 text-xs text-slate-600">
                                  Aucun changement de contenu détecté entre ces deux versions.
                                </p>
                              )}
                            </section>
                          )}

                          <div className="space-y-0">
                            {historyVersions.map((version, index) => {
                              const current = version.revision === (profile.revision ?? 0);
                              const oldest = index === historyVersions.length - 1;
                              const eventName = oldest
                                ? "Création du client"
                                : version.restoredFromRevision
                                  ? `Restauration de la révision ${version.restoredFromRevision}`
                                  : "Modification du client";
                              return (
                                <div
                                  key={version.revision}
                                  className="relative border-l-2 border-slate-200 pb-3 pl-4 last:pb-0"
                                >
                                  <span
                                    className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ring-2 ring-slate-50 ${current ? "bg-emerald-500" : "bg-slate-400"}`}
                                  />
                                  <div className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background px-3 py-2 text-xs">
                                    <div>
                                      <span className="font-semibold">
                                        Révision {version.revision}
                                      </span>
                                      {current && (
                                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                          Actuelle
                                        </span>
                                      )}
                                      <p className="mt-0.5 text-[10px] font-medium text-slate-600">
                                        {eventName}
                                      </p>
                                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                                        {new Date(version.updatedAt).toLocaleString("fr-DZ")} ·{" "}
                                        {version.updatedBy?.displayName || "Auteur non enregistré"}
                                      </p>
                                    </div>
                                    {!current && canRestore && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          void restoreVersion(profile, version.revision)
                                        }
                                        disabled={Boolean(busy)}
                                      >
                                        {busy === `restore:${profile.id}:${version.revision}` ? (
                                          <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <RotateCcw className="mr-2 h-3.5 w-3.5" />
                                        )}
                                        Restaurer
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      )}
                      {conflictIds.includes(profile.id) && (
                        <div className="rounded-md border border-red-200 bg-red-50 p-3">
                          <p className="text-xs font-semibold text-red-800">
                            Conflit détecté : aucun changement n’a été écrasé.
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void acceptCloudVersion(profile)}
                              disabled={Boolean(busy)}
                            >
                              {busy === `cloud-version:${profile.id}` && (
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Utiliser la version partagée
                            </Button>
                            {canWrite && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void publishLocalVersion(profile)}
                                disabled={Boolean(busy)}
                              >
                                {busy === `publish-local:${profile.id}` && (
                                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Publier ma version locale
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={Boolean(busy) || !pagination.hasPrevious}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Précédente
              </Button>
              <span className="text-xs font-medium text-muted-foreground">
                Résultats {(pagination.page - 1) * pagination.pageSize + (profiles.length ? 1 : 0)}–
                {(pagination.page - 1) * pagination.pageSize + profiles.length} sur{" "}
                {pagination.total}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPage((current) => current + 1)}
                disabled={Boolean(busy) || !pagination.hasNext}
              >
                Suivante <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </section>

          <aside className="h-fit space-y-3 rounded-lg border bg-muted/30 p-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <CloudCheck className="h-4 w-4 text-sky-600" /> Index D1 + stockage R2
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                D1 recherche uniquement les métadonnées nécessaires. Le CV JSON et sa photo WebP
                sont chargés depuis R2 à l’ouverture, avec protection contre les conflits.
              </p>
              <span className="mt-2 inline-flex rounded-full border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                Source :{" "}
                {indexSource === "d1" ? "D1" : indexSource === "local" ? "cache local" : "R2"}
              </span>
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              Connecté comme {user.displayName} ({user.username}) ·{" "}
              {user.role === "admin"
                ? "administrateur"
                : user.role === "editor"
                  ? "éditeur"
                  : "lecture seule"}
              .{" "}
              {canWrite
                ? "Chaque création et modification est attribuée à ce profil."
                : "Les données cloud peuvent être consultées et téléchargées, sans être modifiées."}
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => void synchronize()}
              disabled={Boolean(busy)}
            >
              {busy === "cloud" ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="mr-2 h-4 w-4" />
              )}
              {canWrite ? "Synchroniser maintenant" : "Actualiser la base"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              {canWrite
                ? "L’index est actualisé automatiquement. Cette synchronisation envoie ou récupère les changements réalisés hors ligne."
                : "L’actualisation récupère l’index cloud sans envoyer les données locales de cet appareil."}
            </p>
            {canDelete && (
              <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                    <ArchiveRestore className="h-4 w-4" /> Corbeille sécurisée
                  </h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {trashItems.length}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900">
                  Conservation pendant {trashRetentionDays} jours. Après ce délai, le CV, sa photo
                  et son historique sont automatiquement purgés.
                </p>
                {trashLoading ? (
                  <p className="flex items-center gap-2 rounded-md bg-white px-3 py-3 text-xs text-slate-600">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Chargement…
                  </p>
                ) : trashItems.length ? (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {trashItems.map((item) => {
                      const daysRemaining = Math.max(
                        0,
                        Math.ceil((Date.parse(item.expiresAt) - Date.now()) / 86_400_000),
                      );
                      return (
                        <article key={item.id} className="rounded-md border bg-white p-3">
                          <p className="truncate text-xs font-semibold" title={item.name}>
                            {item.name}
                          </p>
                          <p className="mt-0.5 font-mono text-[9px] text-slate-500">{item.id}</p>
                          <p className="mt-1 text-[10px] text-slate-600">
                            Supprimé par {item.deletedBy.displayName} · purge dans {daysRemaining} j
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 flex-1 text-[11px]"
                              disabled={Boolean(busy)}
                              onClick={() => void restoreFromTrash(item)}
                            >
                              {busy === `trash-restore:${item.id}` ? (
                                <LoaderCircle className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="mr-1 h-3 w-3" />
                              )}
                              Restaurer
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-600"
                              aria-label={`Supprimer définitivement ${item.name}`}
                              title="Supprimer définitivement"
                              disabled={Boolean(busy)}
                              onClick={() => void purgeFromTrash(item)}
                            >
                              {busy === `trash-purge:${item.id}` ? (
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-md bg-white px-3 py-3 text-center text-xs text-slate-500">
                    La corbeille est vide.
                  </p>
                )}
              </section>
            )}
          </aside>
        </div>

        {message && (
          <div className="rounded-md border bg-background p-3 text-xs" role="status">
            {message}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
