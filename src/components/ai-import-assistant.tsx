import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, FileJson, LoaderCircle, Upload } from "lucide-react";
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
import { importCvJson, importCvJsonSet } from "@/lib/cv-json";
import { runAiJson } from "@/lib/ai-client";
import { cvMissingFields, IMPORT_AI_SYSTEM, importAiPrompt } from "@/lib/ai-prompts";

export function AiImportAssistant({
  open,
  onOpenChange,
  language,
  settings,
  onSettingsChange,
  onApply,
  onOpenSettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: DocumentLanguage;
  settings: AiSettings;
  onSettingsChange: (settings: AiSettings) => void;
  onApply: (cv: CV) => void;
  onOpenSettings: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState("");
  const [proposal, setProposal] = useState<CV | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState("");

  useEffect(() => {
    if (!open) return;
    setProposal(null);
    setMissing([]);
    setError("");
    setMeta("");
  }, [open]);

  const loadFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 750_000) {
      setError(
        "Le JSON dépasse 750 Ko. Réduisez-le avant l’analyse IA pour éviter une requête trop volumineuse.",
      );
      return;
    }
    setSource(await file.text());
    setError("");
    setProposal(null);
  };

  const analyze = async () => {
    setLoading(true);
    setError("");
    setProposal(null);
    try {
      const parsed = JSON.parse(source) as unknown;
      let direct: CV | null = null;
      const set = importCvJsonSet(parsed);
      if (set?.documents[language]) direct = set.documents[language]!;
      if (!direct) {
        const root =
          parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
        const legacyBilingual = Boolean(root.CONTENU_FRANCAIS || root.CONTENU_ANGLAIS);
        // The legacy structure contains only FR/EN. Never inject its French
        // branch into another language form without contextual translation.
        if (!legacyBilingual || language === "fr" || language === "en") {
          try {
            direct = importCvJson(
              parsed,
              language === "fr" || language === "en" ? language : "auto",
            ).cv;
          } catch {
            direct = null;
          }
        }
      }
      if (direct) {
        setProposal(direct);
        setMissing(cvMissingFields(direct));
        setMeta("Structure ZGR reconnue localement — aucune donnée envoyée à un fournisseur IA.");
        return;
      }

      const result = await runAiJson<unknown>(
        settings,
        IMPORT_AI_SYSTEM,
        importAiPrompt(language, parsed),
      );
      const mapped = importCvJson(result.data, "auto").cv;
      setProposal(mapped);
      setMissing(cvMissingFields(mapped));
      setMeta(
        `${result.connectionLabel} · ${result.model}${result.tokens ? ` · ${result.tokens} jetons` : ""}`,
      );
      onSettingsChange(result.nextSettings);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "JSON invalide ou réponse IA incompatible.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-600" /> Assistant IA d’import JSON
          </DialogTitle>
          <DialogDescription>
            Collez un JSON de n’importe quelle structure. L’assistant répartit les données vers le
            schéma ZGR de la langue active et détecte les sections essentielles manquantes.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            void loadFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" /> Choisir un JSON
          </Button>
          <span className="self-center text-xs text-muted-foreground">Maximum IA : 750 Ko</span>
        </div>
        <Textarea
          rows={12}
          dir="ltr"
          className="font-mono text-xs"
          placeholder="Collez ici le JSON source…"
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setProposal(null);
          }}
        />

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>
              Si le format n’est pas déjà reconnu par ZGR, son contenu sera envoyé à la connexion IA
              active. Retirez les numéros d’identité, données bancaires et autres secrets avant
              l’analyse.
            </p>
          </div>
        </div>

        {proposal && (
          <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
              <CheckCircle2 className="h-4 w-4" /> Mapping prêt avant application
            </p>
            <p className="text-xs text-emerald-900">
              {proposal.experiences.length} expériences · {proposal.educations.length} diplômes ·{" "}
              {proposal.formations.length} formations ·{" "}
              {proposal.competences.filter(Boolean).length} compétences
            </p>
            <p className="text-[11px] text-emerald-800">{meta}</p>
            {missing.length ? (
              <div className="rounded bg-white/70 p-2 text-xs text-amber-900">
                <strong>Éléments essentiels manquants :</strong> {missing.join(" · ")}
              </div>
            ) : (
              <p className="text-xs text-emerald-800">
                Aucune section essentielle manquante détectée.
              </p>
            )}
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
              Paramètres IA
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading || !source.trim()}
            onClick={() => void analyze()}
          >
            {loading ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileJson className="mr-2 h-4 w-4" />
            )}
            Analyser et dispatcher
          </Button>
          <Button
            type="button"
            disabled={!proposal}
            onClick={() => {
              if (proposal) onApply(proposal);
              onOpenChange(false);
            }}
          >
            Appliquer au formulaire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
