import { useState } from "react";
import {
  Check,
  Columns3,
  Eye,
  EyeOff,
  LayoutTemplate,
  ListTree,
  Palette,
  PanelRight,
  Scan,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PreviewDockTool = "templates" | "layout" | "organize" | "sections";

export type PreviewDockTemplate = {
  id: string;
  name: string;
};

export type PreviewDockSection = {
  id: string;
  title: string;
  count?: number;
  visible: boolean;
};

type PreviewControlDockProps = {
  templates: readonly PreviewDockTemplate[];
  templateId: string;
  onTemplateChange: (templateId: string) => void;
  focusMode: boolean;
  onFocusModeChange: (focusMode: boolean) => void;
  sections: PreviewDockSection[];
  onNavigateSection: (sectionId: string) => void;
  onSectionVisibilityChange: (sectionId: string, visible: boolean) => void;
  onExpandAllSections: () => void;
  onCollapseAllSections: () => void;
  paletteColors: string[];
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  paletteDisabled?: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  zoomDisabled?: boolean;
};

const MIN_ZOOM = 40;
const MAX_ZOOM = 125;
const ZOOM_STEP = 5;

const dockButtons: Array<{
  id: PreviewDockTool;
  label: string;
  icon: typeof LayoutTemplate;
}> = [
  { id: "templates", label: "Modèles", icon: LayoutTemplate },
  { id: "layout", label: "Mise en page", icon: Columns3 },
  { id: "organize", label: "Organiser", icon: ListTree },
  { id: "sections", label: "Sections et couleurs", icon: Palette },
];

export function PreviewControlDock({
  templates,
  templateId,
  onTemplateChange,
  focusMode,
  onFocusModeChange,
  sections,
  onNavigateSection,
  onSectionVisibilityChange,
  onExpandAllSections,
  onCollapseAllSections,
  paletteColors,
  accentColor,
  onAccentColorChange,
  paletteDisabled = false,
  zoom,
  onZoomChange,
  zoomDisabled = false,
}: PreviewControlDockProps) {
  const [activeTool, setActiveTool] = useState<PreviewDockTool | null>(null);
  const selectedTemplate = templates.find((template) => template.id === templateId);
  const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

  const changeZoom = (nextZoom: number) => {
    onZoomChange(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom)));
  };

  return (
    <div className="relative z-10 flex justify-center px-3 py-3">
      {activeTool && (
        <div
          role="region"
          aria-label={dockButtons.find((button) => button.id === activeTool)?.label}
          className="absolute bottom-full left-1/2 mb-2 max-h-[min(420px,55vh)] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xl shadow-slate-900/15"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              {dockButtons.find((button) => button.id === activeTool)?.label}
            </p>
            <button
              type="button"
              onClick={() => setActiveTool(null)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Fermer le panneau"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {activeTool === "templates" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((template) => {
                const selected = template.id === templateId;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      onTemplateChange(template.id);
                      setActiveTool(null);
                    }}
                    aria-pressed={selected}
                    className={cn(
                      "flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                      selected
                        ? "border-blue-300 bg-blue-50 text-blue-800"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50",
                    )}
                  >
                    <span>{template.name}</span>
                    {selected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {activeTool === "layout" && (
            <div className="space-y-3">
              <p className="text-xs leading-5 text-slate-500">
                La mise en page du PDF reste définie par le modèle sélectionné. Ce réglage modifie
                uniquement l’espace de travail.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onFocusModeChange(false)}
                  aria-pressed={!focusMode}
                  className={cn(
                    "flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition",
                    !focusMode
                      ? "border-blue-300 bg-blue-50 text-blue-800"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  <PanelRight className="h-5 w-5" />
                  Formulaire + aperçu
                </button>
                <button
                  type="button"
                  onClick={() => onFocusModeChange(true)}
                  aria-pressed={focusMode}
                  className={cn(
                    "flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition",
                    focusMode
                      ? "border-blue-300 bg-blue-50 text-blue-800"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  <Scan className="h-5 w-5" />
                  Aperçu large
                </button>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Modèle actif :{" "}
                <span className="font-semibold text-slate-700">{selectedTemplate?.name}</span>
              </div>
            </div>
          )}

          {activeTool === "organize" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onExpandAllSections}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Tout déplier
                </button>
                <button
                  type="button"
                  onClick={onCollapseAllSections}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Tout replier
                </button>
              </div>
              <div className="space-y-1.5">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2"
                  >
                    <button
                      type="button"
                      onClick={() => onNavigateSection(section.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-1 text-left text-sm font-medium text-slate-700"
                    >
                      <span className="truncate">{section.title}</span>
                      {typeof section.count === "number" && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                          {section.count}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSectionVisibilityChange(section.id, !section.visible)}
                      aria-label={`${section.visible ? "Masquer" : "Afficher"} ${section.title}`}
                      aria-pressed={!section.visible}
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        section.visible
                          ? "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          : "bg-rose-50 text-rose-500 hover:bg-rose-100",
                      )}
                    >
                      {section.visible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTool === "sections" && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600">Couleur du modèle</p>
                {paletteDisabled ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                    Europass applique sa propre charte dans l’éditeur officiel.
                  </p>
                ) : (
                  <div
                    className="flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label="Palette du modèle"
                  >
                    {paletteColors.map((color) => {
                      const selected = color.toLowerCase() === accentColor.toLowerCase();
                      return (
                        <button
                          key={color}
                          type="button"
                          className={cn(
                            "h-9 w-9 rounded-full border-2 border-white shadow-sm ring-offset-2 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                            selected && "ring-2 ring-slate-500",
                          )}
                          style={{ backgroundColor: color }}
                          title={color}
                          aria-label={`Couleur ${color}`}
                          aria-pressed={selected}
                          onClick={() => onAccentColorChange(color)}
                        />
                      );
                    })}
                    <label
                      className="relative flex h-9 min-w-28 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600"
                      title="Couleur personnalisée"
                    >
                      <span
                        className="h-5 w-5 rounded-full border border-white shadow"
                        style={{ backgroundColor: accentColor }}
                      />
                      Personnalisée
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(event) => onAccentColorChange(event.target.value)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label="Couleur personnalisée"
                      />
                    </label>
                  </div>
                )}
              </div>
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                Les polices, marges et règles ATS restent celles du modèle sélectionné afin de
                préserver le rendu PDF officiel.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg shadow-slate-900/10 backdrop-blur">
        <div
          className="flex items-center rounded-xl bg-slate-100 p-1"
          role="toolbar"
          aria-label="Outils de l’aperçu"
        >
          {dockButtons.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={activeTool === id}
              onClick={() => setActiveTool((current) => (current === id ? null : id))}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                activeTool === id && "bg-white text-blue-700 shadow-sm",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </button>
          ))}
        </div>

        <div
          className="flex items-center rounded-xl bg-slate-100 p-1"
          role="group"
          aria-label="Zoom de l’aperçu"
        >
          <button
            type="button"
            title="Dézoomer"
            aria-label="Dézoomer"
            disabled={zoomDisabled || clampedZoom <= MIN_ZOOM}
            onClick={() => changeZoom(clampedZoom - ZOOM_STEP)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Réinitialiser le zoom"
            aria-label="Réinitialiser le zoom"
            disabled={zoomDisabled}
            onClick={() => changeZoom(65)}
            className="h-10 min-w-14 rounded-lg px-2 text-xs font-bold text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            {clampedZoom}%
          </button>
          <button
            type="button"
            title="Zoomer"
            aria-label="Zoomer"
            disabled={zoomDisabled || clampedZoom >= MAX_ZOOM}
            onClick={() => changeZoom(clampedZoom + ZOOM_STEP)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
