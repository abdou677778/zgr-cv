import type { TDocumentDefinitions } from "pdfmake/interfaces";

export const TEMPLATE_DEFAULT_COLORS = {
  "canadian-v1": "#111827",
  "canadian-v2": "#953735",
  "canadian-v3": "#0070c0",
  "canadian-v4": "#ef4444",
  "ats-a4": "#101010",
  "arabic-pro-v2": "#198754",
  "arabic-pro-v3": "#c00000",
  "arabic-pro-v4": "#0070c0",
  "arabic-pro-v5": "#c00000",
  "cover-letter-v1": "#cf1645",
  "cover-letter-v2": "#0d6070",
  "cover-letter-v3": "#4d006f",
  "cover-letter-v4": "#0064a7",
  "cover-letter-v5": "#063b9f",
  "advises-v1": "#149d6a",
} as const;

export type ThemeTemplateId = keyof typeof TEMPLATE_DEFAULT_COLORS;
export type TemplateColorMap = Record<ThemeTemplateId, string>;

export const COLOR_PRESETS = [
  "#2563eb",
  "#8b5cf6",
  "#0891b2",
  "#059669",
  "#f97316",
  "#ef4444",
] as const;

export const DEFAULT_TEMPLATE_COLORS: TemplateColorMap = { ...TEMPLATE_DEFAULT_COLORS };

const normalizeHex = (color: string) => {
  const value = color.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return `#${value
      .slice(1)
      .split("")
      .map((character) => `${character}${character}`)
      .join("")}`;
  }
  return "#111827";
};

const mix = (first: string, second: string, weight: number) => {
  const from = normalizeHex(first)
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => Number.parseInt(value, 16));
  const to = normalizeHex(second)
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => Number.parseInt(value, 16));
  const channel = (index: number) =>
    Math.round(from[index] + (to[index] - from[index]) * weight)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
};

const themedReplacements = (templateId: ThemeTemplateId, selectedColor: string) => {
  const accent = normalizeHex(selectedColor);
  const lighter = mix(accent, "#ffffff", 0.36);
  const pale = mix(accent, "#ffffff", 0.78);
  const darker = mix(accent, "#000000", 0.28);
  const replacementSets: Record<ThemeTemplateId, Record<string, string>> = {
    "canadian-v1": { "#111827": accent, "#52525b": mix(accent, "#ffffff", 0.26) },
    "canadian-v2": { "#953735": accent },
    "canadian-v3": { "#0070c0": accent, "#0563c1": darker },
    "canadian-v4": { "#ef4444": accent },
    "ats-a4": { "#101010": accent, "#0563c1": accent, "#afabab": mix(accent, "#ffffff", 0.64) },
    "arabic-pro-v2": { "#ff4761": accent },
    "arabic-pro-v3": { "#ff4761": accent },
    "arabic-pro-v4": { "#ff4761": accent, "#0070c0": accent },
    "arabic-pro-v5": { "#ff4761": accent },
    "cover-letter-v1": {
      "#cf1645": accent,
      "#ca1746": darker,
      "#e75a7b": lighter,
      "#f9bfd0": pale,
    },
    "cover-letter-v2": { "#0d6070": darker, "#4bd381": lighter, "#dff9f3": pale },
    "cover-letter-v3": { "#4d006f": darker, "#d30a87": lighter, "#dff9f3": pale },
    "cover-letter-v4": { "#0064a7": darker, "#0bc4b0": lighter, "#dff9f3": pale },
    "cover-letter-v5": { "#063b9f": accent },
    "advises-v1": {
      "#149d6a": accent,
      "#00653f": darker,
      "#13b878": lighter,
      "#8ed827": mix(accent, "#d8f238", 0.58),
      "#e6fff4": pale,
    },
  };
  return replacementSets[templateId];
};

function replaceColors(value: unknown, replacements: Record<string, string>): unknown {
  if (typeof value === "string") {
    return Object.entries(replacements).reduce(
      (current, [source, replacement]) =>
        current.replace(new RegExp(source.replace("#", "\\#"), "gi"), replacement),
      value,
    );
  }
  if (typeof value === "function") {
    return function themedFunction(this: unknown, ...args: unknown[]) {
      return replaceColors(value.apply(this, args), replacements);
    };
  }
  if (Array.isArray(value)) return value.map((item) => replaceColors(item, replacements));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceColors(item, replacements)]),
    );
  }
  return value;
}

function addListMarkerColor(value: unknown, color: string): void {
  if (Array.isArray(value)) {
    value.forEach((item) => addListMarkerColor(item, color));
    return;
  }
  if (!value || typeof value !== "object") return;
  const node = value as Record<string, unknown>;
  if (Array.isArray(node.ul) || Array.isArray(node.ol)) node.markerColor = color;
  Object.values(node).forEach((item) => addListMarkerColor(item, color));
}

export function applyPdfTheme(
  definition: TDocumentDefinitions,
  templateId: ThemeTemplateId,
  selectedColor?: string,
) {
  const color = selectedColor || TEMPLATE_DEFAULT_COLORS[templateId];
  const themed = replaceColors(
    definition,
    themedReplacements(templateId, color),
  ) as TDocumentDefinitions;
  // V1 originally uses the same dark value for its accents and body copy.
  // Keep long-form text neutral while recoloring headings, rules and icons.
  if (templateId === "canadian-v1" && themed.defaultStyle) {
    themed.defaultStyle.color = "#111827";
    addListMarkerColor(themed.content, normalizeHex(color));
  }
  return themed;
}

export function paletteForTemplate(templateId: ThemeTemplateId) {
  return Array.from(new Set([TEMPLATE_DEFAULT_COLORS[templateId], ...COLOR_PRESETS]));
}
