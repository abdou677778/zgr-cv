import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudCheck,
  Database,
  Download,
  ExternalLink,
  LoaderCircle,
  PencilLine,
  RefreshCw,
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
  getCloudProfile,
  getClientProfile,
  listCloudProfiles,
  listClientProfiles,
  putCloudProfile,
  saveClientProfile,
  synchronizeClientProfiles,
  type ClientProfile,
  type ClientProfileSummary,
  type CloudProfilePagination,
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
  const pageRequestRef = useRef(0);

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
  }, [loadLocalPage, loadPage, onSyncStatusChange]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void loadPage(true), search.trim() ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [loadPage, open, search]);

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
    if (
      !confirm(
        `Supprimer définitivement « ${profile.name} » (${profile.id}) de la base partagée et de tous les navigateurs ?`,
      )
    )
      return;
    setBusy(`delete:${profile.id}`);
    try {
      const token = getAdminSession();
      if (!token) throw new Error("La session du compte a expiré. Reconnectez-vous.");
      await deleteCloudProfile(CLIENTS_API_ENDPOINT, token, profile.id);
      await deleteClientProfile(profile.id);
      await loadPage(true);
      setMessage("Profil supprimé de la base partagée et du cache de ce navigateur.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Suppression impossible.");
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
                          <ExternalLink className="mr-2 h-4 w-4" /> Ouvrir et modifier
                        </Button>
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
                      </div>
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
              Connecté comme {user.displayName} ({user.username}). Chaque création et chaque
              modification sont attribuées à ce profil.
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
              Synchroniser maintenant
            </Button>
            <p className="text-[11px] text-muted-foreground">
              L’index est actualisé automatiquement. Utilisez cette synchronisation complète pour
              envoyer ou récupérer les changements réalisés hors ligne.
            </p>
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
