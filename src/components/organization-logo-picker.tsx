import { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";
import { getCurrentUser } from "@/lib/auth-client";
import type { CompanyLogo } from "@/lib/cv-types";
import { ORGANIZATIONS, loadOrganizationLogos, organizationLogo, organizationLogoUrl, saveOrganizationLogo } from "@/lib/organization-logos";
export function OrganizationLogoPicker({name,logo,onSelect}:{name:string;logo?:CompanyLogo;onSelect:(name:string,logo?:CompanyLogo)=>void}){
  const [query,setQuery]=useState("");const [open,setOpen]=useState(false);const [message,setMessage]=useState("");const [,refresh]=useState(0);
  useEffect(()=>{void loadOrganizationLogos();const update=()=>refresh(v=>v+1);window.addEventListener("zgr-organization-logos",update);return()=>window.removeEventListener("zgr-organization-logos",update);},[]);
  const normalize=(v:string)=>v.normalize("NFD").replace(/\p{Mark}/gu,"").toLowerCase();
  const matches=ORGANIZATIONS.filter(item=>normalize(item.name).includes(normalize(query))).slice(0,15);
  const selected=logo?.catalogId||ORGANIZATIONS.find(item=>normalize(item.name)===normalize(name))?.id;
  const source=selected?organizationLogoUrl(selected):logo?.dataUrl;
  return <div className="space-y-2 rounded-lg border bg-white p-2">
    <p className="text-xs font-medium">Bibliothèque entreprises et établissements</p>
    <div className="flex items-center gap-2">
      <label title="Admin : remplacer ce logo dans le cloud partagé" className="cursor-pointer">
        {source?<img src={source} alt="Logo organisation" className="h-9 w-9 object-contain"/>:<span className="flex h-9 w-9 items-center justify-center rounded border">＋</span>}
        {getCurrentUser()?.role==="admin"&&selected&&<input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={async e=>{const file=e.target.files?.[0];e.currentTarget.value="";if(!file)return;setMessage("Enregistrement cloud…");try{const result=await saveOrganizationLogo(selected,file);onSelect(name,result);setMessage("Logo cloud enregistré");}catch(error){setMessage(String(error));}}}/>}
      </label>
      <Popover open={open} onOpenChange={setOpen}><PopoverAnchor asChild><Input placeholder="Sonatrach, ADE, université…" value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);}}/></PopoverAnchor>
        <PopoverContent align="start" className="z-[100] w-80 max-w-[calc(100vw-24px)] overflow-auto p-1" style={{maxHeight:"min(300px,var(--radix-popover-content-available-height))"}} onOpenAutoFocus={e=>e.preventDefault()} onCloseAutoFocus={e=>e.preventDefault()}>
          {matches.map(item=><button type="button" key={item.id} className="flex w-full items-center gap-2 rounded p-2 text-left text-xs hover:bg-slate-100" onMouseDown={e=>e.preventDefault()} onClick={async()=>{try{const result=await organizationLogo(item.id);onSelect(item.name,result);setQuery(item.name);setOpen(false);setMessage(result?"":"Logo à compléter : sélectionnez ce nom puis cliquez sur ＋ (admin).");}catch{onSelect(item.name);setOpen(false);setMessage("Logo indisponible, vous pouvez le remplacer dans le cloud.");}}}>
            {organizationLogoUrl(item.id)?<img src={organizationLogoUrl(item.id)} alt="" className="h-6 w-6 object-contain"/>:<span className="w-6 text-center">—</span>}{item.name}{item.category==="example"?" · exemple fictif":""}
          </button>)}
          {!matches.length&&<p className="p-2 text-xs">Aucun résultat. Le nom du champ reste libre.</p>}
        </PopoverContent>
      </Popover>
    </div>
    <p className="text-[10px] text-slate-500">Choisissez un nom ; administrateur : cliquez sur le logo pour le remplacer dans le cloud partagé.</p>
    {message&&<p role="status" className="text-xs">{message}</p>}
  </div>;
}
