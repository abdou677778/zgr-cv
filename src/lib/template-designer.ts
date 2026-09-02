import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { DocumentLanguage } from "./document-language";
import type { PdfTemplateId } from "./document-templates";

export type DesignerFontFamily = "template" | "Calibri" | "Cambria" | "ArialOfficial";
export type DesignerAlignment = "template" | "left" | "center" | "right" | "justify";
export type DesignerDirection = "auto" | "ltr" | "rtl";
export type DesignerPageSize = "template" | "A4" | "LETTER";
export type DesignerOrientation = "template" | "portrait" | "landscape";

export type DesignerExtraElement = {
  id: string;
  type: "text" | "separator";
  placement: "start" | "end";
  text: string;
  fontSize: number;
  color: string;
  bold: boolean;
  alignment: Exclude<DesignerAlignment, "template">;
  marginBefore: number;
  marginAfter: number;
};

export type TemplateDesignerSettings = {
  fontFamily: DesignerFontFamily;
  fontScale: number;
  lineHeightScale: number;
  spacingScale: number;
  alignment: DesignerAlignment;
  direction: DesignerDirection;
  pageSize: DesignerPageSize;
  orientation: DesignerOrientation;
  marginXDelta: number;
  marginYDelta: number;
  offsetX: number;
  offsetY: number;
  showPageNumbers: boolean;
  extraElements: DesignerExtraElement[];
};

export type TemplateDesignerSettingsMap = Partial<Record<PdfTemplateId, TemplateDesignerSettings>>;

export type DesignerPreset = {
  id: string;
  name: string;
  baseTemplateId: PdfTemplateId;
  settings: TemplateDesignerSettings;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_TEMPLATE_DESIGNER_SETTINGS: TemplateDesignerSettings = {
  fontFamily: "template",
  fontScale: 100,
  lineHeightScale: 100,
  spacingScale: 100,
  alignment: "template",
  direction: "auto",
  pageSize: "template",
  orientation: "template",
  marginXDelta: 0,
  marginYDelta: 0,
  offsetX: 0,
  offsetY: 0,
  showPageNumbers: false,
  extraElements: [],
};

const FONT_FAMILIES = new Set<DesignerFontFamily>([
  "template",
  "Calibri",
  "Cambria",
  "ArialOfficial",
]);
const ALIGNMENTS = new Set<DesignerAlignment>(["template", "left", "center", "right", "justify"]);
const DIRECTIONS = new Set<DesignerDirection>(["auto", "ltr", "rtl"]);
const PAGE_SIZES = new Set<DesignerPageSize>(["template", "A4", "LETTER"]);
const ORIENTATIONS = new Set<DesignerOrientation>(["template", "portrait", "landscape"]);

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const normalizeColor = (value: unknown, fallback = "#111827") => {
  const color = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
};

export function newDesignerElement(type: DesignerExtraElement["type"]): DesignerExtraElement {
  return {
    id: crypto.randomUUID(),
    type,
    placement: "end",
    text: type === "text" ? "Nouveau bloc de texte" : "",
    fontSize: 10,
    color: "#111827",
    bold: false,
    alignment: "left",
    marginBefore: 8,
    marginAfter: 8,
  };
}

export function normalizeTemplateDesignerSettings(value: unknown): TemplateDesignerSettings {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const extraElements = Array.isArray(input.extraElements)
    ? input.extraElements.slice(0, 20).flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const element = item as Record<string, unknown>;
        const type = element.type === "separator" ? "separator" : "text";
        const alignment = ALIGNMENTS.has(element.alignment as DesignerAlignment)
          ? (element.alignment as DesignerAlignment)
          : "left";
        return [
          {
            id:
              typeof element.id === "string" && element.id.length <= 100
                ? element.id
                : `designer-element-${index}`,
            type,
            placement: element.placement === "start" ? "start" : "end",
            text: typeof element.text === "string" ? element.text.slice(0, 2_000) : "",
            fontSize: clamp(element.fontSize, 6, 42, 10),
            color: normalizeColor(element.color),
            bold: element.bold === true,
            alignment: alignment === "template" ? "left" : alignment,
            marginBefore: clamp(element.marginBefore, 0, 80, 8),
            marginAfter: clamp(element.marginAfter, 0, 80, 8),
          } satisfies DesignerExtraElement,
        ];
      })
    : [];

  return {
    fontFamily: FONT_FAMILIES.has(input.fontFamily as DesignerFontFamily)
      ? (input.fontFamily as DesignerFontFamily)
      : "template",
    fontScale: clamp(input.fontScale, 70, 160, 100),
    lineHeightScale: clamp(input.lineHeightScale, 75, 180, 100),
    spacingScale: clamp(input.spacingScale, 60, 180, 100),
    alignment: ALIGNMENTS.has(input.alignment as DesignerAlignment)
      ? (input.alignment as DesignerAlignment)
      : "template",
    direction: DIRECTIONS.has(input.direction as DesignerDirection)
      ? (input.direction as DesignerDirection)
      : "auto",
    pageSize: PAGE_SIZES.has(input.pageSize as DesignerPageSize)
      ? (input.pageSize as DesignerPageSize)
      : "template",
    orientation: ORIENTATIONS.has(input.orientation as DesignerOrientation)
      ? (input.orientation as DesignerOrientation)
      : "template",
    marginXDelta: clamp(input.marginXDelta, -24, 90, 0),
    marginYDelta: clamp(input.marginYDelta, -24, 90, 0),
    offsetX: clamp(input.offsetX, -60, 60, 0),
    offsetY: clamp(input.offsetY, -60, 60, 0),
    showPageNumbers: input.showPageNumbers === true,
    extraElements,
  };
}

