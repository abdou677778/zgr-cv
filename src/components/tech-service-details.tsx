import { Check, ExternalLink, Info } from "lucide-react";
import { techFeatureItems } from "@/lib/tech-service-features";

export function TechServiceDetails({
  service,
}: {
  service: { name: string; websiteUrl?: string; features?: string };
}) {
  let site = "";
  const items = techFeatureItems(service.features);
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
        {items.length ? (
          <>
            <ul className="space-y-2" aria-label={`Caractéristiques de ${service.name}`}>
              {items
                .filter((item) => !item.note)
                .map((item) => (
                  <li key={item.text} className="flex items-start gap-2">
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                    />
                    <span
                      dir="auto"
                      className="min-w-0 flex-1 break-words leading-relaxed text-slate-700"
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
            </ul>
            {items
              .filter((item) => item.note)
              .map((item) => (
                <p
                  key={item.text}
                  className="flex items-start gap-2 rounded-md bg-indigo-50 p-2 text-[11px] leading-relaxed text-slate-600"
                >
                  <Info
                    aria-hidden="true"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600"
                  />
                  <span dir="auto" className="min-w-0 flex-1 break-words">
                    {item.text}
                  </span>
                </p>
              ))}
          </>
        ) : (
          <p className="leading-relaxed text-slate-500">
            Aucune caractéristique renseignée pour cet abonnement.
          </p>
        )}
        {site && (
          <a
            href={site}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-indigo-700 underline"
          >
            Site / source du fournisseur <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </details>
  );
}
