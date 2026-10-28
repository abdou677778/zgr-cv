import type { CV } from "@/lib/cv-types";
import { DOCUMENT_LANGUAGES, type DocumentLanguage } from "@/lib/document-language";
import { multilingualProfileStatus } from "@/lib/multilingual-profile";

export function MultilingualProfileStatus({ documents, language }: {
  documents: Record<DocumentLanguage, CV>; language: DocumentLanguage;
}) {
  const status = multilingualProfileStatus(documents);
  const names = (ids: DocumentLanguage[]) => ids.map(id => DOCUMENT_LANGUAGES.find(item => item.id === id)!.name).join(", ");
  if (!status.missing.length && !status.stale.length && !status.conflicts.length && !status.coverage.length) return null;
  return <aside aria-label="État des versions linguistiques" className="mx-auto mt-3 max-w-7xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
    <p role="status" className="font-semibold">
      {status.conflicts.length ? "Identité du dossier à vérifier avant export"
        : status.missing.includes(language) ? "Cette version linguistique est vide"
        : status.stale.includes(language) ? "Cette version est à vérifier après une modification dans une autre langue"
        : "Des versions linguistiques restent à vérifier"}
    </p>
    <details className="mt-1 text-xs">
      <summary>Voir les contrôles multilingues</summary>
      {status.conflicts.map(message => <p key={message}>{message}</p>)}
      {!!status.missing.length && <p>Versions vides : {names(status.missing)}.</p>}
      {!!status.stale.length && <p>Versions à actualiser : {names(status.stale)}.</p>}
      {!!status.coverage.length && <details className="mt-1">
        <summary>{status.coverage.length} écart(s) de contenu entre les versions renseignées</summary>
        <ul className="list-disc pl-4">{status.coverage.slice(0, 20).map(message => <li key={message}>{message}</li>)}</ul>
        {status.coverage.length > 20 && <p>Les 20 premiers écarts sont affichés.</p>}
      </details>}
      <p>La sauvegarde conserve les versions ; elle ne les traduit pas. Aucun contenu n’est remplacé automatiquement. Ce contrôle ne certifie ni l’identité ni la qualité des traductions.</p>
    </details>
  </aside>;
}
