import { ExternalLink } from "lucide-react";

export function TechServiceDetails({
  service,
}: {
  service: { name: string; websiteUrl?: string; features?: string };
}) {
  let site = "";
  try {
    const url = new URL(service.websiteUrl || "");
    if (url.protocol === "https:" && !url.username && !url.password) site = url.href;
  } catch {
    /* Legacy services can have no website. */
  }
  return (
    <details className="mt-2 min-w-0 rounded-lg border border-slate-200 bg-slate-50 text-xs">
      <summary
        className="cursor-pointer rounded-lg px-3 py-2 font-medium text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
        aria-label={`Afficher les caractéristiques de ${service.name}`}
      >
        Afficher les caractéristiques
      </summary>
      <div className="max-h-64 space-y-3 overflow-y-auto border-t border-slate-200 p-3">
        <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-700" dir="auto">
          {service.features?.trim() || "Aucune caractéristique renseignée pour cet abonnement."}
        </p>
        {site && (
          <a
            href={site}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-indigo-700 underline"
          >
            Site du service <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </details>
  );
}
