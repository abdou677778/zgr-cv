import { useState } from "react";
import { ExternalLink, StickyNote } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
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
export function TechOrderClientLink({
  client,
  url,
  compact = false,
}: {
  client: string;
  url: string;
  compact?: boolean;
}) {
  const safe = safeTechContactUrl(url);
  if (!safe)
    return compact ? null : <span className="text-[11px] text-slate-400">Lien non renseigné</span>;
  return (
    <Button
      asChild
      size={compact ? "icon" : "sm"}
      variant={compact ? "ghost" : "outline"}
      className={
        compact
          ? "h-8 w-8 shrink-0 text-indigo-600"
          : "h-8 gap-1 whitespace-nowrap text-xs text-blue-700"
      }
    >
      <a
        href={safe}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ouvrir le profil de ${client}`}
      >
        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        {compact ? <span className="sr-only">Profil client</span> : "Profil client"}
      </a>
    </Button>
  );
}
export function TechOrderNoteButton({ client, notes }: { client: string; notes: string }) {
  if (!notes.trim()) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Voir la note de ${client}`}
          title="Voir la note"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-indigo-600 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
        >
          <StickyNote aria-hidden="true" className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="z-[170] w-80 max-w-[calc(100vw-2rem)] rounded-xl p-4"
      >
        <p className="mb-2 text-xs font-semibold text-indigo-700">Note — {client}</p>
        <p
          dir="auto"
          className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700"
        >
          {notes}
        </p>
      </PopoverContent>
    </Popover>
  );
}
