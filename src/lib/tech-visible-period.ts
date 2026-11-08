import type { TechClientGroup } from "./tech-client-groups";
/** Presentation only: prefer an ongoing period, never promote a future renewal early. */
export function primaryTechPeriod(periods: TechClientGroup["periods"], today: string) {
  return (
    periods.filter((p) => p.line.start <= today && p.line.end > today).at(-1) ||
    periods.filter((p) => p.line.start <= today).at(-1) ||
    periods[0]
  );
}
