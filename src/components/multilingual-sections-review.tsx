import { useState } from "react";
import type { CV } from "@/lib/cv-types";
import type { DocumentLanguage } from "@/lib/document-language";
import { DOCUMENT_LANGUAGES } from "@/lib/document-language";
import type { AiSettings } from "@/lib/ai-types";
import { runAiJson } from "@/lib/ai-client";
import { auditMultilingualDocuments } from "@/lib/multilingual-audit";
import {
  sectionTranslationInput,
  SECTIONS_TRANSLATION_SYSTEM,
  validateSectionTranslations,
  type TranslatableSections,
} from "@/lib/multilingual-sections";

export function MultilingualSectionsReview({
  documents,
  language,
  settings,
  onSettingsChange,
  onApply,
}: {
  documents: Record<DocumentLanguage, CV>;
  language: DocumentLanguage;
  settings: AiSettings;
  onSettingsChange: (value: AiSettings) => void;
  onApply: (value: Record<DocumentLanguage, TranslatableSections>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [proposal, setProposal] = useState<{
    snapshot: string;
    documents: Record<DocumentLanguage, TranslatableSections>;
  }>();
  const audit = auditMultilingualDocuments(documents);
  const snapshot = JSON.stringify(
    DOCUMENT_LANGUAGES.map(({ id }) => sectionTranslationInput(documents[id])),
  );
  return (
    <section className="space-y-3 rounded-xl border border-violet-200 p-4">
      <h3 className="text-sm font-bold">
        Contrôle multilingue — logiciels et sections personnalisées
      </h3>
      <p className="text-xs">
        Les marques restent inchangées. Les titres et descriptions doivent être traduits. Une donnée
        absente des sources reste vide ; aucune information client n’est inventée.
      </p>
      <p role="status" className="text-xs">
        {audit.errors.length} anomalie(s) de couverture et {audit.warnings.length} point(s) de
        traduction à vérifier sur les sept langues. Ce contrôle ne certifie pas la qualité
        linguistique.
      </p>
      {(audit.errors.length > 0 || audit.warnings.length > 0) && (
        <details className="text-xs">
          <summary>Voir les écarts du profil complet</summary>
          <ul className="list-disc pl-4">
            {[...audit.errors, ...audit.warnings].map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-xs text-amber-900">
        Au clic, seuls les logiciels et sections personnalisées de la langue{" "}
        {language.toUpperCase()} sont transmis à votre fournisseur IA configuré. Les traductions
        proposées remplacent ces deux sections dans les sept langues uniquement après votre
        validation.
      </p>
      <button
        type="button"
        className="rounded border p-2 text-sm disabled:opacity-50"
        disabled={
          busy ||
          (!documents[language].logiciels.length && !documents[language].custom_sections.length)
        }
        onClick={async () => {
          setBusy(true);
          setMessage("");
          setProposal(undefined);
          try {
            const source = sectionTranslationInput(documents[language]);
            const response = await runAiJson<unknown>(
              settings,
              SECTIONS_TRANSLATION_SYSTEM,
              JSON.stringify({ sourceLanguage: language, source }),
            );
            onSettingsChange(response.nextSettings);
            const translated = validateSectionTranslations(response.data, source);
            // Retain local/custom logo bytes, which were never transmitted to the AI.
            for (const { id } of DOCUMENT_LANGUAGES)
              translated[id].logiciels = translated[id].logiciels.map((item, index) => ({
                ...documents[language].logiciels[index],
                label: item.label,
              }));
            setProposal({ snapshot, documents: translated });
            setMessage("Proposition prête : contrôler chaque langue avant application.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Traduction…" : "Proposer la traduction de ces sections (7 langues)"}
      </button>
      {proposal && (
        <div className="space-y-2">
          {DOCUMENT_LANGUAGES.map(({ id, name }) => (
            <details key={id} className="text-xs">
              <summary>{name} — proposition</summary>
              <pre className="overflow-auto whitespace-pre-wrap" dir={id === "ar" ? "rtl" : "ltr"}>
                {JSON.stringify(proposal.documents[id], null, 2)}
              </pre>
            </details>
          ))}
          <button
            type="button"
            className="rounded bg-violet-700 p-2 text-sm text-white"
            disabled={proposal.snapshot !== snapshot}
            onClick={() => {
              if (proposal.snapshot !== snapshot) return;
              onApply(proposal.documents);
              setProposal(undefined);
              setMessage(
                "Traductions appliquées au profil local. Aucune sauvegarde MCP ni soumission officielle.",
              );
            }}
          >
            Valider et appliquer ces traductions aux sept langues
          </button>
          {proposal.snapshot !== snapshot && (
            <p className="text-xs text-red-700">
              Les sections ont changé : régénérez une proposition avant application.
            </p>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </section>
  );
}
