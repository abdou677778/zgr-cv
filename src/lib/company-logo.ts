import type { CompanyLogo } from "./cv-types";

const SAFE_LOGO_PREFIXES = ["data:image/png;base64,", "data:image/jpeg;base64,"];
const MAX_STORED_LOGO_CHARACTERS = 300_000;

export function normalizeCompanyLogo(value: unknown): CompanyLogo | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Partial<CompanyLogo>;
  const dataUrl = typeof source.dataUrl === "string" ? source.dataUrl : "";
  if (
    dataUrl.length > MAX_STORED_LOGO_CHARACTERS ||
    !SAFE_LOGO_PREFIXES.some((prefix) => dataUrl.startsWith(prefix))
  ) {
    return undefined;
  }
  const width = Number(source.width);
  const height = Number(source.height);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width !== height ||
    width < 32 ||
    width > 512
  ) {
    return undefined;
  }
  return {
    dataUrl,
    width,
    height,
    name:
      typeof source.name === "string" && source.name.trim()
        ? source.name.trim().slice(0, 80)
        : "logo-entreprise.png",
  };
}
