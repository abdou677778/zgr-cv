import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
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
  importAiKeys,
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
  const [bulkKeys, setBulkKeys] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(structuredClone(value));
      setBulkKeys("");
      setBulkMessage("");
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

  const importBulkKeys = () => {
    const result = importAiKeys(bulkKeys, draft.connections);
    if (!result.connections.length) {
      setBulkMessage(
        result.duplicates
          ? "Aucune nouvelle clé : les clés reconnues sont déjà présentes."
          : "Aucune clé Gemini ou OpenRouter valide n’a été reconnue.",
      );
      return;
    }
    setDraft((current) => ({
      ...current,
      connections: [...current.connections, ...result.connections],
    }));
    const details = [
      `${result.connections.length} connexion${result.connections.length > 1 ? "s" : ""} ajoutée${result.connections.length > 1 ? "s" : ""}`,
      result.duplicates ? `${result.duplicates} doublon${result.duplicates > 1 ? "s" : ""}` : "",
      result.ignored
        ? `${result.ignored} valeur${result.ignored > 1 ? "s" : ""} ignorée${result.ignored > 1 ? "s" : ""}`
        : "",
    ].filter(Boolean);
    setBulkMessage(`${details.join(" · ")}. Testez ensuite chaque connexion.`);
    setBulkKeys("");
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
            Configurez plusieurs clés Gemini ou OpenRouter. Les requêtes suivent la priorité et
            basculent automatiquement si une connexion atteint sa limite ou devient indisponible.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Cette application autonome appelle directement les fournisseurs. Les clés mémorisées
              sont conservées dans le stockage local de ce navigateur, sans chiffrement serveur. Ne
              partagez jamais le fichier ou le profil navigateur avec des clés enregistrées.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
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
          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={draft.rememberKeys}
              onChange={(event) => setDraft({ ...draft, rememberKeys: event.target.checked })}
            />
            Mémoriser les clés localement
          </label>
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div>
            <h3 className="text-sm font-semibold">Importer plusieurs clés</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Collez une liste libre : les clés Gemini modernes AQ., Gemini historiques AIza et
              OpenRouter sont détectées, dédupliquées puis transformées en connexions séparées. Le
              champ est vidé immédiatement après l’import.
            </p>
          </div>
          <Textarea
            value={bulkKeys}
            onChange={(event) => {
              setBulkKeys(event.target.value);
              setBulkMessage("");
            }}
            rows={4}
            spellCheck={false}
            autoComplete="off"
            className="font-mono text-xs"
            placeholder={"AQ.…\nAIza…\nsk-or-v1-…"}
            aria-label="Liste de clés API à importer"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" disabled={!bulkKeys.trim()} onClick={importBulkKeys}>
              <KeyRound className="mr-2 h-4 w-4" /> Détecter et ajouter
            </Button>
            {bulkMessage && <p className="text-xs text-muted-foreground">{bulkMessage}</p>}
          </div>
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
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Clé API</Label>
                    <Input
                      type="password"
                      autoComplete="off"
                      value={connection.apiKey}
                      placeholder={
                        connection.provider === "gemini" ? "AQ.… ou AIza…" : "sk-or-v1-…"
                      }
                      onChange={(event) =>
                        updateConnection(connection.id, { apiKey: event.target.value.trim() })
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
                  disabled={testing === connection.id || !connection.apiKey}
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
