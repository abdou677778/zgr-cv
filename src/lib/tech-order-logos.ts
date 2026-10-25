import { softwareIconUrl } from "./software-icons";
import type { TechService } from "./tech-orders";
export type TechLogo = { id: string; revision: number; icon: string; dataUrl: string };
/** Tech override > legacy service upload > shared corrected software logo > bundled icon. */
export function techLogoSource(service?: TechService, override?: TechLogo) {
  if (!service) return "";
  return (
    (override?.icon === service.icon ? override.dataUrl : "") ||
    service.logo ||
    softwareIconUrl(service.icon)
  );
}
