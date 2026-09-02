import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { DocumentLanguage } from "./document-language";
import type { PdfTemplateId } from "./document-templates";

export type DesignerFontFamily = "template" | "Calibri" | "Cambria" | "ArialOfficial";
export type DesignerAlignment = "template" | "left" | "center" | "right" | "justify";
export type DesignerDirection = "auto" | "ltr" | "rtl";
export type DesignerPageSize = "template" | "A4" | "LETTER";
export type DesignerOrientation = "template" | "portrait" | "landscape";

export type DesignerTextTarget = {
  id: string;
  text: string;
  occurrence: number;
  page: number;
  fontSize: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DesignerTextOverride = {
  id: string;
  text: string;
  occurrence: number;
  replacementText: string | null;
  fontFamily: DesignerFontFamily;
  fontSize: number | null;
  color: string;
  background: string;
  bold: "template" | "on" | "off";
  italics: "template" | "on" | "off";
  underline: "template" | "on" | "off";
  alignment: DesignerAlignment;
  offsetX: number;
  offsetY: number;
  hidden: boolean;
};

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
  pageBackgroundEnabled: boolean;
  pageBackground: string;
  textOverrides: DesignerTextOverride[];
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
  pageBackgroundEnabled: false,
  pageBackground: "#ffffff",
  textOverrides: [],
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
const TEXT_TOGGLES = new Set<DesignerTextOverride["bold"]>(["template", "on", "off"]);

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
  const textOverrides = Array.isArray(input.textOverrides)
    ? input.textOverrides.slice(0, 300).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const override = item as Record<string, unknown>;
        if (
          typeof override.id !== "string" ||
          typeof override.text !== "string" ||
          !override.text.trim()
        ) {
          return [];
        }
        const fontSize = Number(override.fontSize);
        return [
          {
            id: override.id.slice(0, 300),
            text: override.text.slice(0, 1_000),
            occurrence: Math.max(0, Math.floor(Number(override.occurrence) || 0)),
            replacementText:
              typeof override.replacementText === "string"
                ? override.replacementText.slice(0, 2_000)
                : null,
            fontFamily: FONT_FAMILIES.has(override.fontFamily as DesignerFontFamily)
              ? (override.fontFamily as DesignerFontFamily)
              : "template",
            fontSize: Number.isFinite(fontSize) ? clamp(fontSize, 5, 96, 10) : null,
            color:
              typeof override.color === "string" && override.color
                ? normalizeColor(override.color)
                : "",
            background:
              typeof override.background === "string" && override.background
                ? normalizeColor(override.background, "#ffffff")
                : "",
            bold: TEXT_TOGGLES.has(override.bold as DesignerTextOverride["bold"])
              ? (override.bold as DesignerTextOverride["bold"])
              : "template",
            italics: TEXT_TOGGLES.has(override.italics as DesignerTextOverride["italics"])
              ? (override.italics as DesignerTextOverride["italics"])
              : "template",
            underline: TEXT_TOGGLES.has(override.underline as DesignerTextOverride["underline"])
              ? (override.underline as DesignerTextOverride["underline"])
              : "template",
            alignment: ALIGNMENTS.has(override.alignment as DesignerAlignment)
              ? (override.alignment as DesignerAlignment)
              : "template",
            offsetX: clamp(override.offsetX, -240, 240, 0),
            offsetY: clamp(override.offsetY, -240, 240, 0),
            hidden: override.hidden === true,
          } satisfies DesignerTextOverride,
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
    pageBackgroundEnabled: input.pageBackgroundEnabled === true,
    pageBackground: normalizeColor(input.pageBackground, "#ffffff"),
    textOverrides,
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

const normalizedText = (value: string) => value.replace(/\s+/g, " ").trim();

function textValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => textValue(item)).join("");
  if (value && typeof value === "object" && "text" in value) {
    return textValue((value as Record<string, unknown>).text);
  }
  return "";
}

function applyTextOverrides(
  value: unknown,
  settings: TemplateDesignerSettings,
  occurrences = new Map<string, number>(),
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => applyTextOverrides(item, settings, occurrences));
    return;
  }
  if (!value || typeof value !== "object") return;

  const node = value as Record<string, unknown>;
  if ("text" in node) {
    if (Array.isArray(node.text)) {
      // pdfMake renders rich-text spans as distinct selectable PDF text items.
      // Walking each span keeps the WYSIWYG target aligned with what PDF.js exposes
      // and makes individually coloured name fragments editable.
      node.text.forEach((item) => applyTextOverrides(item, settings, occurrences));
      Object.entries(node).forEach(([key, item]) => {
        if (key !== "text") applyTextOverrides(item, settings, occurrences);
      });
      return;
    }
    const text = normalizedText(textValue(node.text));
    if (text) {
      const occurrence = occurrences.get(text) || 0;
      occurrences.set(text, occurrence + 1);
      const override = settings.textOverrides.find(
        (candidate) =>
          normalizedText(candidate.text) === text && candidate.occurrence === occurrence,
      );
      if (override) {
        if (override.hidden) {
          node.text = "";
        } else {
          if (override.replacementText !== null) node.text = override.replacementText;
          if (override.fontFamily !== "template") node.font = override.fontFamily;
          if (override.fontSize !== null) node.fontSize = override.fontSize;
          if (override.color) node.color = override.color;
          if (override.background) node.background = override.background;
          if (override.bold !== "template") node.bold = override.bold === "on";
          if (override.italics !== "template") node.italics = override.italics === "on";
          if (override.underline !== "template") {
            node.decoration = override.underline === "on" ? "underline" : undefined;
          }
          if (override.alignment !== "template") node.alignment = override.alignment;
          if (override.offsetX || override.offsetY) {
            const current =
              node.relativePosition && typeof node.relativePosition === "object"
                ? (node.relativePosition as { x?: number; y?: number })
                : {};
            node.relativePosition = {
              x: (Number(current.x) || 0) + override.offsetX,
              y: (Number(current.y) || 0) + override.offsetY,
            };
          }
        }
      }
    }
    Object.entries(node).forEach(([key, item]) => {
      if (key !== "text") applyTextOverrides(item, settings, occurrences);
    });
    return;
  }
  Object.values(node).forEach((item) => applyTextOverrides(item, settings, occurrences));
}

export function createDesignerTextOverride(target: DesignerTextTarget): DesignerTextOverride {
  return {
    id: target.id,
    text: target.text,
    occurrence: target.occurrence,
    replacementText: null,
    fontFamily: "template",
    fontSize: null,
    color: "",
    background: "",
    bold: "template",
    italics: "template",
    underline: "template",
    alignment: "template",
    offsetX: 0,
    offsetY: 0,
    hidden: false,
  };
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
  applyTextOverrides(designed.content, settings);

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

  if (settings.pageBackgroundEnabled) {
    const originalBackground = designed.background;
    designed.background = (currentPage, pageSize) => {
      const original =
        typeof originalBackground === "function"
          ? originalBackground(currentPage, pageSize)
          : originalBackground;
      return [
        {
          canvas: [
            {
              type: "rect",
              x: 0,
              y: 0,
              w: pageSize.width,
              h: pageSize.height,
              color: settings.pageBackground,
            },
          ],
          absolutePosition: { x: 0, y: 0 },
        },
        ...(original ? (Array.isArray(original) ? original : [original]) : []),
      ] as Content;
    };
  }

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
