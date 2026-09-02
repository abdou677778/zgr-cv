import { useEffect, useState } from "react";
import {
  Check,
  Columns3,
  Eye,
  EyeOff,
  LayoutTemplate,
  ListTree,
  PenTool,
  Palette,
  PanelRight,
  Plus,
  RotateCcw,
  Scan,
  Save,
  Trash2,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  newDesignerElement,
  type DesignerFontFamily,
  type DesignerPreset,
  type DesignerTextOverride,
  type DesignerTextTarget,
  type TemplateDesignerSettings,
} from "@/lib/template-designer";

export type PreviewDockTool = "templates" | "layout" | "organize" | "sections" | "designer";
export type PreviewPageLayout = "continuous" | "grid";
export type PreviewSurface = "classic" | "pearl" | "cream" | "blue-mist";

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
  pageLayout: PreviewPageLayout;
  onPageLayoutChange: (layout: PreviewPageLayout) => void;
  sections: PreviewDockSection[];
  onNavigateSection: (sectionId: string) => void;
  onSectionVisibilityChange: (sectionId: string, visible: boolean) => void;
  onExpandAllSections: () => void;
  onCollapseAllSections: () => void;
  onShowAllSections: () => void;
  onHideEmptySections: () => void;
  paletteColors: string[];
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  paletteDisabled?: boolean;
  surface: PreviewSurface;
  onSurfaceChange: (surface: PreviewSurface) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  zoomDisabled?: boolean;
  designerSettings: TemplateDesignerSettings;
  designerFonts: ReadonlyArray<{ id: DesignerFontFamily; label: string }>;
  designerPresets: DesignerPreset[];
  activeDesignerPresetId: string | null;
  onDesignerSettingsChange: (settings: TemplateDesignerSettings) => void;
  onDesignerReset: () => void;
  onCreateDesignerPreset: (name: string) => void;
  onApplyDesignerPreset: (presetId: string) => void;
  onDeleteDesignerPreset: (presetId: string) => void;
  designerSelection: DesignerTextTarget | null;
  selectedTextOverride: DesignerTextOverride | null;
  onDesignerModeChange: (active: boolean) => void;
  onSelectedTextOverrideChange: (patch: Partial<DesignerTextOverride>) => void;
  onSelectedTextReset: () => void;
  onDesignerSelectionClear: () => void;
  designerDisabled?: boolean;
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
  { id: "designer", label: "Designer professionnel", icon: PenTool },
];

function DesignerRange({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <span className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
        {label}
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-blue-600"
      />
    </label>
  );
}