export function designerFontsForLanguage(language: DocumentLanguage) {
  if (language === "zh") return [{ id: "template" as const, label: "Police chinoise du modèle" }];
  if (language === "ar") {
    return [
      { id: "template" as const, label: "Police du modèle" },
      { id: "ArialOfficial" as const, label: "Arial officiel" },
    ];
  }
  return [
    { id: "template" as const, label: "Police du modèle" },
    { id: "Calibri" as const, label: "Calibri" },
    { id: "Cambria" as const, label: "Cambria" },
    { id: "ArialOfficial" as const, label: "Arial" },
  ];
}

export function effectiveDesignerSettings(
  settings: TemplateDesignerSettings,
  language: DocumentLanguage,
) {
  const normalized = normalizeTemplateDesignerSettings(settings);
  const permitted = designerFontsForLanguage(language).some(
    (font) => font.id === normalized.fontFamily,
  );
  return permitted ? normalized : { ...normalized, fontFamily: "template" as const };
}

const scaled = (value: number, percent: number, min = 0) =>
  Math.max(min, Number(((value * percent) / 100).toFixed(2)));

function transformNode(value: unknown, settings: TemplateDesignerSettings): void {
  if (Array.isArray(value)) {
    value.forEach((item) => transformNode(item, settings));
    return;
  }
  if (!value || typeof value !== "object") return;

  const node = value as Record<string, unknown>;
  if (typeof node.fontSize === "number")
    node.fontSize = scaled(node.fontSize, settings.fontScale, 5);
  if (typeof node.lineHeight === "number") {
    node.lineHeight = scaled(node.lineHeight, settings.lineHeightScale, 0.7);
  }
  if (Array.isArray(node.margin) && node.margin.every((item) => typeof item === "number")) {
    if (node.margin.length === 4) {
      node.margin = [
        node.margin[0],
        scaled(node.margin[1], settings.spacingScale),
        node.margin[2],
        scaled(node.margin[3], settings.spacingScale),
      ];
    } else if (node.margin.length === 2) {
      node.margin = [node.margin[0], scaled(node.margin[1], settings.spacingScale)];
    }
  }
  if (settings.fontFamily !== "template" && ("text" in node || "font" in node)) {
    node.font = settings.fontFamily;
  }
  if (settings.alignment !== "template" && "text" in node) node.alignment = settings.alignment;
  if (settings.direction === "rtl" && "text" in node) node.alignment = "right";
  if (settings.direction === "ltr" && "text" in node) node.alignment = "left";

  Object.values(node).forEach((item) => transformNode(item, settings));
}

