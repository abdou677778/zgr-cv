import { useState } from "react";
import type { CV } from "@/lib/cv-types";
import { DOCUMENT_LANGUAGES, type DocumentLanguage } from "@/lib/document-language";
import type { AiSettings } from "@/lib/ai-types";
import { runAiJson } from "@/lib/ai-client";
import {
  fullProfileTranslationInput,
  FULL_PROFILE_TRANSLATION_SYSTEM,
  validateFullProfileTranslations,
} from "@/lib/full-profile-translation";

// Local comparison only. These identifiers are deliberately absent from the AI payload.
const comparisonInput = (cv: CV) => ({
  nom_complet: cv.nom_complet,
  email: cv.email,
  telephone: cv.telephone,
  ...fullProfileTranslationInput(cv),
});

export function FullProfileTranslationReview({
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
  onApply: (value: Partial<Record<DocumentLanguage, CV>>, source: DocumentLanguage) => void;
}) {
  const [sourceLanguage, setSourceLanguage] = useState(language);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reviewed, setReviewed] = useState<DocumentLanguage[]>([]);
  const [proposal, setProposal] = useState<{
    snapshot: string;
    documents: Partial<Record<DocumentLanguage, CV>>;
  }>();
  const snapshot = JSON.stringify({ sourceLanguage, documents });
  const source = documents[sourceLanguage];
  const targets = DOCUMENT_LANGUAGES.filter(({ id }) => id !== sourceLanguage);
  const obsolete = !!proposal && proposal.snapshot !== snapshot;
  return (
    <section
      aria-label="Traduction du CV complet"
      className="space-y-3 rounded-xl border border-violet-200 p-4"
    >
      <h3 className="text-sm font-bold">Synchroniser les traductions du CV complet</h3>
      <label className="block text-sm">
        Langue source de référence
        <select
          className="ml-2 rounded border p-2"
          value={sourceLanguage}
          disabled={busy}
          onChange={(event) => {
            setSourceLanguage(event.target.value as DocumentLanguage);
            setConfirmed(false);
            setProposal(undefined);
            setReviewed([]);
          }}
        >
          {DOCUMENT_LANGUAGES.map(({ id, name }) => (
            <option value={id} key={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs">
        Au clic, les textes du CV, de la lettre et du plan professionnel de la langue source sont
        envoyés à votre fournisseur IA configuré. Le nom, l’e-mail, le téléphone, les photos, les
        logos, les réponses aux formulaires officiels et les extensions Europass ne sont pas
        envoyés. Certains textes libres peuvent contenir des données personnelles.
      </p>
      <p className="text-xs text-amber-900">
        Après validation, les six autres versions seront remplacées à partir de cette source, y
        compris leur identité, leurs coordonnées et leurs éléments visuels. Les informations
        présentes seulement dans une autre langue seront remplacées. Les extensions Europass et
        formulaires officiels restent ceux de la source, sans traduction automatique. La langue
        source reste inchangée.
      </p>
      <label className="flex gap-2 text-xs">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        Je confirme que cette source est le bon client, complète et à jour, et j’autorise l’envoi
        des textes à l’IA.
      </label>
      <button
        type="button"
        className="rounded border p-2 text-sm disabled:opacity-50"
        disabled={busy || !confirmed || !source.nom_complet.trim()}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          setProposal(undefined);
          setReviewed([]);
          try {
            const response = await runAiJson<unknown>(
              settings,
              FULL_PROFILE_TRANSLATION_SYSTEM,
              JSON.stringify({
                sourceLanguage,
                targetLanguages: targets.map(({ id }) => id),
                source: fullProfileTranslationInput(source),
              }),
            );
            onSettingsChange(response.nextSettings);
            setProposal({
              snapshot,
              documents: validateFullProfileTranslations(response.data, source, sourceLanguage),
            });
            setMessage(
              "Proposition prête. Vérifiez chaque langue : les contrôles techniques ne certifient pas le sens des traductions.",
            );
          } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Préparation des traductions…" : "Proposer les six traductions"}
      </button>
      {proposal && (
        <div className="space-y-3">
          {targets.map(({ id, name }) => (
            <details key={id} className="rounded border p-2 text-xs">
              <summary>{name} — comparer avant / après</summary>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <h4>Version actuelle</h4>
                  <pre
                    dir={id === "ar" ? "rtl" : "ltr"}
                    className="max-h-80 overflow-auto whitespace-pre-wrap"
                  >
                    {JSON.stringify(comparisonInput(documents[id]), null, 2)}
                  </pre>
                </div>
                <div>
                  <h4>Proposition depuis la source</h4>
                  <pre
                    dir={id === "ar" ? "rtl" : "ltr"}
                    className="max-h-80 overflow-auto whitespace-pre-wrap"
                  >
                    {JSON.stringify(comparisonInput(proposal.documents[id]!), null, 2)}
                  </pre>
                </div>
              </div>
              <label className="mt-2 flex gap-2">
                <input
                  type="checkbox"
                  disabled={obsolete}
                  checked={reviewed.includes(id)}
                  onChange={(event) =>
                    setReviewed((previous) =>
                      event.target.checked
                        ? [...previous, id]
                        : previous.filter((item) => item !== id),
                    )
                  }
                />
                J’ai contrôlé cette langue, ses informations et les éventuelles pertes de contenu.
              </label>
            </details>
          ))}
          {obsolete && (
            <p role="alert" className="text-xs text-red-700">
              Le dossier ou la source a changé. Régénérez la proposition avant application.
            </p>
          )}
          <button
            type="button"
            className="rounded bg-violet-700 p-2 text-sm text-white disabled:opacity-50"
            disabled={obsolete || !confirmed || reviewed.length !== targets.length}
            onClick={() => {
              if (obsolete || !confirmed || reviewed.length !== targets.length) return;
              onApply(proposal.documents, sourceLanguage);
              setProposal(undefined);
              setReviewed([]);
              setMessage(
                "Traductions appliquées au brouillon local. Utilisez Sauvegarder pour enregistrer le dossier. Aucune soumission officielle effectuée.",
              );
            }}
          >
            Valider et remplacer les six versions
          </button>
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
