import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
  listClientProfiles,
  putCloudProfile,
  saveClientProfile,
  synchronizeClientProfiles,
  type ClientProfile,
  type ClientProfileSummary,
} from "@/lib/client-profile-db";
import { CLIENTS_API_ENDPOINT, getAdminSession, type SessionUser } from "@/lib/auth-client";

export type ClientSyncStatus = {
  state: "idle" | "syncing" | "synced" | "local" | "conflict";
  message: string;
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

  const refresh = useCallback(
    async (includeCloud = false, automatic = false) => {
      setBusy(includeCloud ? "cloud" : "refresh");
      setMessage("");
      if (includeCloud) {
        onSyncStatusChange?.({ state: "syncing", message: "Synchronisation en cours…" });
      }
      try {
        setProfiles(await listClientProfiles());
        if (!includeCloud) return;
        const token = getAdminSession();
        if (!token) throw new Error("La session du compte a expiré. Reconnectez-vous.");
        const result = await synchronizeClientProfiles(CLIENTS_API_ENDPOINT, token);
        setProfiles(await listClientProfiles());
        if (result.conflicts) {
          setConflictIds(result.conflictIds);
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
            ? `Synchronisation partielle : ${result.conflicts} conflit(s) détecté(s). Les versions locales concernées ont été conservées pour éviter tout écrasement.`
            : automatic
              ? `Base partagée actualisée : ${result.total} profil(s) disponible(s)${result.removed ? `, ${result.removed} suppression(s) appliquée(s)` : ""}.`
              : `Synchronisation terminée : ${result.uploaded} envoyé(s), ${result.downloaded} récupéré(s), ${result.removed} supprimé(s), ${result.total} profil(s).`,
        );
      } catch (error) {
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
    },
    [onSyncStatusChange],
  );

  useEffect(() => {
    if (open) void refresh(true, true);
  }, [open, refresh]);

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    if (!query) return profiles;
    return profiles.filter((profile) =>
      [
        profile.id,
        profile.name,
        profile.email,
        profile.phone,
        profile.createdBy?.displayName ?? "",
        profile.createdBy?.username ?? "",
        profile.updatedBy?.displayName ?? "",
        profile.updatedBy?.username ?? "",
      ].some((value) => value.toLocaleLowerCase("fr").includes(query)),
    );
  }, [profiles, search]);

  const resolveProfile = async (id: string) => {
    const local = await getClientProfile(id);
    if (local) return local;
    const token = getAdminSession();
    if (!token) throw new Error("Profil local introuvable et session cloud expirée.");
    const cloud = await getCloudProfile(CLIENTS_API_ENDPOINT, token, id);
    await saveClientProfile(cloud);
    return cloud;
  };

  const openProfile = async (id: string) => {
    setBusy(id);
    try {
      const profile = await resolveProfile(id);
      onOpenProfile(profile);
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ouverture impossible.");
    } finally {
      setBusy("");
    }
  };

  const download = async (id: string) => {
    setBusy(`pdf:${id}`);
    try {
      const profile = await resolveProfile(id);
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
      await refresh(false);
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
      setProfiles(await listClientProfiles());
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
      setProfiles(await listClientProfiles());
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
            Base partagée synchronisée avec Cloudflare R2 et mise en cache dans ce navigateur.
            Ouvrez un profil, modifiez-le, puis utilisez Sauvegarder pour mettre à jour la même
            fiche.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <section className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher par ID, nom, email ou téléphone"
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Actualiser la base"
                onClick={() => void refresh(true)}
                disabled={Boolean(busy)}
              >
                <RefreshCw className={busy === "refresh" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </Button>
            </div>

            <div className="overflow-hidden rounded-lg border">
              {filteredProfiles.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  {busy === "cloud" ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" /> Synchronisation de la base
                      partagée…
                    </span>
                  ) : profiles.length ? (
                    "Aucun profil ne correspond à cette recherche."
                  ) : (
                    "Aucun profil enregistré dans la base locale ou partagée. Importez ou remplissez un CV, puis cliquez sur Sauvegarder."
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredProfiles.map((profile) => (
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
                          onClick={() => void openProfile(profile.id)}
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
                          onClick={() => void download(profile.id)}
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
          </section>

          <aside className="h-fit space-y-3 rounded-lg border bg-muted/30 p-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <CloudCheck className="h-4 w-4 text-sky-600" /> Base partagée Cloudflare R2
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Synchronisation bidirectionnelle avec révision serveur. Une modification concurrente
                est signalée et conservée localement au lieu d’écraser silencieusement le travail
                d’un autre utilisateur. Les profils JSON et leurs photos WebP privées sont stockés
                séparément dans R2.
              </p>
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              Connecté comme {user.displayName} ({user.username}). Chaque création et chaque
              modification sont attribuées à ce profil.
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => void refresh(true)}
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
              La base est actualisée automatiquement à chaque ouverture. Les profils restent
              chiffrés en transit via HTTPS.
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
