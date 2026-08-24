import { useEffect, useRef, useState } from "react";
import { BookOpenText, Check, Copy, Download, FileText } from "lucide-react";
import masterPrompt from "../../PROMPT_MAITRE_CV_JSON_7_LANGUES.txt?raw";
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

const PROMPT_FILE_NAME = "PROMPT_MAITRE_CV_JSON_7_LANGUES.txt";
const PROMPT_START_MARKER = "RÔLE ET OBJECTIF UNIQUE";
const PROMPT_END_MARKER = "FIN DU PROMPT À COPIER";

function getOperationalPrompt(source: string) {
  const startIndex = source.indexOf(PROMPT_START_MARKER);
  if (startIndex === -1) return source.trim();

  const endMarkerIndex = source.indexOf(PROMPT_END_MARKER, startIndex);
  const endLineIndex = endMarkerIndex === -1 ? -1 : source.lastIndexOf("\n", endMarkerIndex);
  const endIndex = endLineIndex >= startIndex ? endLineIndex : endMarkerIndex;
  const content = endIndex === -1 ? source.slice(startIndex) : source.slice(startIndex, endIndex);
  return content.trimEnd();
}

const operationalPrompt = getOperationalPrompt(masterPrompt);

function fallbackCopy(value: string) {
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Copie refusée par le navigateur.");
}

export function PromptMasterDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setCopied(false);
      setMessage("");
    }
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, [open]);

  const copyPrompt = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(operationalPrompt);
      else fallbackCopy(operationalPrompt);
      setCopied(true);
      setMessage("Prompt maître copié intégralement dans le presse-papiers.");
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 2500);
    } catch {
      try {
        fallbackCopy(operationalPrompt);
        setCopied(true);
        setMessage("Prompt maître copié intégralement dans le presse-papiers.");
      } catch {
        setMessage("Copie automatique indisponible : sélectionnez le texte puis copiez-le.");
      }
    }
  };

  const downloadPrompt = () => {
    const blob = new Blob([operationalPrompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = PROMPT_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`Téléchargement lancé : ${PROMPT_FILE_NAME}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BookOpenText className="h-5 w-5 text-amber-600" /> Prompte maître CV + JSON
          </DialogTitle>
          <DialogDescription>
            Copiez le prompt complet dans ChatGPT, Gemini ou un autre assistant, ou téléchargez le
            fichier texte original en UTF-8.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900">
            <FileText className="mr-1 inline h-3.5 w-3.5" /> {PROMPT_FILE_NAME}
          </span>
          <span>{operationalPrompt.split(/\r?\n/).length} lignes</span>
          <span>·</span>
          <span>{operationalPrompt.length.toLocaleString("fr-FR")} caractères</span>
        </div>

        <Textarea
          readOnly
          aria-label="Prompt maître complet"
          value={operationalPrompt}
          className="h-[58vh] resize-none whitespace-pre-wrap bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100"
          onFocus={(event) => event.currentTarget.select()}
        />

        {message && (
          <p
            className={`rounded-lg border px-3 py-2 text-xs ${copied ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}
            role="status"
          >
            {copied && <Check className="mr-1.5 inline h-4 w-4" />}
            {message}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void copyPrompt()}>
              {copied ? (
                <Check className="mr-2 h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? "Copié" : "Copier le prompt"}
            </Button>
            <Button type="button" onClick={downloadPrompt}>
              <Download className="mr-2 h-4 w-4" /> Télécharger en TXT
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
