import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  techLogoModes,
  techLogoModeKey,
  validTechLogoMode,
  type TechLogoMode,
} from "@/lib/tech-branding";

export function TechBrandLogoImage({
  mode,
  className = "h-10 w-10",
}: {
  mode: TechLogoMode;
  className?: string;
}) {
  return (
    <img
      src="/branding/zgr-tech-logo.jpg"
      alt="ZGR Tech"
      width={40}
      height={40}
      className={`shrink-0 bg-black object-contain ${mode === "circle" ? "rounded-full" : mode === "rounded" ? "rounded-xl" : "rounded-none"} ${className}`}
    />
  );
}
export function TechBrandLogo() {
  const [mode, setMode] = useState<TechLogoMode>("circle");
  useEffect(() => {
    try {
      setMode(validTechLogoMode(localStorage.getItem(techLogoModeKey)));
    } catch {
      /* Device storage can be disabled. */
    }
  }, []);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Choisir l’affichage du logo ZGR Tech"
          title="Choisir l’affichage du logo"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
        >
          <TechBrandLogoImage mode={mode} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="z-[160] w-64 max-w-[calc(100vw-24px)] rounded-xl p-3"
      >
        <p className="mb-3 text-sm font-bold">Affichage du logo</p>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(techLogoModes).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              className={`flex flex-col items-center gap-2 rounded-xl border p-2 text-center text-[11px] ${mode === value ? "border-amber-500 bg-amber-50 text-amber-950" : "bg-white text-slate-700"}`}
              onClick={() => {
                setMode(value as TechLogoMode);
                try {
                  localStorage.setItem(techLogoModeKey, value);
                } catch {
                  /* Keep the choice for this session. */
                }
              }}
            >
              <TechBrandLogoImage mode={value as TechLogoMode} className="h-12 w-12" />
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Choix propre à cet appareil. L’icône Android est définie dans l’APK.
        </p>
      </PopoverContent>
    </Popover>
  );
}