const marginTuple = (value: TDocumentDefinitions["pageMargins"]) => {
  if (typeof value === "number") return [value, value, value, value];
  if (Array.isArray(value)) {
    if (value.length === 2) return [value[0], value[1], value[0], value[1]];
    if (value.length === 4) return [...value];
  }
  return [40, 40, 40, 40];
};

function extraElementContent(element: DesignerExtraElement, font?: string): Content {
  if (element.type === "separator") {
    return {
      canvas: [
        { type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: element.color },
      ],
      margin: [0, element.marginBefore, 0, element.marginAfter],
    };
  }
  return {
    text: element.text || " ",
    font,
    fontSize: element.fontSize,
    color: element.color,
    bold: element.bold,
    alignment: element.alignment,
    margin: [0, element.marginBefore, 0, element.marginAfter],
  };
}

export function applyTemplateDesigner(
  definition: TDocumentDefinitions,
  rawSettings?: TemplateDesignerSettings,
): TDocumentDefinitions {
  if (!rawSettings) return definition;
  const settings = normalizeTemplateDesignerSettings(rawSettings);
  // applyPdfTheme already returns a detached document tree. Mutating that tree
  // preserves pdfMake callbacks (background/header/footer), which cannot be
  // copied with structuredClone.
  const designed = definition;

  transformNode(designed.content, settings);
  transformNode(designed.styles, settings);
  transformNode(designed.defaultStyle, settings);

  designed.defaultStyle = {
    ...(designed.defaultStyle || {}),
    ...(settings.fontFamily === "template" ? {} : { font: settings.fontFamily }),
    ...(settings.alignment === "template" ? {} : { alignment: settings.alignment }),
    ...(settings.direction === "rtl"
      ? { alignment: "right" as const }
      : settings.direction === "ltr"
        ? { alignment: "left" as const }
        : {}),
  };

  const margins = marginTuple(designed.pageMargins).map((value) => Number(value) || 0);
  designed.pageMargins = [
    Math.max(8, margins[0] + settings.marginXDelta + settings.offsetX),
    Math.max(8, margins[1] + settings.marginYDelta + settings.offsetY),
    Math.max(8, margins[2] + settings.marginXDelta - settings.offsetX),
    Math.max(8, margins[3] + settings.marginYDelta - settings.offsetY),
  ];
  if (settings.pageSize !== "template") designed.pageSize = settings.pageSize;
  if (settings.orientation !== "template") designed.pageOrientation = settings.orientation;

  const font = settings.fontFamily === "template" ? undefined : settings.fontFamily;
  const start = settings.extraElements
    .filter((element) => element.placement === "start")
    .map((element) => extraElementContent(element, font));
  const end = settings.extraElements
    .filter((element) => element.placement === "end")
    .map((element) => extraElementContent(element, font));
  const content = Array.isArray(designed.content) ? designed.content : [designed.content];
  designed.content = [...start, ...content, ...end];

  if (settings.showPageNumbers) {
    designed.footer = (currentPage: number, pageCount: number) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: "center",
      font,
      fontSize: 8,
      color: "#64748b",
      margin: [0, 8, 0, 0],
    });
  }

  return designed;
}

export function normalizeDesignerPresets(value: unknown): DesignerPreset[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const preset = item as Record<string, unknown>;
    if (
      typeof preset.id !== "string" ||
      typeof preset.name !== "string" ||
      typeof preset.baseTemplateId !== "string"
    ) {
      return [];
    }
    return [
      {
        id: preset.id.slice(0, 100),
        name: preset.name.trim().slice(0, 80) || "Modèle personnalisé",
        baseTemplateId: preset.baseTemplateId as PdfTemplateId,
        settings: normalizeTemplateDesignerSettings(preset.settings),
        createdAt:
          typeof preset.createdAt === "string" ? preset.createdAt : new Date().toISOString(),
        updatedAt:
          typeof preset.updatedAt === "string" ? preset.updatedAt : new Date().toISOString(),
      },
    ];
  });
}
