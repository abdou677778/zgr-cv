import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from './ui/select';

export function CompactToolbarSelect({id,label,prefix,value,options,onValueChange}:{
  id:string;label:string;prefix?:string;value:string;options:ReadonlyArray<{id:string;name:string}>;onValueChange:(value:string)=>void;
}){
  return <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger id={id} aria-label={label}
      className="zgr-control h-10 w-auto min-w-0 max-w-[calc(100vw-2rem)] gap-2 rounded-xl border-primary/15 px-3 font-semibold">
      {prefix&&<span className="shrink-0 text-xs font-medium text-muted-foreground">{prefix}</span>}
      <SelectValue />
    </SelectTrigger>
    <SelectContent position="popper" align="start" sideOffset={4}
      className="max-h-[min(320px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-0 max-w-[calc(100vw-2rem)] rounded-xl border-primary/15 bg-popover shadow-xl">
      {options.map(option=><SelectItem key={option.id} value={option.id}
        className="cursor-pointer items-start rounded-lg py-2 pl-2.5 pr-7 text-xs leading-relaxed data-[state=checked]:bg-primary/10 data-[state=checked]:font-semibold data-[state=checked]:text-primary [&>span:last-child]:whitespace-normal [&>span:last-child]:break-words">
        {option.name}
      </SelectItem>)}
    </SelectContent>
  </Select>;
}
