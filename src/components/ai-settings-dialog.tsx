import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, LoaderCircle, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  newAiConnection,
  type AiConnection,
  type AiProviderId,
  type AiSettings,
} from "@/lib/ai-types";
import { testAiConnection } from "@/lib/ai-client";
import { getAiKeyStatus, removeAiKey, saveAiKey, type AiKeyStatus } from "@/lib/ai-key-client";

function usagePercent(connection: AiConnection) {
  if (typeof connection.usage.remotePercent === "number") return connection.usage.remotePercent;
  if (connection.dailyRequestLimit <= 0) return 0;
  return Math.min(100, (connection.usage.requests / connection.dailyRequestLimit) * 100);
}

export function AiSettingsDialog({
  open,
  onOpenChange,
  value,
  onSave,
  canManageKeys,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: AiSettings;
  onSave: (settings: AiSettings) => void;
  canManageKeys: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [testing, setTesting] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState<AiKeyStatus | null>(null);
  const [keyDraft, setKeyDraft] = useState<Record<AiProviderId, string>>({
    gemini: "",
    openrouter: "",
  });
  const [keyLabel, setKeyLabel] = useState<Record<AiProviderId, string>>({
    gemini: "Clé Gemini",
    openrouter: "Clé OpenRouter",
  });
  const [keyBusy, setKeyBusy] = useState("");
  const [keyMessage, setKeyMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(structuredClone(value));
    }
  }, [open, value]);

  useEffect(() => {
    if (!open || !canManageKeys) return;
    setKeyMessage(null);
    void getAiKeyStatus()
      .then(setKeyStatus)
      .catch((error) =>
        setKeyMessage({
          ok: false,
          text: error instanceof Error ? error.message : "Impossible de lire les clés serveur.",
        }),
      );
  }, [open, canManageKeys]);

  const refreshKeyStatus = async () => setKeyStatus(await getAiKeyStatus());

  const persistKey = async (provider: AiProviderId, mode: "add" | "replace") => {
    setKeyBusy(`${provider}-${mode}`);
    setKeyMessage(null);
    try {
      await saveAiKey({
        provider,
        key: keyDraft[provider],
        label: keyLabel[provider],
        mode,
      });
      setKeyDraft((current) => ({ ...current, [provider]: "" }));
      await refreshKeyStatus();
      setKeyMessage({
        ok: true,
        text:
          mode === "replace"
            ? `Les clés ${provider} ajoutées depuis l’interface ont été remplacées.`
            : `La clé ${provider} a été chiffrée et ajoutée côté serveur.`,
      });
    } catch (error) {
      setKeyMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Enregistrement de la clé impossible.",
      });
    } finally {
      setKeyBusy("");
    }
  };

  const deleteServerKey = async (id: string) => {
    setKeyBusy(`delete-${id}`);
    setKeyMessage(null);
    try {
      await removeAiKey(id);
      await refreshKeyStatus();
      setKeyMessage({ ok: true, text: "Clé interface supprimée du stockage chiffré." });
    } catch (error) {
      setKeyMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Suppression impossible.",
      });
    } finally {
      setKeyBusy("");
    }
  };

  const updateConnection = (id: string, patch: Partial<AiConnection>) =>
    setDraft((current) => ({
      ...current,
      connections: current.connections.map((connection) =>
        connection.id === id ? { ...connection, ...patch } : connection,
      ),
    }));

  const priorities = useMemo(
    () => [...draft.connections].sort((left, right) => left.priority - right.priority),
    [draft.connections],
  );

  const addConnection = (provider: AiProviderId) => {
    const connection = newAiConnection(provider);
    connection.priority = draft.connections.length + 1;
    setDraft((current) => ({ ...current, connections: [...current.connections, connection] }));
  };

  const test = async (connection: AiConnection) => {
    setTesting(connection.id);
    updateConnection(connection.id, {
      usage: { ...connection.usage, lastError: "", lastStatus: undefined },
    });
    try {
      const result = await testAiConnection(connection);
      const allowedModels = draft.freeModelsOnly
        ? result.models.filter((model) => model.free)
        : result.models;
      updateConnection(connection.id, {
        models: allowedModels.length ? allowedModels : result.models,
        model: result.model,
        usage: result.usage,
      });
    } catch (error) {
      updateConnection(connection.id, {
        usage: {
          ...connection.usage,
          lastStatus: "error",
          lastError: error instanceof Error ? error.message : "Échec du test",
        },
      });
    } finally {
      setTesting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paramètres IA</DialogTitle>
          <DialogDescription>
            Choisissez les modèles et leur priorité. Les clés privées sont conservées côté serveur
            et la rotation est automatique lorsqu’un quota est atteint.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Aucune clé API n’est stockée dans localStorage, renvoyée au navigateur ou publiée sur
              GitHub. Les appels passent par le Worker authentifié.
            </p>
          </div>
        </div>

        {canManageKeys ? (
          <section className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-violet-950">
                <KeyRound className="h-5 w-5" /> Clés API serveur
              </h3>
              <p className="mt-1 text-xs text-violet-800">
                La valeur est envoyée une seule fois par HTTPS, chiffrée AES-GCM dans R2 et jamais
                relue par le navigateur. Les secrets Cloudflare existants restent prioritaires et ne
                peuvent pas être affichés.
              </p>
            </div>
            {keyMessage && (
              <p
                className={`rounded-lg border px-3 py-2 text-xs ${keyMessage.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}
                role="status"
              >
                {keyMessage.text}
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {(["gemini", "openrouter"] as const).map((provider) => {
                const status = keyStatus?.[provider];
                return (
                  <div key={provider} className="space-y-3 rounded-xl border bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold capitalize">{provider}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px]">
                        {(status?.environmentCount || 0) + (status?.managed.length || 0)} clés
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Secrets Cloudflare : {status?.environmentCount ?? "…"} · Ajoutées ici :{" "}
                      {status?.managed.length ?? "…"}
                    </p>
                    {!!status?.managed.length && (
                      <div className="space-y-1.5">
                        {status.managed.map((key) => (
                          <div
                            key={key.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs"
                          >
                            <span className="min-w-0 truncate">
                              {key.label} · ••••{key.last4}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600"
                              aria-label={`Supprimer ${key.label}`}
                              disabled={keyBusy === `delete-${key.id}`}
                              onClick={() => void deleteServerKey(key.id)}
                            >
                              {keyBusy === `delete-${key.id}` ? (
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nom de la clé</Label>
                      <Input
                        value={keyLabel[provider]}
                        onChange={(event) =>
                          setKeyLabel((current) => ({
                            ...current,
                            [provider]: event.target.value.slice(0, 80),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nouvelle clé API</Label>
                      <Input
                        type="password"
                        autoComplete="off"
                        value={keyDraft[provider]}
                        placeholder={provider === "gemini" ? "AIza… ou AQ.…" : "sk-or-v1-…"}
                        onChange={(event) =>
                          setKeyDraft((current) => ({
                            ...current,
                            [provider]: event.target.value.trim(),
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!keyDraft[provider] || !!keyBusy}
                        onClick={() => void persistKey(provider, "add")}
                      >
                        {keyBusy === `${provider}-add` && (
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Ajouter
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!keyDraft[provider] || !!keyBusy}
                        onClick={() => void persistKey(provider, "replace")}
                      >
                        {keyBusy === `${provider}-replace` && (
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Remplacer les clés interface
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="rounded-xl border bg-slate-50 px-4 py-3 text-xs text-slate-600">
            Les clés API sont gérées uniquement par le compte administrateur.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={draft.autoRotate}
              onChange={(event) => setDraft({ ...draft, autoRotate: event.target.checked })}
            />
            Rotation automatique
          </label>
          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={draft.freeModelsOnly}
              onChange={(event) => setDraft({ ...draft, freeModelsOnly: event.target.checked })}
            />
            Modèles gratuits uniquement
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => addConnection("gemini")}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter Gemini
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addConnection("openrouter")}
          >
            <Plus className="mr-2 h-4 w-4" /> Ajouter OpenRouter
          </Button>
        </div>

        {priorities.length === 0 && (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Ajoutez au moins une connexion pour activer les boutons IA.
          </div>
        )}

        <div className="space-y-4">
          {priorities.map((connection) => {
            const percent = usagePercent(connection);
            const localUsage = `${connection.usage.requests}/${connection.dailyRequestLimit || "∞"} requêtes locales aujourd’hui · ${connection.usage.tokens.toLocaleString("fr-FR")} jetons`;
            return (
              <div key={connection.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">{connection.label}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase">
                      {connection.provider}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={connection.enabled}
                        onChange={(event) =>
                          updateConnection(connection.id, { enabled: event.target.checked })
                        }
                      />
                      Active
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Supprimer ${connection.label}`}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          connections: current.connections.filter(
                            (item) => item.id !== connection.id,
                          ),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nom de la connexion</Label>
                    <Input
                      value={connection.label}
                      onChange={(event) =>
                        updateConnection(connection.id, { label: event.target.value.slice(0, 80) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Priorité</Label>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={connection.priority}
                      onChange={(event) =>
                        updateConnection(connection.id, {
                          priority: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Modèle</Label>
                    {connection.models.length ? (
                      <select
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        value={connection.model}
                        onChange={(event) =>
                          updateConnection(connection.id, { model: event.target.value })
                        }
                      >
                        {connection.models.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                            {model.free ? " · gratuit" : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={connection.model}
                        placeholder="Testez la connexion pour charger les modèles"
                        onChange={(event) =>
                          updateConnection(connection.id, { model: event.target.value.trim() })
                        }
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Budget local de requêtes/jour</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100000}
                      value={connection.dailyRequestLimit}
                      onChange={(event) =>
                        updateConnection(connection.id, {
                          dailyRequestLimit: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    />
                  </div>
                  {connection.provider === "openrouter" && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">
                        Ordre des fournisseurs OpenRouter (optionnel)
                      </Label>
                      <Input
                        value={connection.providerOrder}
                        placeholder="google, mistral, deepinfra"
                        onChange={(event) =>
                          updateConnection(connection.id, {
                            providerOrder: event.target.value.slice(0, 240),
                          })
                        }
                      />
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={connection.allowProviderFallbacks}
                          onChange={(event) =>
                            updateConnection(connection.id, {
                              allowProviderFallbacks: event.target.checked,
                            })
                          }
                        />
                        Autoriser les routes de secours OpenRouter
                      </label>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                    <span>{connection.usage.remoteLabel ?? localUsage}</span>
                    <span>{percent.toFixed(0)} %</span>
                  </div>
                  <Progress value={percent} />
                  {connection.provider === "gemini" && (
                    <p className="text-[11px] text-muted-foreground">
                      Estimation locale uniquement. Google applique RPM, TPM et RPD par projet ; la
                      valeur exacte et l’éligibilité gratuite des modèles restent visibles dans
                      Google AI Studio.
                    </p>
                  )}
                </div>

                {connection.usage.lastStatus === "ok" && (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Connexion vérifiée ·{" "}
                    {connection.models.length} modèles chargés
                  </p>
                )}
                {connection.usage.lastError && (
                  <p className="text-xs text-destructive">{connection.usage.lastError}</p>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testing === connection.id}
                  onClick={() => void test(connection)}
                >
                  {testing === connection.id && (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Tester une génération et charger les modèles
                </Button>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Sauvegarder les paramètres
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
