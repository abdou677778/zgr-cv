import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { SOFTWARE_ICON_CATALOG, softwareIconUrl } from "@/lib/software-icons";

export function SoftwareLogoPicker({ value, onSelect }: {
  value: string;
  onSelect: (slug: string, title: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh((value) => value + 1);
    window.addEventListener("zgr-software-logos", update);
    return () => window.removeEventListener("zgr-software-logos", update);
  }, []);
  useEffect(() => {
    setQuery(SOFTWARE_ICON_CATALOG.find((item) => item.slug === value)?.title || "");
  }, [value]);
  const search = query.toLocaleLowerCase().replace(/\s+/g, "");
  const matches = SOFTWARE_ICON_CATALOG.filter((item) =>
    `${item.title}${item.slug}`.toLocaleLowerCase().replace(/\s+/g, "").includes(search),
  ).slice(0, 12);
  return <Popover open={open} onOpenChange={setOpen}><PopoverAnchor asChild><div className="relative min-w-0 flex-1">
    <Input value={query} placeholder="Canva, ChatGPT…" role="combobox"
      aria-label="Rechercher un logo de logiciel" aria-expanded={open}
      autoComplete="off" onFocus={() => setOpen(true)}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
        if (event.key === "Enter" && matches[0]) {
          event.preventDefault(); onSelect(matches[0].slug, matches[0].title);
          setQuery(matches[0].title); setOpen(false);
        }
      }} />
  </div></PopoverAnchor>
    <PopoverContent align="start" sideOffset={6} collisionPadding={12}
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}
      className="z-[100] w-64 max-w-[calc(100vw-24px)] overflow-y-auto p-1"
      style={{ maxHeight: "min(280px, var(--radix-popover-content-available-height))" }}
      role="listbox">
      {matches.map((item) => <button key={item.slug} type="button" role="option"
        aria-selected={item.slug === value}
        className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-slate-100"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => { onSelect(item.slug, item.title); setQuery(item.title); setOpen(false); }}>
        <img src={softwareIconUrl(item.slug)} alt="" className="h-5 w-5 object-contain" />
        {item.title}
      </button>)}
      {!matches.length && <p className="p-2 text-xs text-slate-500">Aucun logo trouvé. Importez votre icône locale.</p>}
    </PopoverContent>
  </Popover>;
}
