import { useEffect, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FullPageWorkspace({
  open,
  onOpenChange,
  title,
  description,
  icon,
  iconClassName,
  actions,
  bodyClassName,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  icon: ReactNode;
  iconClassName?: string;
  actions?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const returnHome = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", returnHome);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", returnHome);
    };
  }, [onOpenChange, open]);

  if (!open) return null;
  const titleId = `workspace-${title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <main
      aria-labelledby={titleId}
      className="fixed inset-0 z-[100] flex min-h-0 flex-col overflow-hidden bg-slate-50"
    >
      <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-8">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="w-fit shrink-0 border-slate-300 bg-white font-bold text-slate-800 hover:bg-slate-100"
            onClick={() => onOpenChange(false)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour à l’accueil
          </Button>
          <div className="min-w-0">
            <h1
              id={titleId}
              className="flex items-center gap-2 text-xl font-black text-slate-950 sm:text-2xl"
            >
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700",
                  iconClassName,
                )}
              >
                {icon}
              </span>
              {title}
            </h1>
            <div className="mt-1 text-sm text-slate-600">{description}</div>
          </div>
          {actions && <div className="shrink-0 sm:ml-auto">{actions}</div>}
        </div>
      </header>
      <div className={cn("flex min-h-0 flex-1 flex-col", bodyClassName)}>{children}</div>
    </main>
  );
}
