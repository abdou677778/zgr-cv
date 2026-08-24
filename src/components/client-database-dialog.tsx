import { useEffect, useMemo, useState } from "react";
import {
  Cloud,
  Database,
  Download,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteClientProfile,
  getClientProfile,
  listClientProfiles,
  synchronizeClientProfiles,
  type ClientProfile,
  type ClientProfileSummary,
} from "@/lib/client-profile-db";

const SESSION_ENDPOINT_KEY = "zgr-cv-cloud-endpoint";
const SESSION_TOKEN_KEY = "zgr-cv-cloud-token";
const DEFAULT_CLOUD_ENDPOINT =
  (import.meta.env.VITE_ZGR_API_URL as string | undefined)?.trim() || "/api/clients";

export function ClientDatabaseDialog({
  open,
  onOpenChange,
  activeProfileId,
  onOpenProfile,
  onDownloadPdf,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeProfileId: string | null;
  onOpenProfile: (profile: ClientProfile) => void;
  onDownloadPdf: (profile: ClientProfile) => Promise<void>;
}) {
  const [profiles, setProfiles] = useState<ClientProfileSummary[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [endpoint, setEndpoint] = useState(() => {
    if (typeof window === "undefined") return "/api/clients";
    return sessionStorage.getItem(SESSION_ENDPOINT_KEY) || DEFAULT_CLOUD_ENDPOINT;
  });
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(SESSION_TOKEN_KEY) || "";
  });

  const refresh = async () => {
    setBusy("refresh");
    try {
      setProfiles(await listClientProfiles());
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Base locale indisponible.");
    } finally {
      setBusy("");
    }
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    if (!query) return profiles;
    return profiles.filter((profile) =>
      [profile.id, profile.name, profile.email, profile.phone].some((value) =>
        value.toLocaleLowerCase("fr").includes(query),
      ),
    );
  }, [profiles, search]);

  const openProfile = async (id: string) => {
    setBusy(id);
    try {
      const profile = await getClientProfile(id);
      if (!profile) throw new Error("Profil introuvable.");
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
      const profile = await getClientProfile(id);
      if (!profile) throw new Error("Profil introuvable.");
      await onDownloadPdf(profile);
      setMessage(`PDF généré pour ${profile.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF impossible à générer.");
    } finally {
      setBusy("");
    }
  };

  const remove = async (profile: ClientProfileSummary) => {
    if (!confirm(`Supprimer définitivement le profil local « ${profile.name} » (${profile.id}) ?`))
      return;
    setBusy(`delete:${profile.id}`);
    try {
      await deleteClientProfile(profile.id);
      await refresh();
      setMessage("Profil local supprimé. La copie R2 éventuelle n’a pas été supprimée.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setBusy("");
    }
  };

  const synchronize = async () => {
    if (!token.trim()) {
      setMessage("Saisissez le jeton privé configuré sur la fonction Cloudflare.");
      return;
    }
    setBusy("cloud");
    setMessage("");
    try {
      sessionStorage.setItem(SESSION_ENDPOINT_KEY, endpoint.trim());
      sessionStorage.setItem(SESSION_TOKEN_KEY, token.trim());
      const result = await synchronizeClientProfiles(endpoint, token);
      await refresh();
      setMessage(
        `Synchronisation terminée : ${result.uploaded} envoyé(s), ${result.downloaded} récupéré(s), ${result.total} profil(s).`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Synchronisation R2 impossible.");
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
            Profils JSON enregistrés localement par ID. Ouvrez un profil pour le modifier, puis
            utilisez Sauvegarder afin de mettre à jour la même fiche.
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
                onClick={() => void refresh()}
              >
                <RefreshCw className={busy === "refresh" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </Button>
            </div>

            <div className="overflow-hidden rounded-lg border">
              {filteredProfiles.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  {profiles.length
                    ? "Aucun profil ne correspond à cette recherche."
                    : "Aucun profil enregistré. Importez ou remplissez un CV, puis cliquez sur Sauvegarder."}
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
                          <p className="mt-1 text-xs text-muted-foreground">
                            {profile.email || profile.phone || "Coordonnées non renseignées"} · Mis
                            à jour {new Date(profile.updatedAt).toLocaleString("fr-DZ")}
                          </p>
                        </div>
                        {activeProfileId === profile.id && (
                          <span className="rounded-full bg-primary px-2 py-1 text-[11px] text-primary-foreground">
                            Profil ouvert
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
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="h-fit space-y-3 rounded-lg border bg-muted/30 p-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Cloud className="h-4 w-4 text-sky-600" /> Sauvegarde Cloudflare R2
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Synchronisation bidirectionnelle par date de modification. Seuls les JSON sont
                envoyés ; aucun PDF ni aucune clé IA.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Adresse de l’API</Label>
              <Input
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder="/api/clients"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Jeton privé de synchronisation</Label>
              <Input
                type="password"
                value={token}
                autoComplete="off"
                onChange={(event) => setToken(event.target.value)}
                placeholder="Conservé pour cette session uniquement"
              />
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => void synchronize()}
              disabled={busy === "cloud"}
            >
              {busy === "cloud" ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="mr-2 h-4 w-4" />
              )}
              Synchroniser maintenant
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Le jeton est stocké dans sessionStorage et disparaît à la fermeture de l’onglet. En
              mode fichier local, utilisez l’URL HTTPS complète de votre fonction déployée.
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
