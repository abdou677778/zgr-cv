import { Palette } from 'lucide-react';

export function ModelColorControl({colors,value,original,label,originalLabel,customLabel,onChange}:{
  colors:string[];value:string;original:string;label:string;originalLabel:string;customLabel:string;onChange:(color:string)=>void;
}){
  return <div role="group" aria-label={label} title={label}
    className="zgr-control flex h-10 min-w-16 max-w-[280px] flex-1 items-center gap-2 rounded-xl border border-primary/15 px-2 sm:flex-none">
    <Palette aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
    <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]">
      {colors.map(color=>{
        const selected=value.toLowerCase()===color.toLowerCase();
        const name=color.toLowerCase()===original.toLowerCase()?originalLabel:color;
        return <button key={color} type="button" title={name} aria-label={`${label} — ${name}`} aria-pressed={selected}
          className={`h-5 w-5 shrink-0 rounded-full border-2 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected?'border-white ring-1 ring-zinc-500 dark:border-slate-900':'border-white/90 dark:border-slate-800'}`}
          style={{backgroundColor:color}} onClick={()=>onChange(color)} />;
      })}
      <label title={customLabel} className="relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-zinc-400 bg-white dark:bg-slate-900">
        <span aria-hidden="true" className="h-4 w-4 rounded-full" style={{background:'conic-gradient(from 90deg, #ef4444, #f97316, #059669, #0891b2, #8b5cf6, #ef4444)'}} />
        <input type="color" value={value} aria-label={customLabel} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={event=>onChange(event.target.value.toLowerCase())} />
      </label>
    </div>
  </div>;
}
