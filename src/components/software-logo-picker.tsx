import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { SOFTWARE_ICON_CATALOG } from "@/lib/software-icons";

export function SoftwareLogoPicker({ value, onSelect }: {
  value: string;
  onSelect: (slug: string, title: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setQuery(SOFTWARE_ICON_CATALOG.find((item) => item.slug === value)?.title || "");
  }, [value]);
  const search = query.toLocaleLowerCase().replace(/\s+/g, "");
  const matches = SOFTWARE_ICON_CATALOG.filter((item) =>
    `${item.title}${item.slug}`.toLocaleLowerCase().replace(/\s+/g, "").includes(search),
  ).slice(0, 12);
  return <div className="relative min-w-0 flex-1">
    <Input value={query} placeholder="Canva, ChatGPT…" role="combobox"
      aria-label="Rechercher un logo de logiciel" aria-expanded={open}
      autoComplete="off" onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
        if (event.key === "Enter" && matches[0]) {
          event.preventDefault(); onSelect(matches[0].slug, matches[0].title);
          setQuery(matches[0].title); setOpen(false);
        }
      }} />
    {open && <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg border bg-white p-1 shadow-lg" role="listbox">
      {matches.map((item) => <button key={item.slug} type="button" role="option"
        aria-selected={item.slug === value}
        className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-slate-100"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => { onSelect(item.slug, item.title); setQuery(item.title); setOpen(false); }}>
        <img src={`/software-icons/${item.slug}.svg`} alt="" className="h-5 w-5 object-contain" />
        {item.title}
      </button>)}
      {!matches.length && <p className="p-2 text-xs text-slate-500">Aucun logo trouvé. Importez votre icône locale.</p>}
    </div>}
  </div>;
}
