import type { TechOrder, TechService } from "./tech-orders";
import type { TechLogo } from "./tech-order-logos";
import type { TechFinance } from "./tech-finance";
export type TechDashboard = {
  services: TechService[];
  orders: TechOrder[];
  logos: Record<string, TechLogo>;
  finance: TechFinance;
};
/** Session-bound RAM only. Never persist financial data to localStorage or a public cache. */
export function createTechDashboardMemory(now = () => Date.now()) {
  let entry: { session: string; data: TechDashboard; at: number } | undefined;
  return {
    read(session: string | null) {
      if (!entry) return undefined;
      if (!session || entry.session !== session || now() - entry.at > 300000) {
        entry = undefined;
        return undefined;
      }
      return entry.data;
    },
    put(session: string | null, data: TechDashboard) {
      entry = session ? { session, data, at: now() } : undefined;
    },
    clear() {
      entry = undefined;
    },
  };
}
export const techDashboardMemory = createTechDashboardMemory();
