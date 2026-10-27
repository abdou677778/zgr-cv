import {LoaderCircle,RefreshCw} from 'lucide-react';
import {Button} from './ui/button';

export function PwaUpdateControl({available,busy,disabled,onActivate}:{available:boolean;busy:boolean;disabled:boolean;onActivate:()=>void}){
  if(!available)return null;
  return <Button type="button" size="sm" disabled={disabled||busy} onClick={onActivate}
    aria-label={busy?'Préparation de la mise à jour':'Mise à jour disponible'}
    title="Votre brouillon est conservé avant l’actualisation."
    className="relative h-7 shrink-0 gap-1.5 rounded-full bg-violet-700 px-2 text-[11px] font-semibold text-white shadow-sm hover:bg-violet-800 focus-visible:ring-violet-400">
    {busy?<LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true"/>:<RefreshCw className="h-3.5 w-3.5" aria-hidden="true"/>}
    <span className="hidden xl:inline">{busy?'Préparation…':'Mise à jour disponible'}</span>
    {!busy&&<span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-300 ring-2 ring-background"/>}
  </Button>;
}
