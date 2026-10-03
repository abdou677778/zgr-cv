import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, ExternalLink, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NOC_ENTRIES, NOC_SOURCE_URL, NOC_VERSION } from "@/data/noc-2021-fr";
import type { CanadianNocSelection } from "@/lib/cv-types";

const TEER_LABELS: Record<string, string> = {
  "0": "FEER 0 · Gestion",
  "1": "FEER 1 · Diplôme universitaire généralement requis",
  "2": "FEER 2 · Études postsecondaires ou supervision",
  "3": "FEER 3 · Études postsecondaires courtes ou apprentissage",
  "4": "FEER 4 · Études secondaires ou formation en cours d’emploi",
  "5": "FEER 5 · Démonstration de travail et expérience courte",
};

function selection(code: string, title: string): CanadianNocSelection {
  return {
    code,
    title,
    teer: TEER_LABELS[code[1]] || `FEER ${code[1]}`,
    version: NOC_VERSION,
    sourceUrl: NOC_SOURCE_URL,
  };
}

export function CanadianNocField({
  value,
  jobTitle,
  onChange,
}: {
  value?: CanadianNocSelection;
  jobTitle: string;
  onChange: (value: CanadianNocSelection | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const suggested = useMemo(() => jobTitle.trim(), [jobTitle]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-label={
                value ? `${value.code} ${value.title}` : "Rechercher un code ou un intitulé CNP"
              }
              className="h-auto min-h-10 flex-1 justify-between whitespace-normal text-left font-normal"
            >
              {value ? (
                <span>
                  <strong className="font-black text-slate-950">{value.code}</strong>
                  <span className="ml-2 text-slate-700">{value.title}</span>
                </span>
              ) : (
                <span className="text-slate-500">Rechercher un code ou un intitulé CNP…</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(680px,calc(100vw-2rem))] p-0" align="start">
            <Command>
              <CommandInput
                placeholder={
                  suggested
                    ? `Code CNP ou métier — ex. ${suggested}…`
                    : "Code CNP ou métier — ex. 21232, développeur logiciel…"
                }
              />
              <CommandList className="max-h-80">
                <CommandEmpty>Aucune profession trouvée dans la CNP officielle.</CommandEmpty>
                <CommandGroup heading={`${NOC_VERSION} · ${NOC_ENTRIES.length} groupes de base`}>
                  {NOC_ENTRIES.map((entry) => (
                    <CommandItem
                      key={entry.code}
                      value={`${entry.code} ${entry.title}`}
                      onSelect={() => {
                        onChange(selection(entry.code, entry.title));
                        setOpen(false);
                      }}
                      className="items-start gap-2"
                    >
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          value?.code === entry.code ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <span>
                        <strong className="mr-2 font-black text-slate-950">{entry.code}</strong>
                        <span>{entry.title}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            title="Retirer l’équivalence CNP"
            onClick={() => onChange(undefined)}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {value ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-950">
          <strong>{value.teer}</strong>
          <span className="mx-2 text-red-300">·</span>
          <a
            href={value.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
          >
            {value.version} · source officielle <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-slate-500">
          Sélectionnez l’équivalence professionnelle, sans remplacer le titre libre du CV.
        </p>
      )}
    </div>
  );
}