export function PreviewControlDock({
  templates,
  templateId,
  onTemplateChange,
  focusMode,
  onFocusModeChange,
  pageLayout,
  onPageLayoutChange,
  sections,
  onNavigateSection,
  onSectionVisibilityChange,
  onExpandAllSections,
  onCollapseAllSections,
  onShowAllSections,
  onHideEmptySections,
  paletteColors,
  accentColor,
  onAccentColorChange,
  paletteDisabled = false,
  surface,
  onSurfaceChange,
  zoom,
  onZoomChange,
  zoomDisabled = false,
  designerSettings,
  designerFonts,
  designerPresets,
  activeDesignerPresetId,
  onDesignerSettingsChange,
  onDesignerReset,
  onCreateDesignerPreset,
  onApplyDesignerPreset,
  onDeleteDesignerPreset,
  designerSelection,
  selectedTextOverride,
  onDesignerModeChange,
  onSelectedTextOverrideChange,
  onSelectedTextReset,
  onDesignerSelectionClear,
  designerDisabled = false,
}: PreviewControlDockProps) {
  const [activeTool, setActiveTool] = useState<PreviewDockTool | null>(null);
  const [newPresetName, setNewPresetName] = useState("");
  const selectedTemplate = templates.find((template) => template.id === templateId);
  const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

  useEffect(() => {
    onDesignerModeChange(activeTool === "designer" && !designerDisabled);
  }, [activeTool, designerDisabled, onDesignerModeChange]);

  const changeZoom = (nextZoom: number) => {
    onZoomChange(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom)));
  };
  const updateDesigner = <K extends keyof TemplateDesignerSettings>(
    key: K,
    value: TemplateDesignerSettings[K],
  ) => onDesignerSettingsChange({ ...designerSettings, [key]: value });

  const updateExtraElement = (
    elementId: string,
    patch: Partial<TemplateDesignerSettings["extraElements"][number]>,
  ) =>
    updateDesigner(
      "extraElements",
      designerSettings.extraElements.map((element) =>
        element.id === elementId ? { ...element, ...patch } : element,
      ),
    );

  return (
    <div className="relative z-10 flex justify-center px-3 py-3">
      {activeTool && (
        <div
          role="region"
          aria-label={dockButtons.find((button) => button.id === activeTool)?.label}
          className={cn(
            "overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xl shadow-slate-900/15",
            activeTool === "designer"
              ? "fixed inset-x-3 bottom-3 top-24 z-50 max-h-none w-auto sm:left-4 sm:right-auto sm:w-[390px]"
              : "absolute bottom-full left-1/2 mb-2 max-h-[min(420px,55vh)] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2",
          )}
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

          {activeTool === "designer" && (
            <div className="space-y-4">
              {designerDisabled ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                  Le Designer agit sur les modèles PDF internes. Sélectionnez un modèle de CV autre
                  que Europass pour modifier réellement l’aperçu et le fichier exporté.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-bold">
                        <PenTool className="h-4 w-4 text-sky-300" /> Mode Designer
                      </p>
                      <p className="mt-1 text-[11px] text-slate-300">
                        Chaque changement met à jour le PDF réel et se sauvegarde automatiquement.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onDesignerReset}
                      className="flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold transition hover:bg-white/10"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser le modèle
                    </button>
                  </div>

                  <section className="space-y-3 rounded-2xl border-2 border-blue-200 bg-blue-50/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-blue-800">
                          Élément sélectionné dans le PDF
                        </h3>
                        <p className="mt-1 text-[11px] leading-4 text-blue-700/75">
                          Cliquez directement sur un texte encadré en bleu, puis glissez-le pour le
                          déplacer.
                        </p>
                      </div>
                      {designerSelection && (
                        <button
                          type="button"
                          onClick={onDesignerSelectionClear}
                          aria-label="Désélectionner l’élément"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-blue-500 hover:bg-blue-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {!designerSelection ? (
                      <div className="rounded-xl border border-dashed border-blue-300 bg-white/80 px-3 py-5 text-center text-xs font-medium text-blue-700">
                        Aucun élément sélectionné. Le PDF est maintenant cliquable.
                      </div>
                    ) : (
                      <div className="space-y-3 rounded-xl border border-blue-200 bg-white p-3">
                        <div className="rounded-lg bg-slate-950 px-3 py-2 text-xs text-white">
                          <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                            Page {designerSelection.page}
                          </span>
                          <span className="break-words">{designerSelection.text}</span>
                        </div>

                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                            Contenu du texte
                          </span>
                          <textarea
                            value={selectedTextOverride?.replacementText ?? designerSelection.text}
                            onChange={(event) =>
                              onSelectedTextOverrideChange({ replacementText: event.target.value })
                            }
                            rows={2}
                            className="w-full resize-y rounded-lg border border-slate-200 px-2 py-2 text-xs leading-5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                          {selectedTextOverride?.replacementText !== null &&
                            selectedTextOverride?.replacementText !== undefined && (
                              <button
                                type="button"
                                onClick={() =>
                                  onSelectedTextOverrideChange({ replacementText: null })
                                }
                                className="mt-1 text-[10px] font-semibold text-slate-500 hover:text-slate-900"
                              >
                                Restaurer le contenu original
                              </button>
                            )}
                        </label>

                        <div className="grid grid-cols-2 gap-2">
                          <label>
                            <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                              Police
                            </span>
                            <select
                              value={selectedTextOverride?.fontFamily ?? "template"}
                              onChange={(event) =>
                                onSelectedTextOverrideChange({
                                  fontFamily: event.target.value as DesignerFontFamily,
                                })
                              }
                              className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs font-semibold"
                            >
                              {designerFonts.map((font) => (
                                <option key={font.id} value={font.id}>
                                  {font.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                              Taille
                            </span>
                            <input
                              type="number"
                              min={5}
                              max={96}
                              step={0.5}
                              value={
                                selectedTextOverride?.fontSize ??
                                Number(designerSelection.fontSize.toFixed(1))
                              }
                              onChange={(event) =>
                                onSelectedTextOverrideChange({
                                  fontSize: Number(event.target.value),
                                })
                              }
                              className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs font-semibold"
                            />
                          </label>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg border border-slate-200 p-2">
                            <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">
                              Couleur du texte
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={selectedTextOverride?.color || "#111827"}
                                onChange={(event) =>
                                  onSelectedTextOverrideChange({ color: event.target.value })
                                }
                                className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                                aria-label="Couleur du texte sélectionné"
                              />
                              <button
                                type="button"
                                onClick={() => onSelectedTextOverrideChange({ color: "" })}
                                className="text-[10px] font-semibold text-slate-500 hover:text-slate-900"
                              >
                                Originale
                              </button>
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200 p-2">
                            <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">
                              Fond du texte
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={selectedTextOverride?.background || "#ffffff"}
                                onChange={(event) =>
                                  onSelectedTextOverrideChange({ background: event.target.value })
                                }
                                className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                                aria-label="Fond du texte sélectionné"
                              />
                              <button
                                type="button"
                                onClick={() => onSelectedTextOverrideChange({ background: "" })}
                                className="text-[10px] font-semibold text-slate-500 hover:text-slate-900"
                              >
                                Aucun
                              </button>
                            </div>
                          </div>
                        </div>

                        <div
                          className="grid grid-cols-3 gap-2"
                          role="group"
                          aria-label="Style du texte sélectionné"
                        >
                          {(
                            [
                              ["bold", "Gras", "B"],
                              ["italics", "Italique", "I"],
                              ["underline", "Souligné", "U"],
                            ] as const
                          ).map(([key, label, glyph]) => {
                            const active = selectedTextOverride?.[key] === "on";
                            return (
                              <button
                                key={key}
                                type="button"
                                aria-label={label}
                                aria-pressed={active}
                                onClick={() =>
                                  onSelectedTextOverrideChange({
                                    [key]: active ? "off" : "on",
                                  })
                                }
                                className={cn(
                                  "h-9 rounded-lg border text-xs font-bold transition",
                                  active
                                    ? "border-blue-500 bg-blue-600 text-white"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                                  key === "italics" && "italic",
                                  key === "underline" && "underline",
                                )}
                              >
                                {glyph} · {label}
                              </button>
                            );
                          })}
                        </div>

                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                            Alignement de cet élément
                          </span>
                          <select
                            value={selectedTextOverride?.alignment ?? "template"}
                            onChange={(event) =>
                              onSelectedTextOverrideChange({
                                alignment: event.target
                                  .value as TemplateDesignerSettings["alignment"],
                              })
                            }
                            className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs font-semibold"
                          >
                            <option value="template">Selon le modèle</option>
                            <option value="left">Gauche</option>
                            <option value="center">Centré</option>
                            <option value="right">Droite</option>
                            <option value="justify">Justifié</option>
                          </select>
                        </label>

                        <div className="grid grid-cols-2 gap-2">
                          <label>
                            <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                              Position X
                            </span>
                            <input
                              type="number"
                              min={-240}
                              max={240}
                              value={selectedTextOverride?.offsetX ?? 0}
                              onChange={(event) =>
                                onSelectedTextOverrideChange({
                                  offsetX: Number(event.target.value),
                                })
                              }
                              className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs font-semibold"
                            />
                          </label>
                          <label>
                            <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                              Position Y
                            </span>
                            <input
                              type="number"
                              min={-240}
                              max={240}
                              value={selectedTextOverride?.offsetY ?? 0}
                              onChange={(event) =>
                                onSelectedTextOverrideChange({
                                  offsetY: Number(event.target.value),
                                })
                              }
                              className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs font-semibold"
                            />
                          </label>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onSelectedTextOverrideChange({
                                hidden: !(selectedTextOverride?.hidden ?? false),
                              })
                            }
                            className={cn(
                              "h-9 rounded-lg border text-xs font-bold",
                              selectedTextOverride?.hidden
                                ? "border-rose-300 bg-rose-50 text-rose-700"
                                : "border-slate-200 text-slate-600 hover:bg-slate-50",
                            )}
                          >
                            {selectedTextOverride?.hidden ? "Réafficher" : "Masquer l’élément"}
                          </button>
                          <button
                            type="button"
                            onClick={onSelectedTextReset}
                            className="h-9 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                          >
                            Style original
                          </button>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Fond des pages PDF
                        </h3>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Modifie le document exporté, pas seulement l’espace de travail.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={designerSettings.pageBackground}
                          disabled={!designerSettings.pageBackgroundEnabled}
                          onChange={(event) => updateDesigner("pageBackground", event.target.value)}
                          aria-label="Couleur du fond des pages"
                          className="h-9 w-10 cursor-pointer disabled:opacity-40"
                        />
                        <input
                          type="checkbox"
                          checked={designerSettings.pageBackgroundEnabled}
                          onChange={(event) =>
                            updateDesigner("pageBackgroundEnabled", event.target.checked)
                          }
                          aria-label="Activer le fond des pages"
                          className="h-4 w-4 accent-blue-600"
                        />
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        <Type className="h-4 w-4" /> Texte et typographie
                      </h3>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Police du document
                        </span>
                        <select
                          value={designerSettings.fontFamily}
                          onChange={(event) =>
                            updateDesigner("fontFamily", event.target.value as DesignerFontFamily)
                          }
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          {designerFonts.map((font) => (
                            <option key={font.id} value={font.id}>
                              {font.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <DesignerRange
                        label="Taille globale du texte"
                        value={designerSettings.fontScale}
                        min={70}
                        max={160}
                        unit="%"
                        onChange={(value) => updateDesigner("fontScale", value)}
                      />
                      <DesignerRange
                        label="Interligne"
                        value={designerSettings.lineHeightScale}
                        min={75}
                        max={180}
                        unit="%"
                        onChange={(value) => updateDesigner("lineHeightScale", value)}
                      />
                      <DesignerRange
                        label="Espacement vertical"
                        value={designerSettings.spacingScale}
                        min={60}
                        max={180}
                        unit="%"
                        onChange={(value) => updateDesigner("spacingScale", value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <label>
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Alignement
                          </span>
                          <select
                            value={designerSettings.alignment}
                            onChange={(event) =>
                              updateDesigner(
                                "alignment",
                                event.target.value as TemplateDesignerSettings["alignment"],
                              )
                            }
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                          >
                            <option value="template">Selon le modèle</option>
                            <option value="left">Gauche</option>
                            <option value="center">Centré</option>
                            <option value="right">Droite</option>
                            <option value="justify">Justifié</option>
                          </select>
                        </label>
                        <label>
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Sens du texte
                          </span>
                          <select
                            value={designerSettings.direction}
                            onChange={(event) =>
                              updateDesigner(
                                "direction",
                                event.target.value as TemplateDesignerSettings["direction"],
                              )
                            }
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                          >
                            <option value="auto">Automatique</option>
                            <option value="ltr">LTR · gauche vers droite</option>
                            <option value="rtl">RTL · droite vers gauche</option>
                          </select>
                        </label>
                      </div>
                    </section>

                    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        Page, marges et position
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <label>
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Format
                          </span>
                          <select
                            value={designerSettings.pageSize}
                            onChange={(event) =>
                              updateDesigner(
                                "pageSize",
                                event.target.value as TemplateDesignerSettings["pageSize"],
                              )
                            }
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                          >
                            <option value="template">Selon le modèle</option>
                            <option value="A4">A4</option>
                            <option value="LETTER">Letter</option>
                          </select>
                        </label>
                        <label>
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Orientation
                          </span>
                          <select
                            value={designerSettings.orientation}
                            onChange={(event) =>
                              updateDesigner(
                                "orientation",
                                event.target.value as TemplateDesignerSettings["orientation"],
                              )
                            }
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                          >
                            <option value="template">Selon le modèle</option>
                            <option value="portrait">Portrait</option>
                            <option value="landscape">Paysage</option>
                          </select>
                        </label>
                      </div>
                      <DesignerRange
                        label="Marges horizontales"
                        value={designerSettings.marginXDelta}
                        min={-24}
                        max={90}
                        unit=" pt"
                        onChange={(value) => updateDesigner("marginXDelta", value)}
                      />
                      <DesignerRange
                        label="Marges verticales"
                        value={designerSettings.marginYDelta}
                        min={-24}
                        max={90}
                        unit=" pt"
                        onChange={(value) => updateDesigner("marginYDelta", value)}
                      />
                      <DesignerRange
                        label="Déplacer horizontalement"
                        value={designerSettings.offsetX}
                        min={-60}
                        max={60}
                        unit=" pt"
                        onChange={(value) => updateDesigner("offsetX", value)}
                      />
                      <DesignerRange
                        label="Déplacer verticalement"
                        value={designerSettings.offsetY}
                        min={-60}
                        max={60}
                        unit=" pt"
                        onChange={(value) => updateDesigner("offsetY", value)}
                      />
                      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600">
                        Numérotation des pages
                        <input
                          type="checkbox"
                          checked={designerSettings.showPageNumbers}
                          onChange={(event) =>
                            updateDesigner("showPageNumbers", event.target.checked)
                          }
                          className="h-4 w-4 accent-blue-600"
                        />
                      </label>
                    </section>
                  </div>

                  <section className="space-y-3 rounded-2xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Éléments insérés
                        </h3>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Ajoutez un texte, une ligne ou une icône vectorielle au PDF.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateDesigner("extraElements", [
                              ...designerSettings.extraElements,
                              newDesignerElement("text"),
                            ])
                          }
                          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                        >
                          <Plus className="h-3.5 w-3.5" /> Texte
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateDesigner("extraElements", [
                              ...designerSettings.extraElements,
                              newDesignerElement("separator"),
                            ])
                          }
                          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                          <Plus className="h-3.5 w-3.5" /> Ligne
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateDesigner("extraElements", [
                              ...designerSettings.extraElements,
                              newDesignerElement("icon"),
                            ])
                          }
                          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                          <Plus className="h-3.5 w-3.5" /> Icône
                        </button>
                      </div>
                    </div>
                    {designerSettings.extraElements.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 py-5 text-center text-xs text-slate-400">
                        Aucun élément personnalisé.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {designerSettings.extraElements.map((element) => (
                          <div
                            key={element.id}
                            className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 sm:grid-cols-[110px_1fr_105px_40px]"
                          >
                            <select
                              value={element.placement}
                              onChange={(event) =>
                                updateExtraElement(element.id, {
                                  placement: event.target.value as "start" | "end",
                                })
                              }
                              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold"
                            >
                              <option value="start">Au début</option>
                              <option value="end">À la fin</option>
                            </select>
                            {element.type === "text" ? (
                              <input
                                value={element.text}
                                onChange={(event) =>
                                  updateExtraElement(element.id, { text: event.target.value })
                                }
                                aria-label="Texte de l’élément"
                                className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                              />
                            ) : element.type === "icon" ? (
                              <select
                                value={element.text}
                                onChange={(event) =>
                                  updateExtraElement(element.id, { text: event.target.value })
                                }
                                aria-label="Icône vectorielle"
                                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold"
                              >
                                <option value="star">Étoile</option>
                                <option value="check">Validation</option>
                                <option value="mail">E-mail</option>
                                <option value="phone">Téléphone</option>
                                <option value="home">Adresse</option>
                                <option value="location">Localisation</option>
                              </select>
                            ) : (
                              <div className="flex h-9 items-center px-2 text-xs font-semibold text-slate-500">
                                Séparateur horizontal
                              </div>
                            )}
                            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2">
                              <input
                                type="color"
                                value={element.color}
                                onChange={(event) =>
                                  updateExtraElement(element.id, { color: event.target.value })
                                }
                                aria-label="Couleur de l’élément"
                                className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
                              />
                              {element.type !== "separator" && (
                                <input
                                  type="number"
                                  min={6}
                                  max={42}
                                  value={element.fontSize}
                                  onChange={(event) =>
                                    updateExtraElement(element.id, {
                                      fontSize: Number(event.target.value),
                                    })
                                  }
                                  aria-label={
                                    element.type === "icon"
                                      ? "Taille de l’icône"
                                      : "Taille du texte inséré"
                                  }
                                  className="w-10 bg-transparent text-xs font-semibold outline-none"
                                />
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                updateDesigner(
                                  "extraElements",
                                  designerSettings.extraElements.filter(
                                    (current) => current.id !== element.id,
                                  ),
                                )
                              }
                              aria-label="Supprimer l’élément"
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3">
                    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-blue-800">
                      <Save className="h-4 w-4" /> Modèles personnalisés
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={newPresetName}
                        onChange={(event) => setNewPresetName(event.target.value)}
                        placeholder="Nom du nouveau modèle"
                        className="h-10 min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        disabled={!newPresetName.trim()}
                        onClick={() => {
                          onCreateDesignerPreset(newPresetName.trim());
                          setNewPresetName("");
                        }}
                        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Save className="h-3.5 w-3.5" /> Enregistrer comme nouveau modèle
                      </button>
                    </div>
                    {designerPresets.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {designerPresets.map((preset) => (
                          <div
                            key={preset.id}
                            className={cn(
                              "flex items-center gap-2 rounded-xl border bg-white p-2",
                              activeDesignerPresetId === preset.id
                                ? "border-blue-400 ring-2 ring-blue-100"
                                : "border-blue-100",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => onApplyDesignerPreset(preset.id)}
                              className="min-w-0 flex-1 truncate px-1 text-left text-xs font-semibold text-slate-700"
                            >
                              {preset.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteDesignerPreset(preset.id)}
                              aria-label={`Supprimer ${preset.name}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          )}

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
                      "group relative min-h-24 overflow-hidden rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                      selected
                        ? "border-blue-300 bg-blue-50 text-blue-800"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50",
                    )}
                  >
                    <span className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold">
                      {template.name}
                      {selected && <Check className="h-4 w-4 shrink-0" />}
                    </span>
                    <span className="block rounded-md border border-slate-200 bg-white p-2 shadow-sm">
                      <span
                        className="mb-1.5 block h-1.5 w-1/3 rounded-full"
                        style={{ backgroundColor: accentColor }}
                      />
                      <span className="mb-1 block h-1 w-full rounded-full bg-slate-200" />
                      <span className="mb-1 block h-1 w-4/5 rounded-full bg-slate-200" />
                      <span className="block h-1 w-2/3 rounded-full bg-slate-100" />
                    </span>
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
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600">Affichage des pages</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onPageLayoutChange("continuous")}
                    aria-pressed={pageLayout === "continuous"}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                      pageLayout === "continuous"
                        ? "border-blue-300 bg-blue-50 text-blue-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    Vue continue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onPageLayoutChange("grid");
                      onFocusModeChange(true);
                    }}
                    aria-pressed={pageLayout === "grid"}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                      pageLayout === "grid"
                        ? "border-blue-300 bg-blue-50 text-blue-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    Grille de pages
                  </button>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Modèle actif :{" "}
                <span className="font-semibold text-slate-700">{selectedTemplate?.name}</span>
              </div>
            </div>
          )}

          {activeTool === "organize" && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Actions rapides
              </p>
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
                <button
                  type="button"
                  onClick={onShowAllSections}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Tout afficher
                </button>
                <button
                  type="button"
                  onClick={onHideEmptySections}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Masquer les sections vides
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
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600">
                  Arrière-plan de l’aperçu
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["classic", "Blanc classique", "#f8fafc"],
                      ["pearl", "Gris perle", "#eef1f5"],
                      ["cream", "Papier crème", "#f6f0e4"],
                      ["blue-mist", "Brume bleue", "#eaf1f7"],
                    ] as const
                  ).map(([value, label, color]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onSurfaceChange(value)}
                      aria-pressed={surface === value}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-xs font-semibold transition",
                        surface === value
                          ? "border-blue-300 bg-blue-50 text-blue-800"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      <span
                        className="h-5 w-5 shrink-0 rounded-md border border-slate-300"
                        style={{ backgroundColor: color }}
                      />
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-4 text-slate-400">
                  Ce fond facilite la lecture à l’écran sans modifier la couleur du papier PDF.
                </p>
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
              onClick={() => {
                if (id === "designer" && activeTool !== "designer") onFocusModeChange(true);
                setActiveTool((current) => (current === id ? null : id));
              }}
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
