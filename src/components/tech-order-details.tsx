import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { safeTechContactUrl } from "@/lib/tech-renewal-message";

export function TechOrderNote({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!notes.trim()) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="text-xs">
      <p
        dir="auto"
        className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-slate-600 ${expanded ? "" : "line-clamp-2"}`}
      >
        {notes}
      </p>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="mt-1 py-1 font-semibold text-indigo-700"
      >
        {expanded ? "Réduire la note" : "Voir toute la note"}
      </button>
    </div>
  );
}
export function TechOrderClientLink({ client, url }: { client: string; url: string }) {
  const safe = safeTechContactUrl(url);
  if (!safe) return <span className="text-[11px] text-slate-400">Lien non renseigné</span>;
  return (
    <Button asChild size="sm" variant="outline" className="h-8 gap-1 text-xs text-blue-700">
      <a
        href={safe}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ouvrir le profil de ${client}`}
      >
        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        Profil client
      </a>
    </Button>
  );
}
