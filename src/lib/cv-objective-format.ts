import type { ObjectiveFormat, ObjectiveTextAlignment } from "./cv-types";

export const DEFAULT_OBJECTIVE_FORMAT: ObjectiveFormat = {
  html: "",
  alignment: "",
  fontSize: 15,
  color: "",
};

const ALIGNMENTS = new Set<ObjectiveTextAlignment>(["", "left", "center", "right"]);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function normalizeObjectiveFormat(value: unknown): ObjectiveFormat {
  const source = value && typeof value === "object" ? (value as Partial<ObjectiveFormat>) : {};
  const alignment = ALIGNMENTS.has(source.alignment as ObjectiveTextAlignment)
    ? (source.alignment as ObjectiveTextAlignment)
    : "";
  const fontSize = Number(source.fontSize);
  const color =
    typeof source.color === "string" && HEX_COLOR.test(source.color) ? source.color : "";

  return {
    html: typeof source.html === "string" ? source.html.slice(0, 12_000) : "",
    alignment,
    fontSize: Number.isFinite(fontSize) ? Math.min(22, Math.max(12, fontSize)) : 15,
    color,
  };
}
