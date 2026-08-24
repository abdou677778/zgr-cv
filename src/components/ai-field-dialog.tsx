import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CV } from "@/lib/cv-types";
import type { DocumentLanguage } from "@/lib/document-language";
import type { AiSettings } from "@/lib/ai-types";
import { runAiJson } from "@/lib/ai-client";
import { FIELD_AI_SYSTEM, fieldAiPrompt, type FieldAiResponse } from "@/lib/ai-prompts";

export type AiFieldRequest = {
  label: string;
  value: string;
  onApply: (value: string) => void;
};

const PRESETS = [
  "Reformuler clairement et naturellement",
  "Rendre plus concis et compatible ATS",
  "Corriger l’orthographe et la grammaire",
  "Renforcer avec des verbes d’action sans inventer",
];

export function AiFieldDialog({
  request,
  language,
  cv,
  settings,
  onSettingsChange,
  onClose,
  onOpenSettings,
}: {
  request: AiFieldRequest | null;
  language: DocumentLanguage;
  cv: CV;
  settings: AiSettings;
  onSettingsChange: (settings: AiSettings) => void;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const [instruction, setInstruction] = useState(PRESETS[0]);
  const [proposal, setProposal] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    controllerRef.current?.abort();
    setInstruction(PRESETS[0]);
    setProposal("");
    setSource(request?.value ?? "");
    setError("");
    setMeta("");
  }, [request]);

  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1_000)),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [loading]);

  const generate = async () => {
    if (!request) return;
    if (loading) {
      controllerRef.current?.abort();
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const result = await runAiJson<FieldAiResponse>(
        settings,
        FIELD_AI_SYSTEM,
        fieldAiPrompt(language, request.label, source, instruction, cv),
        { signal: controller.signal },
      );
      if (typeof result.data.value !== "string") throw new Error("Réponse IA incompatible.");
      setProposal(result.data.value);
      setMeta(
        `${result.connectionLabel} · ${result.model}${result.tokens ? ` · ${result.tokens} jetons` : ""}`,
      );
      onSettingsChange(result.nextSettings);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur IA inconnue");
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setLoading(false);
    }
  };

  const closeDialog = () => {
    controllerRef.current?.abort();
    onClose();
  };

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" /> Assistant IA — {request?.label}
          </DialogTitle>
          <DialogDescription>
            L’IA prépare une proposition dans la langue active. La valeur n’est remplacée qu’après
            votre confirmation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Texte à améliorer</p>
            <Textarea rows={4} value={source} onChange={(event) => setSource(event.target.value)} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Instruction</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className="rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                  onClick={() => setInstruction(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <Textarea
              rows={2}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
            />
          </div>
          {proposal && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Proposition modifiable
              </p>
              <Textarea
                rows={5}
                value={proposal}
                onChange={(event) => setProposal(event.target.value)}
              />
              {meta && <p className="mt-1 text-[11px] text-muted-foreground">{meta}</p>}
            </div>
          )}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              {error}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="ml-1 h-auto p-0"
                onClick={onOpenSettings}
              >
                Ouvrir Paramètres IA
              </Button>
            </div>
          )}
          {loading && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Génération en cours depuis {elapsed} s. Une connexion est limitée à 30 s et la
              rotation complète à environ 65 s. Vous pouvez annuler sans modifier le texte.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeDialog}>
            Fermer
          </Button>
          <Button type="button" variant="secondary" onClick={() => void generate()}>
            {loading ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {loading ? `Annuler (${elapsed} s)` : "Générer une proposition"}
          </Button>
          <Button
            type="button"
            disabled={loading || !proposal.trim()}
            onClick={() => {
              request?.onApply(proposal.trim());
              closeDialog();
            }}
          >
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
