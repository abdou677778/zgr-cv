import { useEffect, useState } from "react";
import type { CV } from "@/lib/cv-types";
import { getCurrentUser } from "@/lib/auth-client";
import { LANGUAGE_FLAGS } from "@/lib/cv-pro-pdf";
import { LANGUAGE_LOGO_KEYS, loadLanguageLogos, saveLanguageLogo, sharedLanguageLogo, type LanguageLogoKey } from "@/lib/language-logos";
import { FLAG_CATALOG, flagAssetUrl, flagName } from '@/lib/language-catalog';

const names:Record<string,string> = { fr: "Français", en: "Anglais", ar: "Arabe", de: "Allemand", es: "Espagnol", kab: "Kabyle" };
type Selection = NonNullable<CV["language_logos"]>['fr'];
export function LanguageLogoPicker({ language, value, onChange, readLocal }: {
  language: LanguageLogoKey; value: Selection; onChange: (value: Selection) => void;
  readLocal: (file: File) => Promise<string>;
}) {
  const [, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [query,setQuery]=useState('');
  useEffect(() => {
    const update = () => refresh(v => v + 1);
    window.addEventListener("zgr-language-logos", update);
    void loadLanguageLogos();
    return () => window.removeEventListener("zgr-language-logos", update);
  }, []);
  const selected = value?.icon || language;
  const selectedName=names[selected]||flagName(selected);
  const fieldName=names[language]||language;
  const source = value?.customIconDataUrl || sharedLanguageLogo(selected)
    || flagAssetUrl(selected)
    || `data:image/svg+xml;charset=utf-8,${encodeURIComponent(LANGUAGE_FLAGS[selected as keyof typeof LANGUAGE_FLAGS] || LANGUAGE_FLAGS.fr)}`;
  const admin = getCurrentUser()?.role === "admin";
  return <div className="mt-2 space-y-2">
    <input aria-label={`Rechercher un drapeau ${fieldName}`} className="w-full rounded border p-2 text-xs" placeholder="Rechercher un pays / drapeau…" value={query} onChange={event=>setQuery(event.target.value)} />
    <div className="flex items-center gap-2">
      <label title={admin ? "Remplacer dans la bibliothèque cloud partagée" : "Logo de la langue"} className={admin ? "cursor-pointer" : ""}>
        <img src={source} alt={`Logo ${selectedName}`} className="h-10 w-10 rounded border bg-white p-1 object-contain" />
        {admin && <input type="file" className="sr-only" disabled={busy}
          aria-label={`Remplacer le logo cloud ${selectedName}`}
          accept="image/svg+xml,image/png,image/webp,image/jpeg" onChange={async event => {
            const file = event.target.files?.[0]; event.currentTarget.value = "";
            if (!file) return;
            setBusy(true); setMessage("");
            try { await saveLanguageLogo(selected, file); onChange({ icon: selected }); setMessage("Logo enregistré dans le cloud partagé."); }
            catch (error) { setMessage(error instanceof Error ? error.message : "Échec cloud"); }
            finally { setBusy(false); }
          }} />}
      </label>
      <select aria-label={`Choisir le logo de ${fieldName}`} className="min-w-0 flex-1 rounded border bg-white p-2 text-xs" value={selected}
        onChange={event => onChange({ icon: event.target.value as LanguageLogoKey })}>
        {LANGUAGE_LOGO_KEYS.map(key => <option key={key} value={key}>{names[key]}</option>)}
        <optgroup label="Drapeaux des pays et territoires">
          {FLAG_CATALOG.filter(flag=>`country-${flag.code}`===selected||`${flagName(flag.code)} ${flag.code}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(flag=><option key={flag.code} value={`country-${flag.code}`}>{flagName(flag.code)}</option>)}
        </optgroup>
      </select>
    </div>
    {flagAssetUrl(selected)&&<a className="block text-xs text-sky-700" href={flagAssetUrl(selected)} target="_blank" rel="noreferrer">Ouvrir le drapeau SVG original · Cloudflare R2</a>}
    <label className="block cursor-pointer text-xs text-sky-700">Importer un logo pour ce profil
      <input type="file" className="sr-only" disabled={busy} aria-label={`Importer un logo local ${fieldName}`}
        accept="image/svg+xml,image/png,image/webp" onChange={async event => {
          const file = event.target.files?.[0]; event.currentTarget.value = "";
          if (!file) return;
          setBusy(true); setMessage("");
          try { onChange({ icon: selected, customIconDataUrl: await readLocal(file) }); setMessage("Logo local appliqué au profil."); }
          catch (error) { setMessage(error instanceof Error ? error.message : "Import impossible"); }
          finally { setBusy(false); }
        }} />
    </label>
    {value?.customIconDataUrl && <button type="button" className="text-xs text-sky-700" onClick={() => onChange({ icon: selected })}>Utiliser le logo cloud</button>}
    <p className="text-[10px] text-slate-400">CV PRO International · Local : ce profil uniquement (SVG, PNG, WebP, 150 Ko). {admin && "Cliquez sur le logo pour remplacer sa version cloud partagée (4 Mo max., 256 × 256 automatique)."}</p>
    <p role="status" className="text-xs">{busy ? "Traitement…" : message}</p>
  </div>;
}
