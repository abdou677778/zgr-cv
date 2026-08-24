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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: AiSettings;
  onSave: (settings: AiSettings) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(structuredClone(value));
    }
  }, [open, value]);

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
            Choisissez les modèles et leur priorité. Les clés privées sont gérées exclusivement par
            Cloudflare et la rotation est automatique lorsqu’un quota est atteint.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Aucune clé API n’est transmise au navigateur, stockée dans localStorage ou publiée sur
              GitHub. Les appels passent par le Worker authentifié.
            </p>
          </div>
        </div>

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
