import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeOwnPassword,
  createManagedUser,
  deleteManagedUser,
  listAuditEntries,
  listManagedUsers,
  resetManagedUserPassword,
  updateManagedUser,
  type AuditEntry,
  type ManagedUser,
} from "@/lib/account-client";
import type { SessionUser } from "@/lib/auth-client";

const eventLabels: Record<string, string> = {
  login: "Connexion",
  user_created: "Profil créé",
  user_updated: "Profil modifié",
  user_deleted: "Profil supprimé",
  password_reset: "Mot de passe réinitialisé",
  password_changed: "Mot de passe modifié",
  ai_key_saved: "Clé IA enregistrée",
  ai_key_deleted: "Clé IA supprimée",
};

function formatDate(value: string | null) {
  if (!value) return "Jamais";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fr-FR");
}

export function AccountSettingsDialog({
  open,
  onOpenChange,
  user,
  onSessionInvalidated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SessionUser;
  onSessionInvalidated: () => void;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [newUser, setNewUser] = useState({ username: "", displayName: "", password: "" });
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [ownPassword, setOwnPassword] = useState({ current: "", next: "", confirm: "" });

  const loadAdminData = useCallback(async () => {
    if (user.role !== "admin") return;
    setLoading(true);
    setMessage(null);
    try {
      const [nextUsers, nextAudit] = await Promise.all([listManagedUsers(), listAuditEntries()]);
      setUsers(nextUsers);
      setAudit(nextAudit);
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Chargement impossible.",
      });
    } finally {
      setLoading(false);
    }
  }, [user.role]);

  useEffect(() => {
    if (open) void loadAdminData();
  }, [open, loadAdminData]);

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (ownPassword.next !== ownPassword.confirm) {
      setMessage({ ok: false, text: "La confirmation du nouveau mot de passe ne correspond pas." });
      return;
    }
    setBusy("own-password");
    setMessage(null);
    try {
      await changeOwnPassword(ownPassword.current, ownPassword.next);
      setMessage({ ok: true, text: "Mot de passe modifié. Reconnexion requise." });
      onOpenChange(false);
      onSessionInvalidated();
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Modification impossible.",
      });
    } finally {
      setBusy("");
    }
  };

  const createProfile = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("create");
    setMessage(null);
    try {
      await createManagedUser(newUser);
      setNewUser({ username: "", displayName: "", password: "" });
      setMessage({ ok: true, text: "Le nouveau profil peut maintenant se connecter." });
      await loadAdminData();
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Création impossible.",
      });
    } finally {
      setBusy("");
    }
  };

  const saveProfile = async (profile: ManagedUser) => {
    setBusy(`save-${profile.username}`);
    setMessage(null);
    try {
      const updated = await updateManagedUser(profile.username, {
        displayName: profile.displayName,
        active: profile.active,
      });
      setUsers((current) =>
        current.map((item) => (item.username === profile.username ? updated : item)),
      );
      setMessage({ ok: true, text: `Profil ${profile.username} mis à jour.` });
      await loadAdminData();
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Mise à jour impossible.",
      });
    } finally {
      setBusy("");
    }
  };

  const resetPassword = async (username: string) => {
    const password = resetPasswords[username] || "";
    setBusy(`password-${username}`);
    setMessage(null);
    try {
      const result = await resetManagedUserPassword(username, password);
      setResetPasswords((current) => ({ ...current, [username]: "" }));
      if (result.logoutRequired) {
        onOpenChange(false);
        onSessionInvalidated();
        return;
      }
      setMessage({ ok: true, text: `Mot de passe de ${username} réinitialisé.` });
      await loadAdminData();
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Réinitialisation impossible.",
      });
    } finally {
      setBusy("");
    }
  };

  const removeProfile = async (username: string) => {
    if (!window.confirm(`Supprimer définitivement le profil « ${username} » ?`)) return;
    setBusy(`delete-${username}`);
    setMessage(null);
    try {
      await deleteManagedUser(username);
      setMessage({ ok: true, text: `Profil ${username} supprimé.` });
      await loadAdminData();
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Suppression impossible.",
      });
    } finally {
      setBusy("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" /> Paramètres du compte
          </DialogTitle>
          <DialogDescription>
            Connecté comme <strong>{user.displayName}</strong> ({user.username}) · rôle {user.role}.
          </DialogDescription>
        </DialogHeader>

        {message && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}
            role="status"
          >
            {message.text}
          </div>
        )}

        <section className="space-y-4 rounded-2xl border bg-white p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-violet-600" />
            <h3 className="font-semibold">Modifier mon mot de passe</h3>
          </div>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={changePassword}>
            <div className="space-y-1.5">
              <Label htmlFor="own-current-password">Mot de passe actuel</Label>
              <Input
                id="own-current-password"
                type="password"
                autoComplete="current-password"
                value={ownPassword.current}
                onChange={(event) =>
                  setOwnPassword({ ...ownPassword, current: event.target.value })
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="own-new-password">Nouveau mot de passe</Label>
              <Input
                id="own-new-password"
                type="password"
                minLength={10}
                autoComplete="new-password"
                value={ownPassword.next}
                onChange={(event) => setOwnPassword({ ...ownPassword, next: event.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="own-confirm-password">Confirmer</Label>
              <Input
                id="own-confirm-password"
                type="password"
                minLength={10}
                autoComplete="new-password"
                value={ownPassword.confirm}
                onChange={(event) =>
                  setOwnPassword({ ...ownPassword, confirm: event.target.value })
                }
                required
              />
            </div>
            <Button className="md:col-span-3 md:w-fit" disabled={busy === "own-password"}>
              {busy === "own-password" && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Modifier et me reconnecter
            </Button>
          </form>
        </section>

        {user.role === "admin" && (
          <>
            <section className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold">Créer un profil utilisateur</h3>
              </div>
              <form className="grid gap-3 md:grid-cols-3" onSubmit={createProfile}>
                <div className="space-y-1.5">
                  <Label htmlFor="new-username">Identifiant</Label>
                  <Input
                    id="new-username"
                    value={newUser.username}
                    placeholder="ex. karim"
                    pattern="[a-z0-9][a-z0-9._-]{2,31}"
                    onChange={(event) =>
                      setNewUser({ ...newUser, username: event.target.value.toLowerCase() })
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-display-name">Nom affiché</Label>
                  <Input
                    id="new-display-name"
                    value={newUser.displayName}
                    placeholder="Karim B."
                    onChange={(event) =>
                      setNewUser({ ...newUser, displayName: event.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-user-password">Mot de passe initial</Label>
                  <Input
                    id="new-user-password"
                    type="password"
                    minLength={10}
                    autoComplete="new-password"
                    value={newUser.password}
                    onChange={(event) => setNewUser({ ...newUser, password: event.target.value })}
                    required
                  />
                </div>
                <Button className="md:col-span-3 md:w-fit" disabled={busy === "create"}>
                  {busy === "create" ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  Créer le profil
                </Button>
              </form>
            </section>

            <section className="space-y-4 rounded-2xl border bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-sky-600" />
                  <h3 className="font-semibold">Profils autorisés</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                  {users.length} profils
                </span>
              </div>
              {loading ? (
                <div className="flex items-center py-8 text-sm text-muted-foreground">
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Chargement…
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((profile) => {
                    const isAdmin = profile.role === "admin";
                    return (
                      <div key={profile.username} className="space-y-3 rounded-xl border p-4">
                        <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_auto_auto] lg:items-end">
                          <div>
                            <p className="text-xs text-muted-foreground">Identifiant</p>
                            <p className="font-semibold">{profile.username}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Dernière connexion : {formatDate(profile.lastLoginAt)} ·{" "}
                              {profile.loginCount} connexions
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Nom affiché</Label>
                            <Input
                              value={profile.displayName}
                              onChange={(event) =>
                                setUsers((current) =>
                                  current.map((item) =>
                                    item.username === profile.username
                                      ? { ...item, displayName: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </div>
                          <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
                            <input
                              type="checkbox"
                              checked={profile.active}
                              disabled={isAdmin}
                              onChange={(event) =>
                                setUsers((current) =>
                                  current.map((item) =>
                                    item.username === profile.username
                                      ? { ...item, active: event.target.checked }
                                      : item,
                                  ),
                                )
                              }
                            />{" "}
                            Actif
                          </label>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              title="Sauvegarder le profil"
                              disabled={busy === `save-${profile.username}`}
                              onClick={() => void saveProfile(profile)}
                            >
                              {busy === `save-${profile.username}` ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                            {!isAdmin && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="text-red-600"
                                title="Supprimer le profil"
                                disabled={busy === `delete-${profile.username}`}
                                onClick={() => void removeProfile(profile.username)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {!isAdmin && (
                          <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-end">
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <Label className="text-xs">Nouveau mot de passe</Label>
                              <Input
                                type="password"
                                minLength={10}
                                autoComplete="new-password"
                                value={resetPasswords[profile.username] || ""}
                                onChange={(event) =>
                                  setResetPasswords((current) => ({
                                    ...current,
                                    [profile.username]: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={
                                (resetPasswords[profile.username] || "").length < 10 ||
                                busy === `password-${profile.username}`
                              }
                              onClick={() => void resetPassword(profile.username)}
                            >
                              {busy === `password-${profile.username}` && (
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Réinitialiser
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-4 rounded-2xl border bg-white p-5">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold">Journal des accès et modifications</h3>
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Profil</th>
                      <th className="px-3 py-2">Événement</th>
                      <th className="px-3 py-2">Résultat</th>
                      <th className="px-3 py-2">IP / Pays</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((entry) => (
                      <tr key={entry.id} className="border-t">
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatDate(entry.createdAt)}
                        </td>
                        <td className="px-3 py-2 font-medium">{entry.username}</td>
                        <td className="px-3 py-2">{eventLabels[entry.event] || entry.event}</td>
                        <td className="px-3 py-2">
                          {entry.outcome === "success" ? (
                            <span className="inline-flex items-center text-emerald-700">
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Succès
                            </span>
                          ) : (
                            <span className="text-red-600">Échec</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {entry.ip || "—"} {entry.country ? `· ${entry.country}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!audit.length && (
                  <p className="p-4 text-sm text-muted-foreground">
                    Aucune trace disponible pour le moment.
                  </p>
                )}
              </div>
            </section>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
