import { useEffect,useState } from 'react';
import type { CV } from '@/lib/cv-types';
import { newId } from '@/lib/cv-types';
import { DEFAULT_LANGUAGE_FLAGS, LANGUAGE_CODES, languageName } from '@/lib/language-catalog';
import { LanguageLogoPicker } from './language-logo-picker';
import { Button } from './ui/button';
import { Input } from './ui/input';
type Entries=NonNullable<CV['additional_languages']>;
export function AdditionalLanguagesEditor({entries,onChange,adding,onAddingChange,readLocal}:{entries:Entries;onChange:(entries:Entries)=>void;adding:boolean;onAddingChange:(value:boolean)=>void;readLocal:(file:File)=>Promise<string>}){
  const [query,setQuery]=useState('');
  const [code,setCode]=useState('it');
  const [custom,setCustom]=useState('');
  const choices=LANGUAGE_CODES.filter(value=>!['fr','en','ar','de','es','kab'].includes(value)&&!entries.some(item=>item.code===value));
  useEffect(()=>{if(code!=='custom'&&!choices.includes(code))setCode(choices[0]||'custom');},[code,entries]);
  const filtered=choices.filter(value=>`${languageName(value)} ${value}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const add=()=>{
    if(code==='custom'&&!custom.trim())return;
    if(code!=='custom'&&!choices.includes(code))return;
    onChange([...entries,{id:newId(),code:code==='custom'?'':code,name:code==='custom'?custom.trim():languageName(code),level:'',icon:`country-${DEFAULT_LANGUAGE_FLAGS[code]||'xx'}`}]);
    onAddingChange(false);setCustom('');setQuery('');
  };
  return <div className="mt-4 space-y-3">
    {adding&&<div className="space-y-2 rounded-lg border bg-slate-50 p-3">
      <Input aria-label="Rechercher une langue" placeholder="Rechercher une langue…" value={query} onChange={e=>{setQuery(e.target.value);const match=choices.find(value=>`${languageName(value)} ${value}`.toLocaleLowerCase().includes(e.target.value.toLocaleLowerCase()));setCode(match||'custom');}} />
      <select aria-label="Nouvelle langue" className="w-full rounded border bg-white p-2" value={code} onChange={e=>setCode(e.target.value)}>
        {filtered.map(value=><option key={value} value={value}>{languageName(value)} ({value})</option>)}
        <option value="custom">Autre langue — saisie libre</option>
      </select>
      {code==='custom'&&<Input aria-label="Nom de la nouvelle langue" value={custom} maxLength={100} onChange={e=>setCustom(e.target.value)} />}
      <div className="flex gap-2"><Button type="button" onClick={add}>Ajouter cette langue</Button><Button type="button" variant="outline" onClick={()=>onAddingChange(false)}>Annuler</Button></div>
      <p className="text-xs text-slate-500">Choisissez ensuite le niveau et le drapeau souhaité. Une langue peut être parlée dans plusieurs pays.</p>
    </div>}
    <div className="grid gap-3 sm:grid-cols-2">{entries.map((item,index)=><div key={item.id} className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2"><strong className="text-sm">{item.name}</strong><button type="button" aria-label={`Supprimer la langue ${item.name}`} className="text-xs text-red-600" onClick={()=>onChange(entries.filter(value=>value.id!==item.id))}>Supprimer</button></div>
      <Input aria-label={`Nom de langue ${index+1}`} value={item.name} maxLength={100} onChange={e=>onChange(entries.map(value=>value.id===item.id?{...value,name:e.target.value}:value))} />
      <Input aria-label={`Niveau ${item.name}`} placeholder="Niveau réel de maîtrise" value={item.level} maxLength={80} onChange={e=>onChange(entries.map(value=>value.id===item.id?{...value,level:e.target.value}:value))} />
      <LanguageLogoPicker language={item.name} value={{icon:item.icon,customIconDataUrl:item.customIconDataUrl}} readLocal={readLocal}
        onChange={logo=>onChange(entries.map(value=>value.id===item.id?{...value,icon:logo?.icon,customIconDataUrl:logo?.customIconDataUrl}:value))} />
    </div>)}</div>
    <a className="text-xs text-sky-700" href="/language-flags/catalog.json" target="_blank" rel="noreferrer">Sources et licences des drapeaux SVG</a>
  </div>;
}
