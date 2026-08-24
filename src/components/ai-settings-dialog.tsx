import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
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

const PROVIDERS: AiProviderId[] = ["gemini", "openrouter"];
const PROVIDER_LABEL: Record<AiProviderId, string> = {
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
};

function usagePercent(connection: AiConnection) {
  if (typeof connection.usage.remotePercent === "number") return connection.usage.remotePercent;
  if (connection.dailyRequestLimit <= 0) return 0;
  return Math.min(100, (connection.usage.requests / connection.dailyRequestLimit) * 100);
}

function linkedSettings(value: AiSettings): AiSettings {
  const seen = new Set<AiProviderId>();
  const connections = [...value.connections]
    .sort((left, right) => left.priority - right.priority)
    .filter((connection) => {
      if (seen.has(connection.provider)) return false;
      seen.add(connection.provider);
      return true;
    });
  for (const provider of PROVIDERS) {
    if (!seen.has(provider)) connections.push(newAiConnection(provider));
  }
  return {
    ...value,
    connections: connections.map((connection, index) => ({ ...connection, priority: index + 1 })),
  };
}

function providerConnection(settings: AiSettings, provider: AiProviderId) {
  return settings.connections.find((connection) => connection.provider === provider);
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
  const [draft, setDraft] = useState(() => linkedSettings(value));
  const [testing, setTesting] = useState<AiProviderId | null>(null);
  const [keyStatus, setKeyStatus] = useState<AiKeyStatus | null>(null);
  const [provider, setProvider] = useState<AiProviderId>("gemini");
  const [keyValue, setKeyValue] = useState("");
  const [keyLabel, setKeyLabel] = useState("Clé Gemini 1");
  const [showKey, setShowKey] = useState(false);
  const [keyBusy, setKeyBusy] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(linkedSettings(structuredClone(value)));
      setMessage(null);
    }
  }, [open, value]);

  const refreshKeyStatus = async () => {
    const next = await getAiKeyStatus();
    setKeyStatus(next);
    return next;
  };

  useEffect(() => {
    if (!open || !canManageKeys) return;
    void refreshKeyStatus().catch((error) =>
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Impossible de lire les clés serveur.",
      }),
    );
  }, [open, canManageKeys]);

  useEffect(() => {
    const nextNumber = (keyStatus?.[provider].managed.length || 0) + 1;
    setKeyLabel(`Clé ${provider === "gemini" ? "Gemini" : "OpenRouter"} ${nextNumber}`);
  }, [provider, keyStatus]);

  const updateConnection = (providerId: AiProviderId, patch: Partial<AiConnection>) =>
    setDraft((current) => {
      const existing = providerConnection(current, providerId);
      if (existing) {
        return {
          ...current,
          connections: current.connections.map((connection) =>
            connection.provider === providerId ? { ...connection, ...patch } : connection,
          ),
        };
      }
      const connection = { ...newAiConnection(providerId), ...patch };
      connection.priority = current.connections.length + 1;
      return { ...current, connections: [...current.connections, connection] };
    });

  const addAndTestKey = async () => {
    if (!keyValue.trim()) return;
    setKeyBusy("add");
    setMessage(null);
    try {
      const selectedModel = providerConnection(draft, provider)?.model;
      const result = await saveAiKey({
        provider,
        key: keyValue.trim(),
        label: keyLabel.trim(),
        mode: "add",
        model: selectedModel,
      });
      const allowed = draft.freeModelsOnly
        ? result.models.filter((model) => model.free)
        : result.models;
      const models = allowed.length ? allowed : result.models;
      const model = models.some((item) => item.id === result.model)
        ? result.model
        : (models[0]?.id ?? result.model);
      updateConnection(provider, {
        enabled: true,
        model,
        models,
        usage: {
          date: new Date().toISOString().slice(0, 10),
          requests: 0,
          tokens: result.tokens,
          lastStatus: "ok",
          lastError: "",
        },
      });
      setKeyValue("");
      setShowKey(false);
      await refreshKeyStatus();
      setMessage({
        ok: true,
        text: `${PROVIDER_LABEL[provider]} validé : génération réussie et ${result.models.length} modèles chargés.`,
      });
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "La clé n’a pas pu être validée.",
      });
    } finally {
      setKeyBusy("");
    }
  };

  const deleteServerKey = async (id: string) => {
    setKeyBusy(`delete-${id}`);
    setMessage(null);
    try {
      await removeAiKey(id);
      await refreshKeyStatus();
      setMessage({ ok: true, text: "Clé supprimée. Les priorités ont été recalculées." });
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Suppression impossible.",
      });
    } finally {
      setKeyBusy("");
    }
  };

  const testProvider = async (providerId: AiProviderId) => {
    const existing = providerConnection(draft, providerId) ?? newAiConnection(providerId);
    setTesting(providerId);
    setMessage(null);
    updateConnection(providerId, {
      usage: { ...existing.usage, lastError: "", lastStatus: undefined },
    });
    try {
      const result = await testAiConnection(existing);
      const allowed = draft.freeModelsOnly
        ? result.models.filter((model) => model.free)
        : result.models;
      const models = allowed.length ? allowed : result.models;
      const model = models.some((item) => item.id === result.model)
        ? result.model
        : (models[0]?.id ?? result.model);
      updateConnection(providerId, { models, model, usage: result.usage, enabled: true });
      setMessage({
        ok: true,
        text: `${PROVIDER_LABEL[providerId]} fonctionne : génération réelle réussie avec ${model}.`,
      });
    } catch (error) {
      updateConnection(providerId, {
        usage: {
          ...existing.usage,
          lastStatus: "error",
          lastError: error instanceof Error ? error.message : "Échec du test",
        },
      });
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Échec du test de génération.",
      });
    } finally {
      setTesting(null);
    }
  };

  const connections = useMemo(
    () => [...draft.connections].sort((left, right) => left.priority - right.priority),
    [draft.connections],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-violet-600" /> Paramètres IA simplifiés
          </DialogTitle>
          <DialogDescription>
            Un seul parcours relie désormais chaque clé à son fournisseur, ses modèles et son test
            de génération.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {["Fournisseur", "Clé sécurisée", "Test + modèles", "Sauvegarde"].map((step, index) => (
            <div
              key={step}
              className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900"
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-600 text-[10px] text-white">
                {index + 1}
              </span>
              <span>{step}</span>
              {index < 3 && <ChevronRight className="ml-auto hidden h-3.5 w-3.5 sm:block" />}
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Les clés sont envoyées par HTTPS, chiffrées AES-GCM dans R2 et ne sont jamais renvoyées
            au navigateur. Le Worker teste une vraie génération avant d’accepter une nouvelle clé.
          </p>
        </div>

        {message && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}
            role="status"
          >
            {message.ok && <CheckCircle2 className="mr-2 inline h-4 w-4" />}
            {message.text}
          </div>
        )}

        {canManageKeys ? (
          <section className="space-y-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-blue-50 p-4">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-violet-950">
                <KeyRound className="h-5 w-5" /> Ajouter et tester une clé
              </h3>
              <p className="mt-1 text-xs text-violet-800">
                La priorité est automatique : clé 1, clé 2, clé 3. En cas de quota ou d’erreur
                temporaire, le Worker essaie immédiatement la suivante.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[0.8fr_1fr_1.4fr_auto] md:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Fournisseur</Label>
                <select
                  className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                  value={provider}
                  onChange={(event) => setProvider(event.target.value as AiProviderId)}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nom</Label>
                <Input
                  value={keyLabel}
                  onChange={(event) => setKeyLabel(event.target.value.slice(0, 80))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Clé API</Label>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    autoComplete="off"
                    className="pr-10"
                    value={keyValue}
                    placeholder={provider === "gemini" ? "AIza… ou AQ.…" : "sk-or-v1-…"}
                    onChange={(event) => setKeyValue(event.target.value.trim())}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-500"
                    aria-label={showKey ? "Masquer la clé" : "Afficher la clé saisie"}
                    onClick={() => setShowKey((current) => !current)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="button"
                className="h-10"
                disabled={!keyValue || !!keyBusy}
                onClick={() => void addAndTestKey()}
              >
                {keyBusy === "add" ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Tester et ajouter
              </Button>
            </div>
          </section>
        ) : (
          <div className="rounded-xl border bg-slate-50 px-4 py-3 text-xs text-slate-600">
            Les clés API sont gérées uniquement par un administrateur. Vous pouvez utiliser les
            modèles déjà activés.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
            <input
              type="checkbox"
              checked={draft.autoRotate}
              onChange={(event) => setDraft({ ...draft, autoRotate: event.target.checked })}
            />
            <span>
              <strong className="block text-blue-950">Auto-switch activé</strong>
              <span className="text-xs text-blue-700">Clé suivante, puis fournisseur suivant</span>
            </span>
          </label>
          <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
            <input
              type="checkbox"
              checked={draft.freeModelsOnly}
              onChange={(event) => setDraft({ ...draft, freeModelsOnly: event.target.checked })}
            />
            <span>
              <strong className="block">Modèles gratuits uniquement</strong>
              <span className="text-xs text-muted-foreground">Filtre appliqué après le test</span>
            </span>
          </label>
        </div>

        <div className="space-y-4">
          {PROVIDERS.map((providerId) => {
            const connection = providerConnection(draft, providerId) ?? newAiConnection(providerId);
            const status = keyStatus?.[providerId];
            const totalKeys = (status?.environmentCount || 0) + (status?.managed.length || 0);
            const priority = connections.findIndex((item) => item.provider === providerId) + 1;
            const percent = usagePercent(connection);
            return (
              <section
                key={providerId}
                className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white">
                      <Server className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{PROVIDER_LABEL[providerId]}</h3>
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800">
                          Priorité auto {priority > 0 ? `#${priority}` : "inactive"}
                        </span>
                        {canManageKeys && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">
                            {totalKeys} clé{totalKeys > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Un modèle pour tout le pool de clés {PROVIDER_LABEL[providerId]}.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={connection.enabled}
                      onChange={(event) =>
                        updateConnection(providerId, { enabled: event.target.checked })
                      }
                    />
                    Actif
                  </label>
                </div>

                {canManageKeys && (
                  <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                    {!!status?.environmentCount && (
                      <div className="flex items-center justify-between text-xs">
                        <span>Secrets Cloudflare protégés</span>
                        <span className="font-medium">{status.environmentCount} clé(s)</span>
                      </div>
                    )}
                    {status?.managed.map((key, index) => (
                      <div
                        key={key.id}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-xs"
                      >
                        <span className="min-w-0 truncate">
                          <strong>#{index + 1}</strong> · {key.label} · ••••{key.last4}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-red-600"
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
                    {!totalKeys && (
                      <p className="text-xs text-amber-700">
                        Aucune clé configurée pour ce fournisseur.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Modèle sélectionné</Label>
                    {connection.models.length ? (
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={connection.model}
                        onChange={(event) =>
                          updateConnection(providerId, { model: event.target.value })
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
                        placeholder="Testez pour charger les modèles"
                        onChange={(event) =>
                          updateConnection(providerId, { model: event.target.value.trim() })
                        }
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Budget local / jour</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100000}
                      value={connection.dailyRequestLimit}
                      onChange={(event) =>
                        updateConnection(providerId, {
                          dailyRequestLimit: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {connection.usage.requests}/{connection.dailyRequestLimit || "∞"} requêtes ·{" "}
                      {connection.usage.tokens.toLocaleString("fr-FR")} jetons
                    </span>
                    <span>{percent.toFixed(0)} %</span>
                  </div>
                  <Progress value={percent} />
                </div>

                {connection.usage.lastStatus === "ok" && (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Génération vérifiée ·{" "}
                    {connection.models.length} modèles disponibles
                  </p>
                )}
                {connection.usage.lastError && (
                  <p className="text-xs text-destructive">{connection.usage.lastError}</p>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testing === providerId || (canManageKeys && totalKeys === 0)}
                  onClick={() => void testProvider(providerId)}
                >
                  {testing === providerId ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Tester la génération et charger les modèles
                </Button>
              </section>
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
              onSave(linkedSettings(draft));
              onOpenChange(false);
            }}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Sauvegarder les modèles et la rotation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
