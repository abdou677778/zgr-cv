export const techLogoModes = {
  circle: "Cercle",
  rounded: "Carré arrondi",
  square: "Carré",
} as const;
export type TechLogoMode = keyof typeof techLogoModes;
export const techLogoModeKey = "zgr-tech-logo-mode";
export function validTechLogoMode(value: string | null): TechLogoMode {
  return value === "rounded" || value === "square" ? value : "circle";
}
